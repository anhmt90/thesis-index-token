import allAddrs from "../data/contractAddresses.json";
import {BN} from "../getWeb3";


export const _getSwapPath = (tokenSymbol, eth2Token = true) => {
    return eth2Token ? [allAddrs.WETH, allAddrs[tokenSymbol]] : [allAddrs[tokenSymbol], allAddrs.WETH]
};

export const calcFrontrunningPrevention = (expectedAmountsOut, tolerance) => {
    if(tolerance && parseFloat(tolerance) > 0.0) {
        const _tolerancePercent = BN(tolerance).mul(BN(10000)).div(BN(100))
        console.log('_tolerancePercent', _tolerancePercent.toString())
        if (expectedAmountsOut.length > 0) {
            return expectedAmountsOut.map(amountOut =>
                BN(amountOut).sub(BN(amountOut).mul(_tolerancePercent).div(BN(10000))).toString()
            );
        }
    } else if(!tolerance) {
        return []
    } else {
        return expectedAmountsOut
    }
}


