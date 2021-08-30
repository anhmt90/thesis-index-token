import allAddrs from "../data/contractAddresses.json";
import { BN } from "../getWeb3";

import { CONTRACTS, getInstance } from './getContract'

// const web3 = getWeb3().then(_web3 => _web3);

const _getSwapPathAndRouterContract = (tokenSymbol, eth2Token = true) => {
    const tokenAddr = allAddrs[tokenSymbol];
    const path = eth2Token ? [allAddrs.WETH, tokenAddr] : [tokenAddr, allAddrs.WETH];
    const routerContract = getInstance(CONTRACTS.UNISWAP_ROUTER);
    return [path, routerContract];
};

const queryUniswapTokenOut = async (tokenSymbol, amountEth) => {
    const [path, routerContract] = _getSwapPathAndRouterContract(tokenSymbol, true);
    const amounts = await routerContract.methods.getAmountsOut(amountEth, path).call();
    const amountTokenOut = amounts[1];
    return amountTokenOut;
};


export const queryAllComponentAmountsOut = async (amountEthTotal) => {
    const currentPortfolio = (await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call());
    const ethInForEach = BN(amountEthTotal).div(BN(currentPortfolio.length));
    const componentAmountsOut = [];
    for (const componentSymbol of currentPortfolio) {
        const amountOut = await queryUniswapTokenOut(componentSymbol, ethInForEach);
        componentAmountsOut.push(amountOut);
    }
    return componentAmountsOut;
}