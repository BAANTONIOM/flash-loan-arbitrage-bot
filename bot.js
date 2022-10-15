import http from 'http'
import ethers from 'ethers'
import express from 'express'
import expressWs from 'express-ws'
import fs from 'fs'
import chalk from 'chalk'
import path from 'path'
import Web3 from 'web3'
import { fileURLToPath } from 'url'

const app = express()
const httpServer = http.createServer(app)
const wss = expressWs(app, httpServer)


// for BSC mainnet
const data = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',     // WBNB Address
  factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap V2 factory
  router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 router
}

const  timeDelay  = 3600
const  minBNB     = 0.00000001
const  minProfit  = 0.000000000000001
var    botStatus  = false
var    lockedList = []

// Buy method in the pancakeswap v2 router
var buy_method = [];
buy_method[0] = "0x7ff36ab5";  //swapExactETHForTokens
buy_method[1] = "0xb6f9de95";  //swapExactETHForTokensSupportingFeeOnTransferTokens
buy_method[2] = "0xfb3bdb41"; //swapETHForExactTokens

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: 'success', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: 'supply', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_from', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: 'success', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: 'digits', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: 'success', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: 'remaining', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: '_owner', type: 'address' },
      { indexed: true, name: '_spender', type: 'address' },
      { indexed: false, name: '_value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
]

// Global Variable for the transaction state
var mSubscription
var web3Ws
var provider
var wallet 
var account 
var router
var factoryContract

/*****************************************************************************************************
 * Set Bot status consisting of wallet address, private key, token address, slippage, gas price, etc.
 * ***************************************************************************************************/
function setBotStatus(obj) {
  console.log('--- bot status', obj.botStatus)
  if (obj.botStatus) {
    botStatus = obj.botStatus
    data.recipient = obj.walletAddr
    data.privateKey = obj.privateKey
    data.tokenAddress = obj.tokenAddress
    data.AMOUNT_OF_WBNB = exponentialToDecimal(obj.inAmount)
    data.Slippage = obj.slippage
    data.gasPrice = obj.gasPrice
    data.gasLimit = obj.gasLimit
    data.nodeURL  = obj.nodeURL
    data.wssURL   = obj.wssURL
    data.sTime    = obj.sTime
    data.eTime    = obj.eTime 
  }
  console.log(data)
}

/*****************************************************************************************************
 * Get the message from the frontend and analyze that, start mempool scan or stop.
 * ***************************************************************************************************/
app.ws('/connect', function (ws, req) {
  ws.on('message', async function (msg) {
    if (msg === 'connectRequest') {
      var obj = { botStatus: botStatus }
      ws.send(JSON.stringify(obj))
    } else {
      var obj = JSON.parse(msg)
      setBotStatus(obj)
      botStatus = obj.botStatus
      if (botStatus) {
        scanMempool()
        // setTimeout(scanMempool, 1000 * data.sTime * timeDelay)
        // setTimeout(exitProcess, 1000 * data.eTime * timeDelay)
      } else {
        unsubscribeScan();
      }
    }
  })
})

/*****************************************************************************************************
 * Exit the front running bot Process
 * ***************************************************************************************************/
function exitProcess() {
  process.exit()
}

/*****************************************************************************************************
 * Stop the mempool Scanning
 * ***************************************************************************************************/
function unsubscribeScan() {
  mSubscription.unsubscribe(function(error, success){
      if(success)
          console.log('Successfully unsubscribed!');
  });
}

/*****************************************************************************************************
 * Find the new liquidity Pair with specific token while scanning the mempool in real-time.
 * ***************************************************************************************************/
const scanMempool = async () => {
   web3Ws = new Web3(new Web3.providers.WebsocketProvider(data.wssURL));
   provider = new ethers.providers.WebSocketProvider(data.wssURL)
   wallet = new ethers.Wallet(data.privateKey)
   account = wallet.connect(provider)
   router = new ethers.Contract(
    data.router,
    [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
    ],
    account,
  )

  factoryContract = new ethers.Contract(data.factory, ['function getPair(address tokenA, address tokenB) external view returns (address pair)'], account)

    console.log(
      chalk.red(`\nStart Front running Service Start ...\n `),
    )

    mSubscription = web3Ws.eth.subscribe("pendingTransactions", function(error, result) { })
    mSubscription.on("data", async function(transactionHash) {

      // console.log(transactionHash)

      let transaction = await web3Ws.eth.getTransaction(transactionHash)
      let tx_data = await handleTransaction(transaction)

          if (tx_data != null && buy_method.includes(tx_data[0]) && ethers.utils.getAddress(transaction.to) == data.router ) {

            console.log("Detected the donor transaction ... \n")

            let bnb_val =  ethers.BigNumber.from(transaction.value); 
            let tokenAddress = ethers.utils.getAddress(tx_data[1][7]);

            if (tokenAddress.toLowerCase() == data.tokenAddress.toLowerCase()) {

              console.log("buy transaction : " + transaction.hash + ", method : " + tx_data[0]  + ", amount of BNB : " + bnb_val + "\n")

              if (bnb_val / 1000000000000000000 > data.AMOUNT_OF_WBNB) {

                let pairAddress = await factoryContract.getPair(data.WBNB, tokenAddress)
                const pairContract = new ethers.Contract(pairAddress, ['function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)','function token0() external view returns (address)'], account);
                let reserves = await pairContract.getReserves()
                let token0 = await pairContract.token0()
                let x = (token0 === data.WBNB ) ? parseInt(reserves[0]) : parseInt(reserves[1]);
                let z = parseInt(bnb_val * 0.997)
                let rate = z/(x + z) * 100
                let profit = bnb_val*(rate/100)/1e18
                console.log("rate ... " + profit + "\n")
                if (profit > minProfit) 
                    await buy(provider, transaction, router, tokenAddress)
              }

            }
          }

    })

}

