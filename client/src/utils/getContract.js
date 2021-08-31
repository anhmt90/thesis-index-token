import {web3} from '../getWeb3';
import indexFund from '../abis/IndexFund.json';

import allAddrs from "../data/contractAddresses.json";


const ERC20_INSTANCE_JSON = require(`../abis/ERC20Instance.json`);

const WETH_JSON = require('@uniswap/v2-periphery/build/WETH9.json');
const UNISWAP_FACTORY_JSON = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const UNISWAP_ROUTER_JSON = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');

const DFAM_JSON = require('../abis/DFAM.json');
const ORACLE_JSON = require('../abis/Oracle.json');
const INDEX_FUND_JSON = require('../abis/IndexFund.json');


export const CONTRACTS = {
    AAVE: "AAVE",
    COMP: "COMP",
    BZRX: "BZRX",
    CEL: "CEL",
    YFII: "YFII",
    MKR: "MKR",
    ENZF: "ENZF",
    YFI: "YFI",

    WETH: "WETH",
    UNISWAP_FACTORY: "uniswapFactory",
    UNISWAP_ROUTER: "uniswapRouter",

    INDEX_FUND: "indexFund",
    INDEX_TOKEN: "indexToken",
    ORACLE: "oracle",
};

export const getInstance = (contract) => {
    if (!contract) {
        throw new Error("Contract is not defined");
    }

    switch (contract) {
        case CONTRACTS.AAVE:
        case CONTRACTS.COMP:
        case CONTRACTS.BZRX:
        case CONTRACTS.CEL:
        case CONTRACTS.YFII:
        case CONTRACTS.MKR:
        case CONTRACTS.ENZF:
        case CONTRACTS.YFI:
            return new web3.eth.Contract(ERC20_INSTANCE_JSON.abi, allAddrs[contract]);
        case CONTRACTS.WETH:
            return new web3.eth.Contract(WETH_JSON.abi, allAddrs[contract]);
        case CONTRACTS.UNISWAP_FACTORY:
            return new web3.eth.Contract(UNISWAP_FACTORY_JSON.abi, allAddrs[contract]);
        case CONTRACTS.UNISWAP_ROUTER:
            return new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, allAddrs[contract]);
        case CONTRACTS.INDEX_FUND:
            return new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs[contract]);
        case CONTRACTS.INDEX_TOKEN:
            return new web3.eth.Contract(DFAM_JSON.abi, allAddrs[contract]);
        case CONTRACTS.ORACLE:
            return new web3.eth.Contract(ORACLE_JSON.abi, allAddrs[contract]);
    }
};

export const getAddress = (contract) => {
    if (!contract) {
        throw new Error("Contract is not defined");
    }
    return allAddrs[contract]
}