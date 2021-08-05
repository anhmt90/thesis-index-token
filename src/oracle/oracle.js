const log = require('../../config/logger');
const web3 = require('../getWeb3');
const fetchEthereumTokens = require('./fetchITSA');


const {
    UNISWAP_PAIR_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    DAI_JSON,
    INDEX_TOKEN_JSON,
    INDEX_FUND_JSON,
    ORACLE_JSON
} = require('../constants');

const {
    queryUniswapPriceInEth,
    queryUniswapEthOut,
    queryUniswapTokenOut,
    queryPortfolioEthOut,
    queryUniswapEthOutForTokensOut,
    loadItsaTokenInfo,
    loadLastUniswapPrices,
    loadITINsFromSymbolsAndITC,
    getAllAddrs,
    assembleUniswapTokenSet,
    getContract,
    CONTRACTS
} = require('../utils');

const {
    ITC_EIN_V100,
    EIN_FININS_DEFI__LENDINGSAVING
} = require('./itc');

let fundContract;
let oracleContract;

let allAddrs;
let admin;

let curPortfolio;
const BN = web3.utils.toBN;
const Ether = web3.utils.toWei;
const ETHER = web3.utils.toWei(BN(1));



const selectNewPortfolio = async () => {
    // await fetchEthereumTokens([`${ITC_EIN_V100}=${EIN_FININS_DEFI__LENDINGSAVING}`]);
    // how to get the token contract addresses on the tokens fetched from ITSA --> Etherscan api?

    /**
     * check which tokens have Uniswap pools
     *
     * Note: we usually knew already if a token is on Uniswap since we had to look for its
     * contract address using a side channel e.g. manually or over etherscan APIs, at that time, we could
     * also make a check for WETH/Token pool on Uniswap and mark the result for later use such as currently.
     * However, to make it realistic, we carry this check anyway here.
     **/

    const uniswapTokenSet = await assembleUniswapTokenSet();
    log.debug("ALL CANDIDATE COMPONENTS ===> ", Object.keys(uniswapTokenSet));
    const prevPrices = loadLastUniswapPrices();
    log.debug("PREVIOUS PRICES ===> ", prevPrices);

    const curPrices = {};
    for (const symbol of Object.keys(uniswapTokenSet)) {
        curPrices[symbol] = await queryUniswapPriceInEth(symbol);
    }
    log.debug("CURRENT PRICES ===> ", curPrices);

    const priceDiffPercentages = [];
    for (const [symbol, curPrice] of Object.entries(curPrices)) {
        const prevPrice = BN(prevPrices[symbol]);
        const diff = BN(curPrice).sub(prevPrice);
        const diffObj = {
            symbol,
            diffPercent: diff.mul(ETHER).div(prevPrice)
        };
        priceDiffPercentages.push(diffObj);
    }
    log.debug("PRICE DIFFS ===> ", priceDiffPercentages.map(({ symbol, diffPercent }) => symbol + ': ' + diffPercent));

    const fundContract = getContract(CONTRACTS.INDEX_FUND);
    curPortfolio = new Set(await fundContract.methods.getComponentSymbols().call());

    priceDiffPercentages.sort(_compareComponent);

    log.debug("SORTED PRICE DIFFS ===> ", priceDiffPercentages.map(({ symbol, diffPercent }) => diffPercent.toString() + '_' + symbol));


    // get new portfolio from based off the sorted price difference percentages
    const newPortfolio = [];
    for (const { symbol, _ } of priceDiffPercentages) {
        if (newPortfolio.length >= curPortfolio.size)
            break;
        newPortfolio.push(symbol);
    }
    log.debug("NEW PORTFOLIO ===> ", newPortfolio);

    return newPortfolio;
};

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