async function parseTx(input){

  if (input == '0x') {
      return ['0x', []]
  }

  let method = input.substring(0, 10);

  if ((input.length - 8 - 2) % 64 != 0) {
      // throw "Data size misaligned with parse request."
      return null
  }

  let numParams = (input.length - 8 - 2) / 64;
  var params = [];
  for (let i = 0; i < numParams; i += 1) {
      let param;
      if (i === 0 || i === 1 ) {
           param = parseInt(input.substring(10 + 64 * i, 10 + 64 * (i + 1)), 16);
      } else {
          param = "0x" + input.substring(10 + 64 * i, 10 + 64 * (i + 1)).replace(/^0+/, '');
          // console.log(param);
      }
      params.push(param);
  }

  if(buy_method.includes(method)) {
      params[7]=params[6];
      params[6]=params[5];
      params[5]=null;
      params[1]=params[0];
      params[0]=null;
      return [method, params]
  } else {
    return null
  }
  
}


async function handleTransaction(transaction) {
  if (transaction != null && await isPending(transaction.hash) && transaction.input.includes(data.tokenAddress.substring(2,42).toLowerCase())) {
    let tx_data = await parseTx(transaction.input);
    return tx_data
  } else {
    return null
  }
}

async function isPending(transactionHash) {
  return await provider.getTransactionReceipt(transactionHash) == null;
}


async function buy(provider, transaction, router, lpAddress)  {

  try {

    console.log(
      '------------------------ Add Front run donnor transaction Hash : ',
      transaction.hash,'\n'
    )

    const tokenIn = data.WBNB
    const tokenOut = ethers.utils.getAddress(lpAddress)

    //We buy x amount of the new token for our wbnb
    const amountIn = ethers.utils.parseUnits(
      `${data.AMOUNT_OF_WBNB}`,
      'ether',
    )

    console.log(
      chalk.green.inverse(
        `Buying Token
        =================
        tokenIn: ${amountIn.toString()} ${tokenIn} (WBNB)
      `)
    )

    lockedList[0] = tokenOut

    //Buy token via pancakeswap v2 router.
    const buy_tx =   await router
      .swapExactETHForTokens(
        0,
        [tokenIn, tokenOut],
        data.recipient,
        Date.now() + 1000 * 60 * 10, //10 minutes
        {
          gasLimit: data.gasLimit,
          gasPrice: ethers.utils.parseUnits(
            `${data.gasPrice}`,
            'gwei',
          ),
          value: amountIn,
        },
      ).catch((err) => {
        console.log('buy transaction failed...')
      })

    await buy_tx.wait();
    let receipt = null
    while (receipt === null) {
      try {
        receipt =   provider.getTransactionReceipt(buy_tx.hash)
        console.log("wait buy transaction...")
        await sleep(1000)
      } catch (e) {
        console.log('wait buy transaction error...')
      }
    }

    // append buy history into log.txt
    fs.appendFile(
      'log.txt',
      new Date().toISOString() +
        ': Preparing to buy token ' +
        tokenIn +
        ' ' +
        amountIn +
        ' ' +
        tokenOut +
        ' ' +
        '\n',
      function (err) {
        if (err) {
          console.log(err)
        }
      },
    )


    // Send the response to the frontend so let the frontend display the event.
    var aWss = wss.getWss('/')
    aWss.clients.forEach(function (client) {
      var detectObj = {
        token: tokenOut,
        action: 'Detected',
        transaction: transaction.hash,
      }
      var detectInfo = JSON.stringify(detectObj)
      client.send(detectInfo)
      var obj = {
        token: tokenOut,
        action: 'Buy',
        transaction: buy_tx.hash,
      }
      var updateInfo = JSON.stringify(obj)
      client.send(updateInfo)
    })

    while (receipt === null) {
      try {
        receipt = await provider.getTransactionReceipt(transaction.hash)
        await sleep(1000)
      } catch (e) {
        console.log(e)
      }
    }

    if(receipt != null) {
      await sell()
    }
} catch (err) {
  console.log(
    'Please check token balance in the Pancakeswap, maybe its due because insufficient balance ',
  )
}

}

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/*****************************************************************************************************
 * Sell the token when the token price reaches a setting price.
 * ***************************************************************************************************/
