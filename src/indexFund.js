// var wtf = require('wtfnode');
const log = require('../config/logger');
const web3 = require('./getWeb3');

const {
    UNISWAP_PAIR_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    DAI_JSON,
    INDEX_TOKEN_JSON,
    INDEX_FUND_JSON,
    LENDING_TOKENS
} = require('./constants');

const {
    queryEthBalance,
    queryIndexBalance,
    queryTokenBalance,
    getAllAddrs,
    assembleTokenSet,
    float2TokenUnits
} = require("./utils");

let indexFundContract;
let indexTokenContract;

let allAddrs;
let admin;
let investor;

const queryIndexPrice = async () => {
    // const indexFundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    const indexPrice = await indexFundContract.methods.getIndexPrice().call();
    log.debug('INDEX PRICE:', indexPrice);
};

const experimentSwap = async () => {
    // const indexFundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    const decimals = indexTokenContract.methods.decimals().call();

    const ethIn = (1 / 0.997);
    let amountsOut = await indexFundContract.methods.getUniswapAmountsOutForExactETH(float2TokenUnits(ethIn, decimals)).call();
    log.debug("Real amount outputs (before swap):", amountsOut);

    /**
     * Test token ordering
     */
    log.debug('DAI balance of IndexFund (before swap):', await queryTokenBalance({ tokenSymbol: 'dai', account: allAddrs.indexFund }));
    log.debug('ETH balance of IndexFund (before swap):', await queryEthBalance(allAddrs.indexFund));
    log.debug('INDEX balance of IndexFund (before swap):', await queryIndexBalance(allAddrs.indexFund));

    log.debug('Wallet balance of Investor (before swap):', await queryEthBalance(investor));
    const tokenSet = assembleTokenSet();

    const ethToSwap = (1 / 0.997) * Object.keys(tokenSet).length;
    log.debug('Swapping', ethToSwap, `ETH (= ${float2TokenUnits(ethToSwap)} wei) for DAI`);
    await indexFundContract.methods.orderWithExactETH().send({
        from: investor,
        value: web3.utils.toWei(String(ethToSwap), "ether"),
        gas: '5000000'
    });

    log.debug('DAI balance of IndexFund (after swap):', await queryTokenBalance({ tokenSymbol: 'dai', account: allAddrs.indexFund }));
    log.debug('ETH balance of IndexFund (after swap):', await queryEthBalance(allAddrs.indexFund));
    log.debug('Wallet balance of Investor (after swap):', await queryEthBalance(investor));

    log.debug("******************************************************");

    amountsOut = await indexFundContract.methods.getUniswapAmountsOutForExactETH('1' + '0'.repeat(18)).call();
    log.debug("Real amount outputs (after swap):", web3.utils.fromWei(amountsOut[0]));
};


const setIndexFundGlobalVars = async () => {
    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    investor = accounts[2];
    allAddrs = getAllAddrs();

    indexFundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    indexTokenContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddrs.indexToken);
}

const run = async () => {
    await setIndexFundGlobalVars();

    await queryIndexPrice();
    await experimentSwap();
    /** ================================================================= */

    /** ================================================================= */

};

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
    queryIndexPrice,
    swap: experimentSwap
};