const _deriveSubbedOutAndSubbedInComponents = async (newPortfolio) => {
    // get current portfolio onchain
    const fundContract = getContract(CONTRACTS.INDEX_FUND);
    const curPortfolio = (await fundContract.methods.getComponentSymbols().call()).map(component => component.toLowerCase());
    log.debug("CURRENT PORTFOLIO ===> ", curPortfolio);

    // derive subtituted components (components out) from current portfolio
    const newPortfolioSet = new Set(newPortfolio);
    const componentsOut = curPortfolio
        .filter(component => !newPortfolioSet.has(component.toLowerCase()))
        .map(component => component.toLowerCase()
        );
    log.debug("REMOVED COMPONENTS ===> ", componentsOut);

    if (componentsOut.length === 0)
        return false;

    // derive new components that are not in the current portfolio (components in)
    const curPortfolioSet = new Set(curPortfolio.map(component => component.toLowerCase()));
    const componentsIn = newPortfolio.filter(component => !curPortfolioSet.has(component));
    log.debug("NEW COMPONENTS ===> ", componentsIn);

    return [componentsOut, componentsIn];
};


const decidePortfolioSubstitution = async (newPortfolio) => {
    let [componentsOut, componentsIn] = await _deriveSubbedOutAndSubbedInComponents(newPortfolio);
    componentsOut = new Set(componentsOut);
    componentsIn = new Set(componentsIn);

    // calculate the price benefit with accounting for uniswap's fees
    if (componentsIn.size === 0 || componentsOut.size !== componentsIn.size)
        return false;

    let sumEthOut = BN(0);
    for (const symbol of componentsOut) {
        const componentContract = getContract(symbol);
        const componentBalanceOfIndexFund = await componentContract.methods.balanceOf(allAddrs.indexFund).call();
        if (componentBalanceOfIndexFund === '0')
            continue;

        const ethOut = await queryUniswapEthOut(symbol, componentBalanceOfIndexFund);
        log.debug(symbol + ': ' + ethOut);
        sumEthOut = sumEthOut.add(BN(ethOut));
    }

    /**
     * Asume using the current amounts of the new components and swap back again for ether with
     * the current price to see whether it's worth the uniswap fees, meaning whether the increasing
     * values of the new portfolio is more significant than the uniswap's fees for swapping the old
     * components out and swapping the new components in.
     **/
    const ethInForEach = sumEthOut.div(BN(componentsIn.size));
    // const ethTotalNewPortfolio = ethNetOfNewComponents.reduce((accum, ethAmount) => accum.add(BN(ethAmount)), BN(0))
    let ethTotalNewPortfolio = BN(0);
    for (const symbol of componentsIn) {
        tokenAmountOut = await queryUniswapTokenOut(symbol, ethInForEach);
        ethAmountOut = await queryUniswapEthOut(symbol, tokenAmountOut);
        ethTotalNewPortfolio = ethTotalNewPortfolio.add(BN(ethAmountOut));
    }
    const componentsRetained = curPortfolio.filter(component => !componentsOut.has(component));
    log.debug("RETAINED COMPONENTS ===> ", componentsRetained);

    for (const symbol of componentsRetained) {
        const componentContract = getContract(symbol);
        const componentBalanceOfIndexFund = await componentContract.methods.balanceOf(allAddrs.indexFund).call();
        ethAmountOut = await queryUniswapEthOut(symbol, componentBalanceOfIndexFund);
        ethTotalNewPortfolio = ethTotalNewPortfolio.add(BN(ethAmountOut));
    }

    const indexTokenTotalSupply = await getContract(CONTRACTS.INDEX_TOKEN).methods.totalSupply().call();
    const indexPriceAfter = ethTotalNewPortfolio.mul(ETHER).div(BN(indexTokenTotalSupply));

    const indexPriceBefore = BN(await getContract(CONTRACTS.INDEX_FUND).methods.getIndexPrice().call());
    log.debug("INDEX PRICE AFTER ===> ", indexPriceAfter.toString());
    log.debug("INDEX PRICE BEFORE ===> ", indexPriceBefore.toString());

    return indexPriceAfter.gt(indexPriceBefore);

    // sell those being subtituted on uniswap (store current price)

    // take the money from the sale, buy those new components
};

