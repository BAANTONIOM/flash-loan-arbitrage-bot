"use strict";
const ethers = require("ethers");
const clear = require('clear');
var colors = require('colors');
const ps = require("prompt-sync");
const prompt = ps({ sigint: true });
const fs = require('fs')
require("dotenv").config();
const axios = require('axios')

const purchaseToken = process.env.purchaseToken;
const purchaseAmount = ethers.utils.parseUnits(process.env.purchaseAmount,"ether");
const recipient = process.env.recipient;
const wbnb = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const pcs = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const pcsAbi = new ethers.utils.Interface(require("./abi.json"));
const EXPECTED_PONG_BACK = 30000;
const KEEP_ALIVE_CHECK_INTERVAL = 15000;
const provider = new ethers.providers.WebSocketProvider(process.env.websocket);
const wallet = new ethers.Wallet(process.env.privatekey);
const account = wallet.connect(provider);
const router = new ethers.Contract(pcs, pcsAbi, account);
const slippage = process.env.slippage;
const selloption = process.env.mode;
const selltimer = process.env.selltimer;
const buytimer = process.env.waitbeforebuy;
var trade = 'true';
trade = "false";
let j = 0;
let swapETHForExactTokens = new RegExp("^0xfb3bdb41");
let swapExactETHForTokens = new RegExp("^0x7ff36ab5");
let swapExactETHForTokensSupportingFeeOnTransferTokens = new RegExp("^");
let swapExactTokensForETH = new RegExp("^0x18cbafe5");
let swapExactTokensForETHSupportingFeeOnTransferTokens = new RegExp("^");
let swapExactTokensForTokens = new RegExp("^0x38ed1739");
let swapExactTokensForTokensSupportingFeeOnTransferTokens = new RegExp("^0x5c11d795");
let swapTokensForExactETH = new RegExp("^");
let swapTokensForExactTokens = new RegExp("^0x8803dbee");
let buy = new RegExp("^0xa6f2ae3a");
let pinkfinalize = new RegExp("^0x4bb278f3");
let dxfinalize = new RegExp("^0x267dd102");
let dxafterpresale = new RegExp("^0x07efbfdc");
let liq = /INSUFFICIENT_LIQUIDITY/;
let not_enough_bnb = /insufficient funds for intrinsic transaction cost/

const approve = new ethers.Contract(
  purchaseToken,
  [
    'function approve(address spender, uint amount) public returns(bool)',
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() view returns (uint8)",
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    "function name() view returns (string)",
    "function symbol() view returns (string)",
  ],
  account
);

const startWSS = (eventt, contrct) => {
  let pingTimeout = null;
  let keepAliveInterval = null;
  provider._websocket.on("open", () => {
    keepAliveInterval = setInterval(() => {
      provider._websocket.ping();
      pingTimeout = setTimeout(() => {
        provider._websocket.terminate();
      }, EXPECTED_PONG_BACK);
    }, KEEP_ALIVE_CHECK_INTERVAL);
    console.log("Scanning mempool...".cyan);

    provider.on("pending", async (txHash) => {
      provider.getTransaction(txHash).then(async (tx) => {
        if (tx && tx.to) {
          if (tx.to === contrct) {
            let re = new RegExp("^0xf305d719");
            let me = new RegExp("^0xe8e33700");
            let he = new RegExp("^0x267dd102");
            if (re.test(tx.data) || me.test(tx.data)|| he.test(tx.data)) {
              const decodedInput = pcsAbi.parseTransaction({
                data: tx.data,
                value: tx.value,
              });
              try {
              if (purchaseToken.toLowerCase() === decodedInput.args[0].toLowerCase() || purchaseToken.toLowerCase() === decodedInput.args[1].toLowerCase()) {
                console.log("The right conditions have been met!".green);
                try {
                  if (j < 1) {
                    const gwei = (ethers.utils.formatEther(tx.gasPrice)*1000000000)+ "";
                    j++;
                    await BuyToken(gwei);
                }}
                catch(e){j = 0}
              }}
              catch(e)
              {
              }
            } else if (swapETHForExactTokens.test(tx.data) || swapExactETHForTokens.test(tx.data)|| swapExactTokensForETH.test(tx.data)|| swapExactTokensForTokens.test(tx.data)|| swapExactTokensForTokensSupportingFeeOnTransferTokens.test(tx.data)|| swapTokensForExactTokens.test(tx.data)|| buy.test(tx.data)) {
              const decodedInput = pcsAbi.parseTransaction({
                data: tx.data,
                value: tx.value,
              });
              try {
                if (purchaseToken.toLowerCase() === decodedInput.args[1][1].toLowerCase() || purchaseToken.toLowerCase() === decodedInput.args[1][0].toLowerCase() || purchaseToken.toLowerCase() === decodedInput.args[1][2].toLowerCase() || purchaseToken.toLowerCase() === decodedInput.args[1][3].toLowerCase()) {
                  let txn_test = await provider.waitForTransaction(tx.hash);
                  if (txn_test.status != 0) {
                    if (j < 1) {
                      j++;
                      console.log("Traiding is unlocked!".green, txn_test.transactionHash);
                      await BuyToken(process.env.gasprice);                   
                    }
                  }
                };
              }
              catch(e)
              {
              }
            }
          }
        }
      });
    });
  });

  provider._websocket.on("close", () => {
    console.log("WebSocket Closed...Reconnecting...");
    clearInterval(keepAliveInterval);
    clearTimeout(pingTimeout);
    startWSS();
  });

  provider._websocket.on("error", () => {
    console.log("Error. Attemptiing to Reconnect...");
    clearInterval(keepAliveInterval);
    clearTimeout(pingTimeout);
    startWSS();
  });

  provider._websocket.on("pong", () => {
    clearInterval(pingTimeout);
  });
};

