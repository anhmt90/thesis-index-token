import allAddrs from "../data/contractAddresses.json";
import {BN} from "../getWeb3";

import {_getSwapPath} from "./common";
import {CONTRACTS, getInstance} from './getContract'
import {tokenUnits2Float} from './conversions'


const queryUniswapTokenOut = async (tokenSymbol, amountEth) => {
    const path = _getSwapPath(tokenSymbol, true);
    const amounts = await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.getAmountsOut(amountEth, path).call();
    return amounts[1];
};


export const queryAllComponentAmountsOut = async (amountEthTotal) => {
    const currentPortfolio = await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call();
    const ethInForEach = BN(amountEthTotal).div(BN(currentPortfolio.length));
    const componentAmountsOut = [];
    for (const componentSymbol of currentPortfolio) {
        const amountOut = await queryUniswapTokenOut(componentSymbol, ethInForEach);
        const decimals = await getInstance(CONTRACTS[componentSymbol]).methods.decimals().call()
        componentAmountsOut.push(parseFloat(tokenUnits2Float(amountOut, decimals)));
    }
    return componentAmountsOut;
}