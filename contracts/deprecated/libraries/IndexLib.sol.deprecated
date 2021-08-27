//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../../IndexFund.sol";

library IndexLib {

    function getIndexPrice(
        address indexFund
    ) internal view returns (uint256 _price) {
        address router = IndexFund(payable(indexFund)).router();
        address indexToken = IndexFund(payable(indexFund)).indexToken();
        address weth = IUniswapV2Router02(router).WETH();
        uint256 totalSupply = IERC20Metadata(indexToken).totalSupply();

        address[] memory addrs = IndexFund(payable(indexFund)).getAddressesInPortfolio();
        string[] memory symbols = IndexFund(payable(indexFund)).getComponentSymbols();
        address[] memory path = new address[](2);
        path[1] = weth;
        for (uint256 i = 0; i < symbols.length; i++) {
            address componentAddress = addrs[i];
            path[0] = componentAddress;
            uint8 decimals = IERC20Metadata(componentAddress).decimals();

            uint256 componentBalanceOfIndexFund = totalSupply > 0
                ? IERC20Metadata(componentAddress).balanceOf(address(this))
                : 10 ** decimals;

            uint256[] memory amounts = IUniswapV2Router02(router).getAmountsOut(componentBalanceOfIndexFund, path);
            _price += amounts[1];
        }
        if (totalSupply > 0) {
            _price = (_price * 1e18) /  totalSupply;
        } else {
            _price /= symbols.length;
        }
    }
}