const startWSSpink = (contrct, finalize1, finalize2) => {
  let pingTimeout = null;
  let keepAliveInterval = null;
  provider._websocket.on("open", () => {
    keepAliveInterval = setInterval(() => {
      provider._websocket.ping();
      pingTimeout = setTimeout(() => {
        provider._websocket.terminate();
      }, EXPECTED_PONG_BACK);
    }, KEEP_ALIVE_CHECK_INTERVAL);
    console.log("Scanning mempool...".cyan);

    provider.on("pending", async (txHash) => {
      provider.getTransaction(txHash).then(async (tx) => {
        if (tx && tx.to) {
          if (tx.to === contrct || tx.to === pcs) {
            if (pinkfinalize.test(tx.data)) {
              console.log("finalize was found", tx.hash)
              try {
                if (j < 1) {
                  const gwei = (ethers.utils.formatEther(tx.gasPrice)*1000000000)+ "";
                  j++;
                  await BuyToken(gwei);
              }}
              catch(e)
              { j = 0;
              }
            } else if (swapETHForExactTokens.test(tx.data) || swapExactETHForTokens.test(tx.data)|| swapExactTokensForETH.test(tx.data)|| swapExactTokensForTokens.test(tx.data)|| swapExactTokensForTokensSupportingFeeOnTransferTokens.test(tx.data)|| swapTokensForExactTokens.test(tx.data)|| buy.test(tx.data)) {
              const decodedInput = pcsAbi.parseTransaction({
                data: tx.data,
                value: tx.value,
              });
              try {
                if (purchaseToken.toLowerCase() === decodedInput.args[1][1].toLowerCase() || purchaseToken.toLowerCase() === decodedInput.args[1][0].toLowerCase() || purchaseToken.toLowerCase() === decodedInput.args[1][2].toLowerCase() || purchaseToken.toLowerCase() === decodedInput.args[1][3].toLowerCase()) {
                  let txn_test = await provider.waitForTransaction(tx.hash);
                  if (txn_test.status != 0) {
                    if (j < 1) {
                      j++;
                      console.log("Traiding is unlocked!".green, txn_test.transactionHash);
                      await BuyToken(process.env.gasprice);                   
                    }
                  }
                };
              }
              catch(e)
              {
              }
            }
          }
        }
      });
    });
  });

  provider._websocket.on("close", () => {
    console.log("WebSocket Closed...Reconnecting...");
    clearInterval(keepAliveInterval);
    clearTimeout(pingTimeout);
    startWSSpink();
  });

  provider._websocket.on("error", () => {
    console.log("Error. Attemptiing to Reconnect...");
    clearInterval(keepAliveInterval);
    clearTimeout(pingTimeout);
    startWSSpink();
  });

  provider._websocket.on("pong", () => {
    clearInterval(pingTimeout);
  });
};