const _buy = async () => {
    const investor = (await web3.eth.getAccounts())[2];
    await fundContract.methods.buy([]).send({
        from: investor,
        value: Ether('100'),
        gas: '5000000'
    });

    await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
        0,
        [allAddrs.weth, allAddrs.yfi],
        investor,
        ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
    ).send({
        from: investor,
        value: Ether('100'),
        gas: '5000000'
    });

    await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
        0,
        [allAddrs.weth, allAddrs.mkr],
        investor,
        ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
    ).send({
        from: investor,
        value: Ether('100'),
        gas: '5000000'
    });
};

const announce = async (allNextComponentSymbols) => {
    const [componentSymbolsOut, componentSymbolsIn] = await _deriveSubbedOutAndSubbedInComponents(allNextComponentSymbols);

    //get componentAddrsIn
    const componentAddrsIn = componentSymbolsIn.map(symbol => allAddrs[symbol]);

    // get componetITINs
    const _componentITINs = loadITINsFromSymbolsAndITC(allNextComponentSymbols, ITC_EIN_V100, EIN_FININS_DEFI__LENDINGSAVING);
    log.debug("_componentITINs ===>", _componentITINs);

    // make _announcementMessage
    const today = new Date();
    const next2Days = new Date(today.setDate(today.getDate() + 2)).toUTCString();
    const _announcementMessage = `The next portfolio update in the IndexFund contract (${allAddrs.indexFund}) will on <${next2Days} +/- 15 minutes>.`;
    log.debug("_announcementMessage ===>", _announcementMessage);

    // call the announce() func of oracle contact
    oracleContract = getContract(CONTRACTS.ORACLE);
    await oracleContract.methods.announce(
        componentSymbolsOut.map(symbol => symbol.toUpperCase()),
        componentAddrsIn,
        allNextComponentSymbols.map(symbol => symbol.toUpperCase()),
        _componentITINs,
        _announcementMessage
    ).send({
        from: admin,
        gas: '9000000'
    }).on('receipt', async (txReceipt) => {
        log.debug(`Gas used (oracle.announce()): `, txReceipt.gasUsed);
    });

    return [componentSymbolsOut, componentSymbolsIn];
};

const commit = async (componentSymbolsOut, componentSymbolsIn) => {
    // get _amountsOutMinOut and _amountsOutMinIn
    const [_amountsOutMinOut, _amountsOutMinIn] = await queryUniswapEthOutForTokensOut(componentSymbolsOut, componentSymbolsIn);

    const FUNCTIONS_UPDATE_PORTFOLIO = 0;
    const nextUpdateEpochSeconds = await fundContract.methods.timelock(FUNCTIONS_UPDATE_PORTFOLIO).call();
    const nextUpdateTime = new Date(parseInt(nextUpdateEpochSeconds) * 1000).toUTCString();
    log.debug("nextUpdateTime ========> ", nextUpdateTime);

    await oracleContract.methods.commit(_amountsOutMinOut, _amountsOutMinIn).send({
        from: admin,
        gas: '9000000'
    });
};

const setOracleGlobalVars = async () => {
    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    allAddrs = getAllAddrs();

    fundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    const oracleAddr = await fundContract.methods.oracle().call();
    oracleContract = new web3.eth.Contract(ORACLE_JSON.abi, oracleAddr);
};

const run = async () => {
    await setOracleGlobalVars();
    const newPortfolio = await selectNewPortfolio();
    await _buy();
    // const decision = await decidePortfolioSubstitution(newPortfolio);
    // log.debug('DECISON:', decision);

    const [componentSymbolsOut, componentSymbolsIn] = await announce(newPortfolio);
    await commit(componentSymbolsOut, componentSymbolsIn);
};


if ((process.env.NODE_ENV).toUpperCase() !== 'TEST') {
    run().finally(() => {
        web3.currentProvider.disconnect();
    });
}

module.exports = {
    setOracleGlobalVars,
    selectNewPortfolio,
    announce,
    commit
};