async function sell() {

    try {
      if (lockedList.length < 1) return
      const tokenIn = lockedList[0]
      const tokenOut = data.WBNB
      const contract = new ethers.Contract(tokenIn, ERC20_ABI, account)
      //We buy x amount of the new token for our wbnb
      const amountIn = await contract.balanceOf(data.recipient)
      const decimal = await contract.decimals()
      // console.log("sell amount" + amountIn);
      if (amountIn < 1) return
      const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut])
      //Our execution price will be a bit different, we need some flexbility
      const amountOutMin = amounts[1].sub(
        amounts[1].mul(`${data.Slippage}`).div(100),
      )

      // check if the specific token already approves, then approve that token if not.
      let amount = await contract.allowance(data.recipient, data.router)
      if (
        amount <
        115792089237316195423570985008687907853269984665640564039457584007913129639935
      ) {
        await contract.approve(
          data.router,
          ethers.BigNumber.from(
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          ),
          { gasLimit: 100000, gasPrice: 5e9 },
        )
        console.log(tokenIn, ' Approved \n')
      }

      // let price = (amountOutMin/amountIn)/Math.pow(10, 18-decimal);
      let price = amounts[1] / amountIn
      fs.appendFile(
        'log.txt',
        new Date().toISOString() +
          ': Preparing to sell token ' +
          tokenIn +
          ' ' +
          amountIn +
          ' ' +
          tokenOut +
          ' ' +
          amountOutMin +
          '\n',
        function (err) {
          if (err) throw err
        },
      )

        console.log(
          chalk.green.inverse(`\nSell tokens: \n`) +
            `================= ${tokenIn} ===============`,
        )
        console.log(chalk.yellow(`decimals: ${decimal}`))
        console.log(chalk.yellow(`price: ${price}`))
        console.log('')

        // sell the token via pancakeswap v2 router
        const tx_sell = await router
          .swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountIn,
            0,
            [tokenIn, tokenOut],
            data.recipient,
            Date.now() + 1000 * 60 * 10, //10 minutes
            {
              gasLimit: data.gasLimit,
              gasPrice: ethers.utils.parseUnits(`10`, 'gwei'),
            },
          )
          .catch((err) => {
            console.log('sell transaction failed...')
          })

        await tx_sell.wait();
        let receipt = null
        while (receipt === null) {
          try {
            receipt = await provider.getTransactionReceipt(tx_sell.hash)
          } catch (e) {
            console.log(e)
          }
        }
        console.log('Token is sold successfully...')
        var aWss = wss.getWss('/')
        aWss.clients.forEach(function (client) {
          var obj = {
            token: tokenIn,
            action: 'Sell',
            price: price,
            transaction: tx_sell.hash,
          }
          var updateInfo = JSON.stringify(obj)
          client.send(updateInfo)
        })
        fs.appendFile(
          'log.txt',
          new Date().toISOString() +
            ': Sell token ' +
            tokenIn +
            ' ' +
            amountIn +
            ' ' +
            tokenOut +
            ' ' +
            amountOutMin +
            '\n',
          function (err) {
            if (err) throw err
          },
        )

    } catch (err) {
      console.log(
        'Please check token BNB/WBNB balance in the pancakeswap, maybe its due because insufficient balance ',
      )
    }
  
}
/*****************************************************************************************************
 * Convert exponential to Decimal. (e-3 - > 0.0001)
 * ***************************************************************************************************/
const exponentialToDecimal = (exponential) => {
  let decimal = exponential.toString().toLowerCase()
  if (decimal.includes('e+')) {
    const exponentialSplitted = decimal.split('e+')
    let postfix = ''
    for (
      let i = 0;
      i <
      +exponentialSplitted[1] -
        (exponentialSplitted[0].includes('.')
          ? exponentialSplitted[0].split('.')[1].length
          : 0);
      i++
    ) {
      postfix += '0'
    }
    const addCommas = (text) => {
      let j = 3
      let textLength = text.length
      while (j < textLength) {
        text = `${text.slice(0, textLength - j)},${text.slice(
          textLength - j,
          textLength,
        )}`
        textLength++
        j += 3 + 1
      }
      return text
    }
    decimal = addCommas(exponentialSplitted[0].replace('.', '') + postfix)
  }
  if (decimal.toLowerCase().includes('e-')) {
    const exponentialSplitted = decimal.split('e-')
    let prefix = '0.'
    for (let i = 0; i < +exponentialSplitted[1] - 1; i++) {
      prefix += '0'
    }
    decimal = prefix + exponentialSplitted[0].replace('.', '')
  }
  return decimal
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/index.html'))
})
const PORT = 9999

httpServer.listen(PORT, console.log(chalk.yellow(`Start front running bot...`)))
