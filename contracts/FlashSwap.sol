// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Interfaces/IUniswapV2Pair.sol";
import "./Interfaces/IUniswapV2Factory.sol";
import "./Interfaces/IUniswapV2Router02.sol";
import "./libraries/UniswapV2Library.sol";
import "./Interfaces/IERC20.sol";

contract FlashSwap {
    using SafeMath for uint256;

    address immutable uniFactory;

    constructor(address _uniFactory) {
        uniFactory = _uniFactory;
    }

    // This function is called by IUniswapV2Pair contract after it transfered borrowed tokens to this contract.
    // Owed tokens have to be repaid to IUniswapV2Pair(msg.sender) by the end of this function.
    function uniswapV2Call(
        address _sender,
        uint256 _amount0,
        uint256 _amount1,
        bytes calldata _data
    ) external {
        require(_amount0 == 0 || _amount1 == 0);
        uint256 amountIn = _amount0 == 0 ? _amount1 : _amount0;

        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        require(
            msg.sender == UniswapV2Library.pairFor(uniFactory, token0, token1),
            "Unauthorized"
        );

        address[] memory path = new address[](2);
        path[0] = _amount0 == 0 ? token1 : token0; // token in
        path[1] = _amount0 == 0 ? token0 : token1; // token out

        // calculate minimum amount of tokenOut required to buy amountIn tokens of tokenIn
        address[] memory xpath = new address[](2);
        xpath[0] = path[1];
        xpath[1] = path[0];
        uint256 amountRequired = UniswapV2Library.getAmountsIn(
            uniFactory,
            amountIn,
            xpath
        )[0];

        address swapRouter = abi.decode(_data, (address)); // reverted if passed non-IUniswapV2Router02 contract?
        require(
            IERC20(path[0]).approve(swapRouter, amountIn),
            "Failed to approve amountIn tokens to sushi router"
        );
        uint256 amountSwapped = IUniswapV2Router02(swapRouter)
            .swapTokensForExactTokens(
                amountRequired,
                amountIn,
                path,
                msg.sender,
                block.timestamp
            )[0];
        //    console.log("In token amount swapped: %s", amountSwapped);

        require(
            IERC20(path[0]).transfer(_sender, amountIn - amountSwapped),
            "Failed to transfer rest of tokens to sender"
        );
    }
}
