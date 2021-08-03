const path = require('path');

const {
    LENDING_TOKENS,
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

    REAL_TOKEN_JSONS,

} = require('../../src/constants');

const PATH_ADDRESS_FILE = path.join(__dirname, 'contractAddresses.test.json');
const PATH_TOKENPRICE_FILE = path.join(__dirname, 'tokenPrices.test.json');


module.exports = {
    PATH_ADDRESS_FILE,
    PATH_TOKENPRICE_FILE,

    LENDING_TOKENS,
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

    REAL_TOKEN_JSONS,
};


