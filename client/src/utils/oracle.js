import PREV_PRICES from "../data/tokenPrices-0.json"
import {float2TokenUnits} from "./conversions";
import {_getSwapPath} from "./common";
import {CONTRACTS, getABI, getAddress, getInstance} from "./getContract";
import {BN, toWei} from "../getWeb3";

const ITC_EIN_V100 = 'itc_ein_v100';
const ECONOMIC_DIM_GROUP = 'E';
const EIN = ECONOMIC_DIM_GROUP + 'IN';
const EIN_FININS = EIN + '06';
const EIN_FININS_DEFI = EIN_FININS + 'DF';
const EIN_FININS_DEFI__LENDINGSAVING = EIN_FININS_DEFI + '02';

let curPortfolio;

const queryUniswapPriceInEth = async (tokenSymbol) => {
    const path = _getSwapPath(tokenSymbol, true);
    console.log('1')
    const amounts = await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.getAmountsOut(toWei('1'), path).call();
    console.log('2')
    console.log('tokenSymbol', tokenSymbol)
    const decimals = await getInstance(CONTRACTS[tokenSymbol]).methods.decimals().call();
    console.log('3')
    return BN(toWei('1')).mul(BN(float2TokenUnits('1', decimals))).div(BN(amounts[1])).toString();
};

export const queryCurrentPrices = async () => {
    const currentPrices = {};
    for (const symbol of Object.keys(PREV_PRICES)) {
        currentPrices[symbol] = await queryUniswapPriceInEth(symbol);
    }
    return currentPrices;
}

const _compareComponent = (a, b) => {
    if (a.diffPercent.gt(b.diffPercent)) return -1;
    if (a.diffPercent.lt(b.diffPercent)) return 1;
    if (a.diffPercent.eq(b.diffPercent)) {
        if ((curPortfolio.has(a.symbol) && curPortfolio.has(b.symbol)) || (!curPortfolio.has(a.symbol) && !curPortfolio.has(b.symbol)))
            return 0;
        if (curPortfolio.has(a.symbol) && !curPortfolio.has(b.symbol))
            return -1;
        if (!curPortfolio.has(a.symbol) && curPortfolio.has(b.symbol))
            return 1;
    }
};

export const computePriceDiffPercents = async (prevPrices, curPrices) => {
    if (!curPortfolio || curPortfolio.length !== 0)
        curPortfolio = new Set(await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call());

    const _priceDiffPercents = [];
    console.log('prevPrices', prevPrices)
    console.log('curPrices', curPrices)
    for (const [symbol, curPrice] of Object.entries(curPrices)) {
        const prevPrice = BN(prevPrices[symbol]);
        const diff = BN(curPrice).sub(prevPrice);
        _priceDiffPercents.push({
            symbol,
            diffPercent: diff.mul(BN(toWei('1'))).div(prevPrice).mul(BN(100))
        })
    }

    _priceDiffPercents.sort(_compareComponent);
    console.log("PRICE DIFFS 1 ===> ", _priceDiffPercents);
    const priceDiffPercents = {};
    _priceDiffPercents.map(function({symbol, diffPercent}) {
        priceDiffPercents[symbol] = diffPercent;
    })

    console.log("PRICE DIFFS 2 ===> ", Object.entries(priceDiffPercents).map(([symbol, diffPercent]) => symbol + ': ' + diffPercent));
    return priceDiffPercents
}


export const selectNewPortfolio = async (curPrices, priceDiffPercents) => {
    // await fetchEthereumTokens([`${ITC_EIN_V100}=${EIN_FININS_DEFI__LENDINGSAVING}`]);
    // how to get the token contract addresses on the tokens fetched from ITSA --> manually from Etherscan

    /**
     * check which tokens have Uniswap pools
     *
     * Note: we usually knew already if a token is on Uniswap since we had to look for its
     * contract address using a side channel e.g. manually or over etherscan APIs, at that time, we could
     * also make a check for WETH/Token pool on Uniswap and mark the result for later use such as currently.
     * However, to make it realistic, we carry this check anyway here.
     **/

    const prevPrices = PREV_PRICES
    console.log("PREVIOUS PRICES ===> ", prevPrices);

    if (!curPrices || curPrices.length === 0) {
        curPrices = await queryCurrentPrices;
        console.log("CURRENT PRICES ===> ", curPrices);
    }

    if (!priceDiffPercents || Object.keys(priceDiffPercents).length === 0)
        priceDiffPercents = await computePriceDiffPercents(prevPrices, curPrices);

    priceDiffPercents = Object.entries(priceDiffPercents).map(([symbol, diffPercent]) => ({symbol, diffPercent}))

    curPortfolio = new Set(await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call());

    console.log("SORTED PRICE DIFFS ===> ", priceDiffPercents.map(({
                                                                       symbol,
                                                                       diffPercent
                                                                   }) => diffPercent.toString() + '_' + symbol));

    // get new portfolio from based off the sorted price difference percentages
    const newPortfolio = [];
    for (const {symbol, _} of priceDiffPercents) {
        if (newPortfolio.length >= curPortfolio.size)
            break;
        newPortfolio.push(symbol);
    }
    console.log("NEW PORTFOLIO ===> ", newPortfolio);

    return newPortfolio;
};

