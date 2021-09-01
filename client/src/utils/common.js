import UNISWAP_PAIR_JSON from '@uniswap/v2-core/build/UniswapV2Pair.json'
import ERC20_JSON from '../abis/ERC20.json'
import allAddrs from "../data/contractAddresses.json";
import {CONTRACTS, getInstance} from "./getContract";
import {BN, web3} from "../getWeb3";


export const _getSwapPath = (tokenSymbol, eth2Token = true) => {
    return eth2Token ? [allAddrs.WETH, allAddrs[tokenSymbol]] : [allAddrs[tokenSymbol], allAddrs.WETH]
};

export const calcFrontrunningPrevention = (expectedAmountsOut, tolerance) => {
    if(tolerance && parseFloat(tolerance) > 0.0) {
        const _tolerancePercent = BN(tolerance).mul(BN(10000)).div(BN(100))
        console.log('_tolerancePercent', _tolerancePercent.toString())
        if (expectedAmountsOut.length > 0) {
            const _minAmountsOutTolerated = expectedAmountsOut.map(amountOut =>
                BN(amountOut).sub(BN(amountOut).mul(_tolerancePercent).div(BN(10000))).toString()
            )
            return _minAmountsOutTolerated;
        }
    }
    return expectedAmountsOut
}


