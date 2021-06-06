// var wtf = require('wtfnode');
const log = require('../config/logger');


const web3 = require('./getWeb3');

const {
    UNISWAP_PAIR_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    DAI_JSON,
    INDEX_TOKEN_JSON,
    INDEX_FUND_JSON
} = require('./constants');

const {
    queryEthBalance,
    queryIndexBalance,
    queryTokenBalance,
    getAllAddrs,
    assembleTokenSet,
    float2TokenUnits
} = require("./utils");

const queryIndexPrice = async () => {
    const indexFundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddr.indexFund);
    const indexPrice = await indexFundContract.methods.getIndexPrice().call();
    log.debug('INDEX PRICE:', indexPrice);
};

const swap = async () => {
    const indexFundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddr.indexFund);
    const decimals = (new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddr.indexToken)).methods.decimals().call();

    const ethIn = (1 / 0.997);
    let amountsOut = await indexFundContract.methods.getAmountsOutForExactETH(float2TokenUnits(ethIn, decimals)).call();
    log.debug("Real amount outputs (before swap):", amountsOut);

    /**
     * Test token ordering
     */
    log.debug('DAI balance of IndexFund (before swap):', await queryTokenBalance({ tokenSymbol: 'dai', account: allAddr.indexFund }));
    log.debug('ETH balance of IndexFund (before swap):', await queryEthBalance(allAddr.indexFund));
    log.debug('INDEX balance of IndexFund (before swap):', await queryIndexBalance(allAddr.indexFund));

    log.debug('Wallet balance of Investor (before swap):', await queryEthBalance(investor));
    const tokenSet = assembleTokenSet();

    const ethToSwap = (1 / 0.997) * Object.keys(tokenSet).length;
    log.debug('Swapping', ethToSwap, `ETH (= ${float2TokenUnits(ethToSwap)} wei) for DAI`);
    await indexFundContract.methods.orderWithExactETH().send({
        from: investor,
        value: web3.utils.toWei(String(ethToSwap), "ether"),
        gas: '5000000'
    });

    log.debug('DAI balance of IndexFund (after swap):', await queryTokenBalance({ tokenSymbol: 'dai', account: allAddr.indexFund }));
    log.debug('ETH balance of IndexFund (after swap):', await queryEthBalance(allAddr.indexFund));
    log.debug('Wallet balance of Investor (after swap):', await queryEthBalance(investor));

    log.debug("******************************************************");

    amountsOut = await indexFundContract.methods.getAmountsOutForExactETH('1' + '0'.repeat(18)).call();
    log.debug("Real amount outputs (after swap):", web3.utils.fromWei(amountsOut[0]));
};

const setPortfolio = async () => {
    const indexFundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddr.indexFund);
    /**
     * Set portfolio
     */
    const tokenSet = assembleTokenSet();
    const tokenNames = Object.keys(tokenSet).map(symbol => symbol.toUpperCase());
    const tokenAddresses = Object.values(tokenSet).map(({ address }) => address);
    await indexFundContract.methods.setPorfolio(tokenNames, tokenAddresses).send({
        from: admin,
        gas: '3000000'
    });
    log.debug('SUCCESS: Portfolio set!');
    const portfolioNamesOnchain = await indexFundContract.methods.getNamesInPortfolio().call();
    log.debug('PORTFOLIO NAMES ONCHAIN:', portfolioNamesOnchain);

    const portfolioAddrsOnchain = await indexFundContract.methods.getAddressesInPortfolio().call();
    log.debug('PORTFOLIO ADDRS ONCHAIN:', portfolioAddrsOnchain);
};

const setIndexFundGlobalVars = async () => {
    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    investor = accounts[2];
    allAddr = getAllAddrs();
}

const run = async () => {
    await setIndexFundGlobalVars();

    await setPortfolio();
    await queryIndexPrice();
    await swap();
    /** ================================================================= */

    /** ================================================================= */

};

let allAddr;
let admin;
let investor;

if ((process.env.NODE_ENV).toUpperCase() !== 'TEST') {
    run().finally(() => {
        // log.debug("Active Handles: ", process._getActiveHandles())
        // log.debug("Active Reqs: ", process._getActiveRequests())
        web3.currentProvider.disconnect();
        // wtf.dump()
        // process.exit();
    });
}

module.exports = {
    setIndexFundGlobalVars,
    setPortfolio,
    queryIndexPrice,
    swap
};