export const deriveSubbedOutAndSubbedInComponents = async (newPortfolio) => {
    // get current portfolio onchain
    const curPortfolio = await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call();

    // derive substituted components (components out) from current portfolio
    const newPortfolioSet = new Set(newPortfolio);
    const componentsOut = curPortfolio.filter(component => !newPortfolioSet.has(component));
    console.log("REMOVED COMPONENTS ===> ", componentsOut);

    if (componentsOut.length === 0) {
        console.log("Portfolio in good form, update not necessary!");
        return [[], []];
    }

    // derive new components that are not in the current portfolio (components in)
    const curPortfolioSet = new Set(curPortfolio);
    const componentsIn = newPortfolio.filter(component => !curPortfolioSet.has(component));
    console.log("NEW COMPONENTS ===> ", componentsIn);

    return [componentsOut, componentsIn];
};


// const decidePortfolioSubstitution = async (newPortfolio) => {
//     let [componentsOut, componentsIn] = await _deriveSubbedOutAndSubbedInComponents(newPortfolio);
//     componentsOut = new Set(componentsOut);
//     componentsIn = new Set(componentsIn);
//
//     // calculate the price benefit with accounting for uniswap's fees
//     if (componentsIn.size === 0 || componentsOut.size !== componentsIn.size)
//         return false;
//
//     let sumEthOut = BN(0);
//     for (const symbol of componentsOut) {
//         const componentContract = getInstance(symbol);
//         const componentBalanceOfIndexFund = await componentContract.methods.balanceOf(allAddrs.indexFund).call();
//         if (componentBalanceOfIndexFund === '0')
//             continue;
//
//         const ethOut = await queryUniswapEthOut(symbol, componentBalanceOfIndexFund);
//         console.log(symbol + ': ' + ethOut);
//         sumEthOut = sumEthOut.add(BN(ethOut));
//     }
//
//     /**
//      * Assume using the current amounts of the new components and swap back again for ether with
//      * the current price to see whether it's worth the uniswap fees, meaning whether the increasing
//      * values of the new portfolio is more significant than the uniswap's fees for swapping the old
//      * components out and swapping the new components in.
//      **/
//     const ethInForEach = sumEthOut.div(BN(componentsIn.size));
//     // const ethTotalNewPortfolio = ethNetOfNewComponents.reduce((accum, ethAmount) => accum.add(BN(ethAmount)), BN(0))
//     let ethTotalNewPortfolio = BN(0);
//     for (const symbol of componentsIn) {
//         tokenAmountOut = await queryUniswapTokenOut(symbol, ethInForEach);
//         ethAmountOut = await queryUniswapEthOut(symbol, tokenAmountOut);
//         ethTotalNewPortfolio = ethTotalNewPortfolio.add(BN(ethAmountOut));
//     }
//     const componentsRetained = curPortfolio.filter(component => !componentsOut.has(component));
//     console.log("RETAINED COMPONENTS ===> ", componentsRetained);
//
//     for (const symbol of componentsRetained) {
//         const componentContract = getInstance(symbol);
//         const componentBalanceOfIndexFund = await componentContract.methods.balanceOf(allAddrs.indexFund).call();
//         ethAmountOut = await queryUniswapEthOut(symbol, componentBalanceOfIndexFund);
//         ethTotalNewPortfolio = ethTotalNewPortfolio.add(BN(ethAmountOut));
//     }
//
//     const indexTokenTotalSupply = await getContract(CONTRACTS.INDEX_TOKEN).methods.totalSupply().call();
//     const indexPriceAfter = ethTotalNewPortfolio.mul(ETHER).div(BN(indexTokenTotalSupply));
//
//     const indexPriceBefore = BN(await getContract(CONTRACTS.INDEX_FUND).methods.getIndexPrice().call());
//     console.log("INDEX PRICE AFTER ===> ", indexPriceAfter.toString());
//     console.log("INDEX PRICE BEFORE ===> ", indexPriceBefore.toString());
//
//     return indexPriceAfter.gt(indexPriceBefore);
//
//     // sell those being subtituted on uniswap (store current price)
//
//     // take the money from the sale, buy those new components
// };

//
// const _buy = async () => {
//     const investor = (await web3.eth.getAccounts())[2];
//     await fundContract.methods.buy([]).send({
//         from: investor,
//         value: Ether('100'),
//         gas: '5000000'
//     });
//
//     await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
//         0,
//         [allAddrs.WETH, allAddrs.YFI],
//         investor,
//         ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
//     ).send({
//         from: investor,
//         value: Ether('100'),
//         gas: '5000000'
//     });
//
//     await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
//         0,
//         [allAddrs.WETH, allAddrs.MRK],
//         investor,
//         ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
//     ).send({
//         from: investor,
//         value: Ether('100'),
//         gas: '5000000'
//     });
// };
//

