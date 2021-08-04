const log = require('../../config/logger');
const web3 = require('../getWeb3');
// const BigNumber = require('bignumber.js');

const BN = web3.utils.toBN;

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
            diffPercent: diff.mul(BN('1' + '0'.repeat(18))).div(prevPrice)
        };
        priceDiffPercentages.push(diffObj);
    }
    console.log("PRICE DIFFS ===> ", priceDiffPercentages);

    const fundContract = getContract(CONTRACTS.INDEX_FUND);
    curPortfolio = new Set(await fundContract.methods.getNamesInPortfolio().call());

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

const announce = async () => {




};

const run = async () => {
    await setOracleGlobalVars();
    await selectNewPortfolio();
};


if ((process.env.NODE_ENV).toUpperCase() !== 'TEST') {
    run().finally(() => {
        web3.currentProvider.disconnect();
    });
}