const fs = require('fs');

const DAI_JSON = require(`./token-jsons/Dai.json`);
const WETH_JSON = require('@uniswap/v2-periphery/build/WETH9.json');
const UNISWAP_FACTORY_JSON = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const UNISWAP_ROUTER_JSON = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');
const UNISWAP_PAIR_JSON = require('@uniswap/v2-core/build/UniswapV2Pair.json');

const INDEX_TOKEN_JSON = require('../build/contracts/IndexToken.json');
const ORACLE_JSON = require('../build/contracts/Oracle.json');
const ETF_JSON = require('../build/contracts/ETF.json');

let allAddr = {};

const loadAllAddr = () => {
    if (Object.keys(allAddr).length === 0 && fs.existsSync('data/contractAddresses.json')) {
        const jsonData = fs.readFileSync('data/contractAddresses.json', 'utf-8');
        allAddr = JSON.parse(jsonData.toString());
    } else {
        console.log('INFO: Skip loading contract addresses!');
        console.log('INFO: All addresses: ', allAddr);
    }
};

loadAllAddr()


module.exports = {
    allAddr,
    DAI_JSON,
    WETH_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_PAIR_JSON,
    UNISWAP_ROUTER_JSON,
    INDEX_TOKEN_JSON,
    ORACLE_JSON,
    ETF_JSON
};