const Simplebuy = async () => {
  if (process.env.honeypotscan === 'true'){
    const dog = await Honeypotscan(`https://honeypot.api.rugdoc.io/api/honeypotStatus.js?address=${purchaseToken}&chain=bsc`);
    if (trade == 'false') {
      process.exit(1);
    };
  };
  try {
  const symbol = await approve.symbol();
  const amountsss = await router.getAmountsOut(purchaseAmount, [wbnb, purchaseToken]);
  const amountOutMin = (Math.floor(amountsss[1].sub(amountsss[1].div(`${slippage}`)))).toLocaleString('fullwide', {useGrouping:false});
  const tx = await router.swapExactTokensForTokens(
    purchaseAmount,
    amountOutMin,
    [wbnb, purchaseToken],
    recipient,
    Date.now() + 1000 * 60 * 5,
    {
      gasLimit: process.env.gaslimit,
      gasPrice: ethers.utils.parseUnits(process.env.gasprice, "gwei"),
    }
  );
  console.log('\x1b[32m%s',"Buying", symbol, "with a slippage of", slippage, "%");
  console.log('\x1b[32m%s\x1b[32m\x1b[0m','Buy order send: '+ tx.hash)
  const receiptet = await tx.wait();
  console.log('\x1b[32m%s\x1b[32m\x1b[0m','Buy order confirmed: '+ receiptet.transactionHash);
  } catch (e) {
    console.log(e);
    if (not_enough_bnb.test(e)) {
      console.log('\x1b[31m%s\x1b[31m\x1b[0m','Error: insufficient BNB for intrinsic transaction cost, you dont hold enough BNB in your wallet')
  };
 }
  process.exit();
};

const Simpleapprove = async () => {
  try {
  const symbol = await approve.symbol();
  console.log('\x1b[33m%s',"Approving", symbol);
  const appr = await approve.approve(router.address, ethers.constants.MaxUint256, {
    gasLimit: process.env.gaslimit,
    gasPrice: ethers.utils.parseUnits(process.env.gasprice, "gwei"),
  });
  const receiptet = await appr.wait();
  console.log('\x1b[33m%s\x1b[33m\x1b[0m','Approve order confirmed: '+ receiptet.transactionHash);
  } catch (e) {
    console.log(e);
    if (not_enough_bnb.test(e)) {
      console.log('\x1b[31m%s\x1b[31m\x1b[0m','Error: insufficient BNB for intrinsic transaction cost, you dont hold enough BNB in your wallet')
  };
  }
  process.exit();
};

const Simplesell = async () => {
  try {
  const symbol = await approve.symbol();
  const amountsss = await router.getAmountsOut(purchaseAmount, [purchaseToken, wbnb]);
  const amountOutMin = (Math.floor(amountsss[1].sub(amountsss[1].div(`${slippage}`)))).toString();
  const tx = await router.swapExactTokensForTokens(
    purchaseAmount,
    amountOutMin,
    [purchaseToken, wbnb],
    recipient,
    Date.now() + 1000 * 60 * 5,
    {
      gasLimit: process.env.gaslimit,
      gasPrice: ethers.utils.parseUnits(process.env.gasprice, "gwei"),
    }
  );
  console.log('\x1b[31m%s',"Selling", symbol, "with a slippage of", slippage, "%");
  console.log('\x1b[31m%s\x1b[31m\x1b[0m','Sell order send: '+ tx.hash)
  const receiptet = await tx.wait();
  console.log('\x1b[31m%s\x1b[31m\x1b[0m','Sell order confirmed: '+ receiptet.transactionHash);
  } catch (e) {
    console.log(e);
    if (not_enough_bnb.test(e)) {
      console.log('\x1b[31m%s\x1b[31m\x1b[0m','Error: insufficient BNB for intrinsic transaction cost, you dont hold enough BNB in your wallet')
  };
}
  process.exit();
};

