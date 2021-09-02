import {BN, toWei, web3} from "../getWeb3";

import {_getSwapPath} from "./common";
import {CONTRACTS, getInstance} from './getContract'
import allAddrs from "../data/contractAddresses.json";
import {queryIndexPrice} from "./estimations";
import ERC20_JSON from "../abis/ERC20.json";
import {getAmountOut} from "./simulateUniswap";

let cacheComponentAmountsOut = {};
let cacheComponentNAVs = {}

const queryUniswapTokenOut = async (tokenSymbol, amountEth) => {
    const path = _getSwapPath(tokenSymbol, true);
    const amounts = await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.getAmountsOut(amountEth, path).call();
    return amounts[1];
};


export const queryAllComponentAmountsOut = async (amountEthTotal) => {
    const currentPortfolio = await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call();
    const ethInForEach = BN(amountEthTotal).div(BN(currentPortfolio.length));

    let componentAmountsOut = [];
    for (const componentSymbol of currentPortfolio) {
        const amountOut = await queryUniswapTokenOut(componentSymbol, ethInForEach);
        componentAmountsOut.push(amountOut);
    }
    return componentAmountsOut;
}


export const queryAllComponentNAVs = async (amountDFAM) => {
    const indexPrice = await queryIndexPrice();
    const componentSymbols = await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call();
    const navOutForEach = BN(amountDFAM).mul(BN(indexPrice)).div(BN(toWei('1'))).div(BN(componentSymbols.length)).toString();

    const routerInstance = getInstance(CONTRACTS.UNISWAP_ROUTER);
    let componentNAVs = []
    const path = ['', allAddrs.WETH]
    for (const symbol of componentSymbols) {
        path[0] = allAddrs[symbol];
        const amounts = await routerInstance.methods.getAmountsIn(navOutForEach, path).call();
        let amountToSell = amounts[0];
        const componentBalanceOfIndexFund = await getInstance(CONTRACTS[symbol]).methods.balanceOf(allAddrs.indexFund).call();
        if (BN(amountToSell).gt(BN(componentBalanceOfIndexFund)))
            amountToSell = componentBalanceOfIndexFund;

        // const [reserveTokenUpdated, reserveWETHUpdated]= await swapExactTokensForETH(symbol, amountToSell)
        const pair = await getInstance(CONTRACTS.UNISWAP_FACTORY).methods.getPair(path[0], path[1]).call();
        let reserveComponent = await (new web3.eth.Contract(ERC20_JSON.abi, path[0])).methods.balanceOf(pair).call();
        let reserveWETH = await (new web3.eth.Contract(ERC20_JSON.abi, path[1])).methods.balanceOf(pair).call();
        const componentNAV = getAmountOut(amountToSell, reserveComponent, reserveWETH);
        componentNAVs.push(componentNAV);
    }
    return componentNAVs;
}