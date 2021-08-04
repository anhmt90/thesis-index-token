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
    loadItsaTokenInfo,
    loadLastUniswapPrices,
    getAllAddrs,
    assembleTokenSet,
    getContract,
    CONTRACTS
} = require('../utils');

let fundContract;
let oracleContract;

let allAddrs;
let admin;

let curPortfolio;
const BN = web3.utils.toBN;
const Ether = web3.utils.toWei;
const ETHER = web3.utils.toWei(BN(1));



const setOracleGlobalVars = async () => {
    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    allAddrs = getAllAddrs();

    fundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    const oracleAddr = await fundContract.methods.oracle().call();
    oracleContract = new web3.eth.Contract(ORACLE_JSON.abi, oracleAddr);
};


const selectNewPortfolio = async () => {
    // await fetchEthereumTokens([ITC_EIN_V100 + EIN_FININS_DEFI__LENDINGSAVING]);
    // how to get the token contract addresses on the tokens fetched from ITSA --> Etherscan api?

    const itsaTokens = loadItsaTokenInfo();

    // filter and keep only tokens that we know their addresses
    const knownTokenSet = assembleTokenSet();
    const knownTokenSymbols = new Set(Object.keys(knownTokenSet).map(sym => sym.toLowerCase()));
    const knownItsaTokens = itsaTokens.filter(token => knownTokenSymbols.has(token.symbol.toLowerCase()));
    /**
     * check which tokens have Uniswap pools
     *
     * Note: we usually knew already if a token is on Uniswap since we had to look for its
     * contract address using a side channel e.g. manually or over etherscan APIs, at that time, we could
     * also make a check for WETH/Token pool on Uniswap and mark the result for later use such as currently.
     * However, to make it realistic, we carry this check anyway here.
     *
     * From Uniswap's docs: The most obvious way to get the address for a pair is to call getPair
     * on the factory. If the pair exists, this function will return its address, else address(0)
     **/
    const factoryContract = getContract(CONTRACTS.UNISWAP_FACTORY);
    const finalTokenSet = {};
    for (const itsaToken of knownItsaTokens) {
        const sym = itsaToken.symbol.toLowerCase();
        console.log("CURRENT KNOWN ITSA TOKENS: ", sym);
        const poolAddr = await factoryContract.methods.getPair(knownTokenSet[sym].address, allAddrs.weth).call();
        console.log("poolAddr ===> ", poolAddr);
        if (parseInt(poolAddr) !== 0) {
            finalTokenSet[sym] = knownTokenSet[sym];
        } else {

        }
    }
    console.log("FINAL TOKEN SET ===> ", Object.keys(finalTokenSet));
    const prevPrices = loadLastUniswapPrices();
    console.log("PREVIOUS PRICES ===> ", prevPrices);

    const curPrices = {};
    for (const tokenSym of Object.keys(finalTokenSet)) {
        curPrices[tokenSym] = await queryUniswapPriceInEth(tokenSym);
    }
    console.log("CURRENT PRICES ===> ", curPrices);

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
    console.log("PRICE DIFFS ===> ", priceDiffPercentages.map(({ symbol, diffPercent }) => symbol + ': ' + diffPercent));

    const fundContract = getContract(CONTRACTS.INDEX_FUND);
    curPortfolio = new Set(await fundContract.methods.getComponentSymbols().call());

    priceDiffPercentages.sort(_compareComponent);

    console.log("SORTED PRICE DIFFS ===> ", priceDiffPercentages.map(({ symbol, diffPercent }) => diffPercent.toString() + '_' + symbol));


    // get new portfolio from based off the sorted price difference percentages
    const newPortfolio = new Set();
    for (const { symbol, _ } of priceDiffPercentages) {
        if (newPortfolio.size >= curPortfolio.size)
            break;
        newPortfolio.add(symbol);
    }
    console.log("NEW PORTFOLIO ===> ", newPortfolio);

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



const decidePortfolioSubstitution = async (newPortfolio) => {
    // get current portfolio onchain
    const fundContract = getContract(CONTRACTS.INDEX_FUND);
    const curPortfolio = (await fundContract.methods.getComponentSymbols().call()).map(component => component.toLowerCase());
    console.log("CURRENT PORTFOLIO ===> ", curPortfolio);

    // derive subtituted components (components out) from current portfolio
    const removedComponents = new Set(curPortfolio
        .filter(component => !newPortfolio.has(component.toLowerCase()))
        .map(component => component.toLowerCase())
    );

    console.log("REMOVED COMPONENTS ===> ", removedComponents);
    if (removedComponents.size === 0)
        return false;

    // derive new components that are not in the current portfolio (components in)
    const curPortfolioSet = new Set(curPortfolio.map(component => component.toLowerCase()));
    const newComponents = new Set([...newPortfolio].filter(component => !curPortfolioSet.has(component)));
    console.log("NEW COMPONENTS ===> ", newComponents);


    // calculate the price benefit with accounting for uniswap's fees
    if (newComponents.size === 0 || removedComponents.size !== newComponents.size)
        return false;

    let sumEthOut = BN(0);
    for (const symbol of removedComponents) {
        const componentContract = getContract(symbol);
        const componentBalanceOfIndexFund = await componentContract.methods.balanceOf(allAddrs.indexFund).call();
        if (componentBalanceOfIndexFund === '0')
            continue;

        const ethOut = await queryUniswapEthOut(symbol, componentBalanceOfIndexFund);
        console.log(symbol + ': ' + ethOut);
        sumEthOut = sumEthOut.add(BN(ethOut));
    }

    /**
     * Asume using the current amounts of the new components and swap back again for ether with
     * the current price to see whether it's worth the uniswap fees, meaning whether the increasing
     * values of the new portfolio is more significant than the uniswap's fees for swapping the old
     * components out and swapping the new components in.
     **/
    const ethInForEach = sumEthOut.div(BN(newComponents.size));
    // const ethTotalNewPortfolio = ethNetOfNewComponents.reduce((accum, ethAmount) => accum.add(BN(ethAmount)), BN(0))
    let ethTotalNewPortfolio = BN(0);
    for (const symbol of newComponents) {
        tokenAmountOut = await queryUniswapTokenOut(symbol, ethInForEach);
        ethAmountOut = await queryUniswapEthOut(symbol, tokenAmountOut);
        ethTotalNewPortfolio = ethTotalNewPortfolio.add(BN(ethAmountOut));
    }
    const retainedComponents = curPortfolio.filter(component => !removedComponents.has(component));
    console.log("RETAINED COMPONENTS ===> ", retainedComponents);

    for (const symbol of retainedComponents) {
        const componentContract = getContract(symbol);
        const componentBalanceOfIndexFund = await componentContract.methods.balanceOf(allAddrs.indexFund).call();
        ethAmountOut = await queryUniswapEthOut(symbol, componentBalanceOfIndexFund);
        ethTotalNewPortfolio = ethTotalNewPortfolio.add(BN(ethAmountOut));
    }

    const indexTokenTotalSupply = await getContract(CONTRACTS.INDEX_TOKEN).methods.totalSupply().call();
    const indexPriceAfter = ethTotalNewPortfolio.mul(ETHER).div(BN(indexTokenTotalSupply));

    const indexPriceBefore = BN(await fundContract.methods.getIndexPrice().call());
    console.log("INDEX PRICE AFTER ===> ", indexPriceAfter.toString());
    console.log("INDEX PRICE BEFORE ===> ", indexPriceBefore.toString());

    return indexPriceAfter.gt(indexPriceBefore);

    // sell those being subtituted on uniswap (store current price)

    // take the money from the sale, buy those new components
};

const buy = async () => {
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
    })

    await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
        0,
        [allAddrs.weth, allAddrs.mkr],
        investor,
        ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
    ).send({
        from: investor,
        value: Ether('100'),
        gas: '5000000'
    })
};

const announce = async () => {




};

const run = async () => {
    await setOracleGlobalVars();
    const newPortfolio = await selectNewPortfolio();
    await buy();
    const decision = await decidePortfolioSubstitution(newPortfolio);
    console.log('DECISON:', decision);
};


if ((process.env.NODE_ENV).toUpperCase() !== 'TEST') {
    run().finally(() => {
        web3.currentProvider.disconnect();
    });
}