const BuyToken = async (gasss) => {
  if (process.env.honeypotscan === 'true'){
    const dog = await Honeypotscan(`https://honeypot.api.rugdoc.io/api/honeypotStatus.js?address=${purchaseToken}&chain=bsc`);
    if (trade == 'false') {
      process.exit(1);
    };
  };
  if (buytimer > '0') {
    console.log(`Waiting ${buytimer} seconds, before buying`.green);
    const timerr = (buytimer + '000');
    await sleep(timerr);
  };
  const amountOutMin = "0";
  try {
    const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      amountOutMin,
      [wbnb, purchaseToken],
      recipient,
      Date.now() + 1000 * 60 * 5,
      {
        value: purchaseAmount,
        gasLimit: process.env.gaslimit,
        gasPrice: ethers.utils.parseUnits(gasss, "gwei"),
      }
    );
    const name = await approve.name();
    console.log(`Your buy order for ${name}:`.green, tx.hash);
    const appr = await approve.approve(router.address, ethers.constants.MaxUint256, {
      gasLimit: process.env.gaslimit,
      gasPrice: ethers.utils.parseUnits(process.env.gasprice, "gwei"),
    });
    console.log(`Your approve order for ${name}:`.yellow, appr.hash);
    console.log("Waiting for buy transaction to confirm\n".yellow);
    const receiptet = await tx.wait();
  console.log('Buy order confirmed: '+ receiptet.transactionHash);
  const balance = await approve.balanceOf(process.env.recipient);
  const sellamout = (Math.floor(balance / 10 * 9.9)).toString();
  const amountss = await router.getAmountsOut(balance, [purchaseToken, wbnb]);
  const buyprice = ethers.utils.formatEther(amountss[1])
  const symbol = await approve.symbol();
  const normal = [parseFloat(ethers.utils.formatEther(amountss[0])), parseFloat(ethers.utils.formatEther(amountss[1]))];
  console.log("You currently hold", normal[0].toFixed(4), symbol, "worth", normal[1].toFixed(5),"bnb");
  
  if (selloption == 1) {
    if (selltimer > '0') {
      console.log('\x1b[31m%s',`Waiting ${selltimer} seconds before selling`);
      const timer = (selltimer + '000')
      await sleep(timer);
    };
  } else if (selloption == 2) {
    let i = 0;
    while (i < 1) {
      const data = fs.readFileSync('sell.txt', 'utf8');
      if (data.includes('sell')){
        i++;
      }

      const balance = await approve.balanceOf(process.env.recipient);
      const amountss = await router.getAmountsOut(balance, [purchaseToken, wbnb]);
      const normal = [parseFloat(ethers.utils.formatEther(amountss[0])), parseFloat(ethers.utils.formatEther(amountss[1]))];
      const profit = Math.floor(((normal[1] - buyprice) / normal[1]) * 100);
      console.log("You currently hold", normal[0].toFixed(4), symbol, "worth", normal[1].toFixed(5),"bnb" , `${profit}%`);
  }} else if ((selloption == 3)) {
      console.log('HODL!!!!'.cyan);
      process.exit();
  };

  const amountsss = await router.getAmountsOut(balance, [purchaseToken, wbnb]);
  console.log('\x1b[31m%s',"Selling", symbol, "with a slippage of", slippage, "%");
  const sellamountOutMin = (Math.floor(amountsss[1].sub(amountsss[1].div(`${slippage}`)))).toString();
  const sell = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
    sellamout,
    sellamountOutMin,
    [purchaseToken, wbnb],
    recipient,
    Date.now() + 1000 * 60 * 5,
    {
      gasLimit: process.env.gaslimit,
      gasPrice: ethers.utils.parseUnits(process.env.gasprice, "gwei"),
    }
  );
  console.log('\x1b[31m%s\x1b[0m',`Your sell order for ${name}: `, sell.hash);
  const content = "";
  const datssss = fs.writeFileSync('sell.txt', content);
  } catch (e) {
    console.log(e);
    if (not_enough_bnb.test(e)) {
      console.log('\x1b[31m%s\x1b[31m\x1b[0m','Error: insufficient BNB for intrinsic transaction cost, you dont hold enough BNB in your wallet')
  };
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const WSSspeed = async () => {
  try {
  console.time('WSS speed')
  const symbol = await approve.symbol();
  console.timeEnd('WSS speed')
  } catch (e) { console.log(e);}
  process.exit(1);
};

const Honeypotscan = async (url) => {
  await axios.get(url)
    .then(result => {
      if (result.data.status == 'OK') {
        console.log('\x1b[33m%s\x1b[0m', `No honeypot detected`)
        trade = 'true';
      } else if (result.data.status == 'SWAP_FAILED') {
        trade = 'false';
        console.log('\x1b[33m%s\x1b[0m','Failed to sell the token. This is very likely a honeypot.')
        return trade
      } else if (result.data.status == 'MEDIUM_FEE') {
        trade = 'true';
        console.log('\x1b[33m%s\x1b[0m','A medium trading fee was detected 15-20%. Token is able to swap')
      } else if (result.data.status == 'HIGH_FEE') {
        trade = 'false';
        console.log('\x1b[33m%s\x1b[0m','A high trading fee was detected 20-50%. Not traiding')
      } else if (result.data.status == 'SEVERE_FEE') {
        trade = 'false';
        console.log('\x1b[33m%s\x1b[0m','A high trading fee over 50% was detected.')
      } else if (result.data.status == 'NO_PAIRS') {
        console.log('\x1b[33m%s\x1b[0m','This token does not have a pair yet.')
        trade = 'false';
      } else {
        console.log(result.data.status)
        console.log('\x1b[33m%s\x1b[0m','Unable to read status code. Please contact Snipesz support team to fix this.')
        trade = 'false';
      };
    })
    .catch(error => {
        console.log(error)
    });
}

const startmenu = async () => {
  clear();
const starting = () => {
    console.log('\x1b[36m%s\x1b[0m',`\n  ███████╗███╗   ██╗██╗██████╗ ███████╗███████╗███████╗
  ██╔════╝████╗  ██║██║██╔══██╗██╔════╝██╔════╝╚══███╔╝
  ███████╗██╔██╗ ██║██║██████╔╝█████╗  ███████╗  ███╔╝ 
  ╚════██║██║╚██╗██║██║██╔═══╝ ██╔══╝  ╚════██║ ███╔╝  
  ███████║██║ ╚████║██║██║     ███████╗███████║███████╗
  ╚══════╝╚═╝  ╚═══╝╚═╝╚═╝     ╚══════╝╚══════╝╚══════╝
`)};

starting();
console.log('Please input what you want.\n 1) Fair launch\n 2) Dxsale\n 3) Pinkswap \n 4) Simple buy order\n 5) Simple approve order\n 6) Simple sell order\n 7) Honeypot scan\n 8) WSS speed check');

let menu = prompt("");

if (menu == '1') {
  clear();
  starting();
  console.log('Please input what you would like to snipe.\n 1) Pancakeswap\n 2) Testnet')
  let menu_fairlaunch = prompt("");
  if (menu_fairlaunch == '1') {
    clear();
    starting();
    console.log('Starting a fair launch snipe!');
    startWSS("^0xf305d719", "0x10ED43C718714eb63d5aA57B78B54704E256024E");
  } else if (menu_fairlaunch == '2') {
    clear();
    starting();
    console.log('Starting a testnet snipe! Make sure you are using a testnet websocket! https://pancake.kiemtienonline360.com/');
    startWSS("^0xf305d719", "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3");
  } else {
    clear();
    starting();
    console.log('Not a valid option, exiting');
    process.exit(1)
  }
} else if (menu == '2') {
  clear();
  starting();
  console.log('Dxsale snipe it is!');
  startWSSpink("0xbaCEbAd5993a19c7188Db1cC8D0F748C9Af1689A", dxfinalize, dxafterpresale);
  
} else if (menu == '3') {
  clear();
  starting();
  console.log('Pinksale snipe it is! Please enter the presale address:');
  let pinksale_presale = prompt("");
  startWSSpink(pinksale_presale, pinkfinalize, 'empty');
  
} else if (menu == '4') {
  clear();
  starting();
  console.log('Starting a simple buy order!');
  Simplebuy();
} else if (menu == '5') {
  clear();
  starting();
  console.log('Starting a simple approve order!');
  Simpleapprove();
} else if (menu == '6') {
  clear();
  starting();
  console.log('Starting a simple sell order!');
  Simplesell();
} else if (menu == '7') {
  clear();
  starting();
  console.log('Checking if token is honeypot......');
  Honeypotscan(`https://honeypot.api.rugdoc.io/api/honeypotStatus.js?address=${purchaseToken}&chain=bsc`);
} else if (menu == '8') {
  clear();
  starting();
  console.log('Checking wss speed');
  WSSspeed();
} 
 else {
  clear();
  starting();
  console.log('Not a valid option, exiting');
  process.exit(1)
}};

startmenu();
