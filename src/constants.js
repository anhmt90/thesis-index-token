const path = require('path')

const DAI_JSON = require(`./token-jsons/DAI.json`);
const BNB_JSON = require(`./token-jsons/BNB.json`);
const ZRX_JSON = require(`./token-jsons/ZRX.json`);

const WETH_JSON = require('@uniswap/v2-periphery/build/WETH9.json');
const UNISWAP_FACTORY_JSON = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const UNISWAP_ROUTER_JSON = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');
const UNISWAP_PAIR_JSON = require('@uniswap/v2-core/build/UniswapV2Pair.json');

const INDEX_TOKEN_JSON = require('../build/contracts/IndexToken.json');
const ORACLE_JSON = require('../build/contracts/Oracle.json');
const ETF_JSON = require('../build/contracts/ETF.json');

const ADDRESS_FILE = path.join(__dirname, '../data/contractAddresses.json');

module.exports = {
    ADDRESS_FILE,
    DAI_JSON,
    BNB_JSON,
    ZRX_JSON,

    WETH_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_PAIR_JSON,
    UNISWAP_ROUTER_JSON,
    INDEX_TOKEN_JSON,
    ORACLE_JSON,
    ETF_JSON
}