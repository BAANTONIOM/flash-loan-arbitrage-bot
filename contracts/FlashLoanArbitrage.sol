// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import './IERC20.sol';
import './IUniswapV2Router02.sol';
import './IUniswapV2Pair.sol';
import './IUniswapV2Factory.sol';
import './UniswapV2Library.sol';
import "./SafeMath.sol";



interface IFlashLoanReceiver {
    function executeOperation(address _reserve, uint256 _amount, uint256 _fee, bytes calldata _params) external;
}
abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address constant ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    ILendingPoolAddressesProvider public addressesProvider;

    constructor(address _addressProvider) public {
        addressesProvider = ILendingPoolAddressesProvider(_addressProvider);
    }

    receive() payable external {}

    function transferFundsBackToPoolInternal(address _reserve, uint256 _amount) internal {
        address payable core = addressesProvider.getLendingPoolCore();
        transferInternal(core, _reserve, _amount);
    }

    function transferInternal(address payable _destination, address _reserve, uint256 _amount) internal {
        if(_reserve == ethAddress) {
            (bool success, ) = _destination.call{value: _amount}("");
            require(success == true, "Couldn't transfer ETH");
            return;
        }
        IERC20(_reserve).safeTransfer(_destination, _amount);
    }

    function getBalanceInternal(address _target, address _reserve) internal view returns(uint256) {
        if(_reserve == ethAddress) {
            return _target.balance;
        }
        return IERC20(_reserve).balanceOf(_target);
    }
}

contract FlashLoanArbitrage {

  //uniswap factory address
    address public factory;

    // trade deadline used for expiration
    uint deadline = block.timestamp + 100;

    //create pointer to the sushiswapRouter
    IUniswapV2Router02 public sushiSwapRouter;

    using SafeMath for uint256;
    IUniswapV2Router02 uniswapV2Router;
    IUniswapV2Router02 sushiswapV1Router;
    //uint deadline;
    IERC20 dai;
    address daiTokenAddress;
    uint256 amountToTrade;
    uint256 tokensOut;

    constructor(address _factory, address _sushiSwapRouter) {


    // create uniswap factory
    factory = _factory;  

    // create sushiswapRouter 
    sushiSwapRouter = IUniswapV2Router02(_sushiSwapRouter);
  }

    constructor(
          address _aaveLendingPool, 
          IUniswapV2Router02 _uniswapV2Router, 
          IUniswapV2Router02 _sushiswapV1Router
          ) FlashLoanReceiverBase(_aaveLendingPool) public {

              // instantiate SushiswapV1 and UniswapV2 Router02
              sushiswapV1Router = IUniswapV2Router02(address(_sushiswapV1Router));
              uniswapV2Router = IUniswapV2Router02(address(_uniswapV2Router));

              // setting deadline to avoid scenario where miners hang onto it and execute at a more profitable time
              deadline = block.timestamp + 300; // 5 minutes
    }

    function executeArbitrage() public {

        // Trade 1: Execute swap of Ether into designated ERC20 token on UniswapV2
        try uniswapV2Router.swapETHForExactTokens{ 
            value: amountToTrade 
        }(
            amountToTrade, 
            getPathForETHToToken(daiTokenAddress), 
            address(this), 
            deadline
        ){
        } catch {
            // error handling when arb failed due to trade 1
        }
        
        // Re-checking prior to execution since the NodeJS bot that instantiated this contract would have checked already
        uint256 tokenAmountInWEI = tokensOut.mul(1000000000000000000); //convert into Wei
        uint256 estimatedETH = getEstimatedETHForToken(tokensOut, daiTokenAddress)[0]; // check how much ETH you'll get for x number of ERC20 token
        
        // grant uniswap / sushiswap access to your token, DAI used since we're swapping DAI back into ETH
        dai.approve(address(uniswapV2Router), tokenAmountInWEI);
        dai.approve(address(sushiswapV1Router), tokenAmountInWEI);

        // Trade 2: Execute swap of the ERC20 token back into ETH on Sushiswap to complete the arb
        try sushiswapV1Router.swapExactTokensForETH (
            tokenAmountInWEI, 
            estimatedETH, 
            getPathForTokenToETH(daiTokenAddress), 
            address(this), 
            deadline
        ){
        } catch {
            // error handling when arb failed due to trade 2    
        }
    }

    function executeTrade(address token0, address token1, uint amount0, uint amount1) external {

      address pairAddress = IUniswapV2Factory(factory).getPair(token0, token1); 

      require(pairAddress != address(0), 'Could not find pool on uniswap'); 

      IUniswapV2Pair(pairAddress).swap(amount0, amount1, address(this), bytes('flashloan'));
    }

// Origin callback function
//function uniswapV2Call(address _sender, uint _amount0, uint _amount1, bytes calldata _data) external {

function uniswapV2Call(uint _amount0, uint _amount1) external {

  address[] memory path = new address[](2); 
  
  uint amountTokenBorrowed = _amount0 == 0 ? _amount1 : _amount0; 

  address token0 = IUniswapV2Pair(msg.sender).token0(); 
  address token1 = IUniswapV2Pair(msg.sender).token1(); 

  require(msg.sender == UniswapV2Library.pairFor(factory, token0, token1), 'Invalid Request');

  require(_amount0 == 0 || _amount1 == 0);

  path[0] = _amount0 == 0 ? token1 : token0; 
  path[1] = _amount0 == 0 ? token0 : token1; 

  IERC20 token = IERC20(_amount0 == 0 ? token1 : token0);
            
  token.approve(address(sushiSwapRouter), amountTokenBorrowed);

  uint amountRequired = UniswapV2Library.getAmountsIn(factory, amountTokenBorrowed, path)[0]; 

  uint amountReceived = sushiSwapRouter.swapExactTokensForTokens( amountTokenBorrowed, amountRequired, path, msg.sender, deadline)[1]; 

  IERC20 outputToken = IERC20(_amount0 == 0 ? token0 : token1);
 
  outputToken.transfer(msg.sender, amountRequired);   

  outputToken.transfer(tx.origin, amountReceived - amountRequired);  
 }
}