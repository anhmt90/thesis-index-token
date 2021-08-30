import allAddrs from "../data/contractAddresses.json";
import {web3, BN} from "../getWeb3";

import {CONTRACTS, getInstance} from './getContract'


const float2TokenUnits = (num, decimals = 18) => {
    let [integral, fractional] = String(num).split('.');
    if (fractional === undefined) {
        return integral + '0'.repeat(decimals);
    }
    fractional = fractional + '0'.repeat(decimals - fractional.length);
    return integral !== '0' ? integral + fractional : fractional;
};

const tokenUnits2Float = (num, decimals = 18) => {
    if(typeof decimals === 'string') {
        decimals = parseInt(decimals)
    }
    if(num.length > decimals) {
        return num.slice(0, num.length - decimals) + '.' + num.slice(num.length - decimals)
    } else {
        return '0.' + '0'.repeat(decimals - num.length) + num
    }
}

const _getSwapPath = (tokenSymbol, eth2Token = true) => {
    return eth2Token ? [allAddrs.WETH, allAddrs[tokenSymbol]] : [allAddrs[tokenSymbol], allAddrs.WETH]
};

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