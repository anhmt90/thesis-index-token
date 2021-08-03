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




const setOracleGlobalVars = async () => {
    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    allAddrs = getAllAddrs();

    fundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    const oracleAddr = await fundContract.methods.oracle().call();
    oracleContract = new web3.eth.Contract(ORACLE_JSON.abi, oracleAddr);
};





const announce = async () => {




};

const run = async () => {
    await setOracleGlobalVars();
    await selectComponentTokens();
};


if ((process.env.NODE_ENV).toUpperCase() !== 'TEST') {
    run().finally(() => {
        web3.currentProvider.disconnect();
    });
}