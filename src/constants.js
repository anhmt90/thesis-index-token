const path = require('path');

const DAI_JSON = require(`./token-jsons/DAI.json`);
const BNB_JSON = require(`./token-jsons/BNB.json`);
const ZRX_JSON = require(`./token-jsons/ZRX.json`);
const ERC20_INSTANCE_JSON = require(`../build/contracts/ERC20Instance.json`);

const WETH_JSON = require('@uniswap/v2-periphery/build/WETH9.json');
const UNISWAP_FACTORY_JSON = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const UNISWAP_ROUTER_JSON = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');
const UNISWAP_PAIR_JSON = require('@uniswap/v2-core/build/UniswapV2Pair.json');

const INDEX_TOKEN_JSON = require('../build/contracts/DFAM.json');
const ORACLE_JSON = require('../build/contracts/Oracle.json');
const INDEX_FUND_JSON = require('../build/contracts/IndexFund.json');

const PATH_ADDRESS_FILE = path.join(__dirname, '../data/contractAddresses.json');
const PATH_TOKENPRICE_FILE = path.join(__dirname, '../data/tokenPrices.json');
const PATH_ITC_ERC20_TOKENS_FILE = path.join(__dirname, '../data/itc_erc20_tokens.json');

const COINGECKO_ID_SYM_MAP = {
    'binancecoin': 'bnb',
    'dai': 'dai',
    '0x': 'zrx'
};

const REAL_TOKEN_JSONS = {
    'dai': DAI_JSON,
    'bnb': BNB_JSON,
    'zrx': ZRX_JSON,
};

const LENDING_TOKENS = {
    aave: "Aave Token",
    comp: "Compound",
    bzrx: "bZx Protocol Token",
    cel: "Celsius",
    yfii: "YFII.finance",
    mkr: "Maker",
    enzf: "Rhino Fund",
    yfi: "yearn.finance"
}

module.exports = {
    PATH_ADDRESS_FILE,
    PATH_TOKENPRICE_FILE,
    PATH_ITC_ERC20_TOKENS_FILE,

    DAI_JSON,
    BNB_JSON,
    ZRX_JSON,
    ERC20_INSTANCE_JSON,

    WETH_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_PAIR_JSON,
    UNISWAP_ROUTER_JSON,
    INDEX_TOKEN_JSON,
    ORACLE_JSON,
    INDEX_FUND_JSON,

    COINGECKO_ID_SYM_MAP,
    REAL_TOKEN_JSONS,
    LENDING_TOKENS,
};