// const loadITINsFromSymbolsAndITC = (symbols, itcKey, itcVal) => {
//     const itsaTokens = loadItsaTokenInfo();
//     const symbolSet = new Set(symbols);
//     const _itsaTokensFiltered = itsaTokens.filter(token => token[itcKey].startsWith(itcVal)
//         && symbolSet.has(token.symbol)).map(token => [token.symbol, token.itin]);
//     const _itsaTokensSymbolItinMaps = Object.fromEntries(_itsaTokensFiltered);
//     // loop through symbols to get itins in the order of components
//     const itins = symbols.map(symbol => _itsaTokensSymbolItinMaps[symbol]);
//     return itins;
// };
//
// export const announceUpdate = async (allNextComponentSymbols, _msg) => {
//     const [componentSymbolsOut, componentSymbolsIn] = await deriveSubbedOutAndSubbedInComponents(allNextComponentSymbols);
//     if (componentSymbolsOut.length === 0) {
//         return [[], []];
//     }
//
//     //get componentAddrsIn
//     const componentAddrsIn = componentSymbolsIn.map(symbol => allAddrs[symbol]);
//
//     // get componetITINs
//     const _componentITINs = loadITINsFromSymbolsAndITC(allNextComponentSymbols, ITC_EIN_V100, EIN_FININS_DEFI__LENDINGSAVING);
//     console.log("_componentITINs ===>", _componentITINs);
//
//     // make _announcementMsg
//     const _announcementMsg = _makeAnnouncementMsg('rebalancing', _msg)
//     console.log("_announcementMsg ===>", _announcementMsg);
//
//     // call the announce() func of oracle contact
//     await getInstance(CONTRACTS.ORACLE).methods.announceUpdate(
//         componentSymbolsOut,
//         componentAddrsIn,
//         allNextComponentSymbols,
//         _componentITINs,
//         _announcementMsg
//     ).send({
//         from: admin,
//         gas: '4000000'
//     }).on('receipt', async (txReceipt) => {
//         console.log(`Gas used (ANNOUNCE UPDATE): `, txReceipt.gasUsed);
//     });
//
//     return [componentSymbolsOut, componentSymbolsIn];
// };
//
// const commitUpdate = async (componentSymbolsOut, componentSymbolsIn) => {
//     if (componentSymbolsOut.length === 0) {
//         return;
//     }
//
//     // get _amountsOutMinOut and _amountsOutMinIn
//     const [_amountsOutMinOut, _amountsOutMinIn] = await queryUniswapEthOutForTokensOut(componentSymbolsOut, componentSymbolsIn);
//
//     const FUNCTIONS_UPDATE_PORTFOLIO = 0;
//     const nextUpdateEpochSeconds = await fundContract.methods.timelock(FUNCTIONS_UPDATE_PORTFOLIO).call();
//     const nextUpdateTime = new Date(parseInt(nextUpdateEpochSeconds) * 1000).toUTCString();
//     console.log("nextUpdateTime ========> ", nextUpdateTime);
//
//     await oracleContract.methods.commitUpdate(_amountsOutMinOut, _amountsOutMinIn).send({
//         from: admin,
//         gas: '4000000'
//     }).on('receipt', async (txReceipt) => {
//         console.log(`Gas used (COMMIT UPDATE): `, txReceipt.gasUsed);
//     });
// };

// const _makeAnnouncementMsg = (action, _announcementMsg) => {
//     const today = new Date();
//     const next2Days = new Date(today.setDate(today.getDate() + 2)).toUTCString();
//     if (!_announcementMsg) {
//         _announcementMsg = `The next portfolio ${action} in the IndexFund contract (${getAddress(CONTRACTS.INDEX_FUND)}) will be on <${next2Days} +/- 15 minutes>.`;
//     }
//     return _announcementMsg;
// }

//
// const announceRebalancing = async (_msg) => {
//     const _announcementMsg = _makeAnnouncementMsg('rebalancing', _msg)
//     await oracleContract.methods.announceRebalancing(_announcementMsg).send({
//         from: admin,
//         gas: '4000000'
//     }).on('receipt', async (txReceipt) => {
//         console.log(`Gas used (ANOUNNCE REBALANCING): `, txReceipt.gasUsed);
//     });
// }
//
// const commitRebalancing = async () => {
//     const [ethsOutMin, cpntsOutMin] = await computeParamertersCommitRebalancing()
//     await oracleContract.methods.commitRebalancing(ethsOutMin, cpntsOutMin).send({
//         from: admin,
//         gas: '4000000'
//     }).on('receipt', async (txReceipt) => {
//         console.log(`Gas used (COMMIT REBALANCING): `, txReceipt.gasUsed);
//     });
// }