const path = require('path');

const isTesting = (process.env.NODE_ENV).toUpperCase() === 'TEST';

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

const dataPath = isTesting ? '../test/fixtures' : '../data';
const PATH_ADDRESS_FILE = path.join(__dirname, `${dataPath}/contractAddresses.json`);
const PATH_TOKENPRICE_FILE = path.join(__dirname, `${dataPath}/tokenPrices-0.json`);
const PATH_ITC_ERC20_TOKENS_FILE = path.join(__dirname, `${dataPath}/itc_erc20_tokens.json`);




const COINGECKO_ID_SYM_MAP = {
    'binancecoin': 'BNB',
    'dai': 'DAI',
    '0x': 'ZRX'
};

const REAL_TOKEN_JSONS = {
    'DAI': DAI_JSON,
    'BNB': BNB_JSON,
    'ZRX': ZRX_JSON,
};

const LENDING_TOKENS = {
    AAVE: "Aave Token",
    COMP: "Compound",
    BZRX: "bZx Protocol Token",
    CEL: "Celsius",
    YFII: "YFII.finance",
    MKR: "Maker",
    ENZF: "Rhino Fund",
    YFI: "yearn.finance"
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