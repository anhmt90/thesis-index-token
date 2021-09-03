import allAddrs from "../data/contractAddresses.json";
import {BN} from "../getWeb3";



export const _getSwapPath = (tokenSymbol, eth2Token = true) => {
    return eth2Token ? [allAddrs.WETH, allAddrs[tokenSymbol]] : [allAddrs[tokenSymbol], allAddrs.WETH]
};

export const calcArrayFRP = (expectedAmountsOut, tolerance) => {
    if (expectedAmountsOut.length > 0 && tolerance && parseFloat(tolerance) > 0.0) {
        const _tolerancePercent = BN(tolerance).mul(BN(10000)).div(BN(100))
        return expectedAmountsOut.map(amountOut =>
            BN(amountOut).sub(BN(amountOut).mul(_tolerancePercent).div(BN(10000))).toString()
        );
    } else if (!tolerance) {
        return []
    } else {
        return expectedAmountsOut
    }
}




//
//
// /**
//  * Assemble an object of (symbol -> token_price) of all tokens having liquidity pool on Uniswap.
//  */
// const assembleUniswapTokenSet = async () => {
//
//     // filter and keep only tokens that we know their addresses
//     const knownTokenSet = assembleTokenSet();
//     const knownTokenSymbols = new Set(Object.keys(knownTokenSet));
//     const knownItsaTokens = Object.entries(ITC_ERC20_TOKENS).filter(token => knownTokenSymbols.has(token.symbol));
//
//     /**
//      * From Uniswap's docs: The most obvious way to get the address for a pair is to call getPair
//      * on the factory. If the pair exists, this function will return its address, else address(0x0)
//      **/
//     const factoryContract = getContract(CONTRACTS.UNISWAP_FACTORY);
//     const uniswapTokenSet = {};
//     for (const itsaToken of knownItsaTokens) {
//         const symbol = itsaToken.symbol;
//         const poolAddr = await factoryContract.methods.getPair(knownTokenSet[symbol].address, _allAddrs.WETH).call();
//         if (parseInt(poolAddr) !== 0) {
//             uniswapTokenSet[symbol] = knownTokenSet[symbol];
//         }
//     }
//
//     return uniswapTokenSet;
// };


