const fs = require('fs');
const fg = require('fast-glob');
const log = require('../config/logger');

const web3 = require('./getWeb3');
const {
    PATH_ADDRESS_FILE,
    PATH_TOKENPRICE_FILE,
    PATH_ITC_ERC20_TOKENS_FILE,

    DAI_JSON,
    BNB_JSON,
    ZRX_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    UNISWAP_PAIR_JSON,

    REAL_TOKEN_JSONS,
    LENDING_TOKENS,
    INDEX_TOKEN_JSON,
    INDEX_FUND_JSON,
    ORACLE_JSON,
    ERC20_INSTANCE_JSON
} = require(process.env.NODE_ENV && (process.env.NODE_ENV).toUpperCase() === 'TEST' ?
    '../test/fixtures/constants.js' : './constants.js');

let _tokenSet = {};
let _allAddrs = {};

/* ************************************************************************* */

const storeAddresses = (addresses) => {
    pickle(addresses, PATH_ADDRESS_FILE);
};

const storeTokenPrices = (tokenPrices) => {
    pickle(tokenPrices, PATH_TOKENPRICE_FILE);
};

const storeItcTokens = (tokens) => {
    pickle(tokens, PATH_ITC_ERC20_TOKENS_FILE);
};

const pickle = (obj, path) => {
    const json = JSON.stringify(obj, null, 4);
    fs.writeFileSync(path, json, (err) => {
        if (err) throw err;
        log.debug('\nJson file saved at:', savePath);
    });
};

/* ************************************************************************* */

const _loadAddresses = () => {
    return _load(PATH_ADDRESS_FILE, 'Contract Addresses');
};

const loadTokenPrices = () => {
    return _load(PATH_TOKENPRICE_FILE, 'Token Prices');
};

const loadItsaTokenInfo = () => {
    return _load(PATH_ITC_ERC20_TOKENS_FILE, "ITSA's ERC20 Token Information");
};

const loadLastUniswapPrices = () => {
    const priceFiles = fg.sync(['data/tokenPrices-[[:digit:]].json']);
    const mostRecentPriceFile = priceFiles[priceFiles.length - 1];
    const mostRecentPriceFilePath = path.join(__dirname, '../', mostRecentPriceFile);
    return _load(mostRecentPriceFilePath, mostRecentPriceFile.replace('/data', ''))
}

const _load = (path, objName) => {
    let obj = {};
    if (fs.existsSync(path)) {
        const jsonData = fs.readFileSync(path, 'utf-8');
        obj = JSON.parse(jsonData.toString());
        log.debug(`INFO: ${objName} Loaded: `, obj);
    } else {
        log.debug(`INFO: Skip loading ${objName}!`);
    }
    return obj;
};


/* ************************************************************************* */

const queryEthBalance = async (account) => {
    return web3.utils.fromWei(await web3.eth.getBalance(account), 'ether');
};

const queryTokenBalance = async ({ tokenSymbol, account }) => {
    const token = _tokenSet[tokenSymbol.toLowerCase()];
    const tokenContract = new web3.eth.Contract(token.json.abi, token.address);
    return (await tokenContract.methods.balanceOf(account).call());
};

const queryIndexBalance = async (account) => {
    const indexContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, _allAddrs.indexToken);
    return (await indexContract.methods.balanceOf(account).call());

};

const queryPairAddress = async (tokenSymbol) => {
    const token = _tokenSet[tokenSymbol.toLowerCase()];
    const factoryContract = new web3.eth.Contract(UNISWAP_FACTORY_JSON.abi, _allAddrs.uniswapFactory);
    const pairAddress = await factoryContract.methods.getPair(token.address, _allAddrs.weth).call();
    return pairAddress;
};

const queryReserves = async (tokenSymbol, print = false) => {
    const symbol = tokenSymbol.toLowerCase();
    const pairAddr = await queryPairAddress(symbol);
    const pairContract = new web3.eth.Contract(UNISWAP_PAIR_JSON.abi, pairAddr);
    const reserves = await pairContract.methods.getReserves().call();
    let resWeth, resToken;
    if (reserves[0] !== '0' && reserves[1] !== '0') {
        const token0Addr = await pairContract.methods.token0().call();
        resWeth = reserves[(token0Addr == _allAddrs.weth) ? 0 : 1];
        resToken = reserves[(token0Addr == _allAddrs.weth) ? 1 : 0];

        if (print) {
            log.debug('reserve WETH =', web3.utils.fromWei(resWeth),
                `, reserve ${symbol} =`, web3.utils.fromWei(resToken),
                `--> price: WETH/${symbol} = ${resWeth / resToken} and`, `${symbol}/WETH=${resToken / resWeth}`);
        }
    } else {
        log.debug('WARNING: One of the reserves is 0');
    }
    return [resWeth, resToken];
};

/* ************************************************************************* */

const float2TokenUnits = (num, decimals = 18) => {
    let [integral, fractional] = String(num).split('.');
    if (fractional === undefined) {
        return integral + '0'.repeat(decimals);
    }
    fractional = fractional + '0'.repeat(decimals - fractional.length);
    return integral !== '0' ?  integral + fractional : fractional;
};

/* ************************************************************************* */

const getAllAddrs = () => {
    if (Object.keys(_allAddrs).length === 0) {
        _allAddrs = _loadAddresses();
    }
    return _allAddrs;
};

const assembleTokenSet = () => {
    if (Object.keys(_tokenSet).length === 0) {
        _allAddrs = getAllAddrs();
        const prices = loadTokenPrices();

        Object.entries(REAL_TOKEN_JSONS)
            .forEach(([symbol, json]) => {
                _tokenSet[symbol] = {
                    json,
                    address: _allAddrs[symbol],
                    price: prices[symbol]
                };
            });

        Object.keys(LENDING_TOKENS)
            .forEach(symbol => {
                _tokenSet[symbol] = {
                    json: ERC20_INSTANCE_JSON,
                    address: _allAddrs[symbol],
                    price: prices[symbol]
                };
            });
    }
    return _tokenSet;
};

const filterTokenSet = (tokenSet, excludedTokens = []) => {
    const filteredTokenSet = { ...tokenSet };
    const _excludedTokens = new Set(excludedTokens)

    if (Object.keys(filteredTokenSet).length > 0) {
        for (const [symbol, _] of Object.entries(tokenSet)) {
            if (_excludedTokens.has(symbol)) {
                delete filteredTokenSet[symbol];
            }
        }
    }
    return filteredTokenSet;
};

/* ************************************************************************* */

const CONTRACTS = {
	DAI: "dai",
	BNB: "bnb",
	ZRX: "zrx",
    AAVE: "aave",
    COMP: "comp",
    BZRX: "bzrx",
    CEL: "cell",
    YFII: "yfii",
    MKR: "mkr",
    ENZF: "enzf",
    YFI: "yfi",

    WETH: "weth",
    UNISWAP_FACTORY: "uniswapFactory",
    UNISWAP_ROUTER: "uniswapRouter",

    INDEXFUND: "indexFund",
    INDEXTOKEN: "indexToken",
    ORACLE: "oracle",

}

const getContract = (contract) => {
    if (!contract) {
        throw new Error("Contract is not defined")
    }

    if(Object.keys(_allAddrs).length === 0) {
        _allAddrs = getAllAddrs();
    }

    switch (contract) {
        case CONTRACTS.DAI:
            return new web3.eth.Contract(DAI_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.BNB:
            return new web3.eth.Contract(BNB_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.ZRX:
            return new web3.eth.Contract(ZRX_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.AAVE:
        case CONTRACTS.COMP:
        case CONTRACTS.BZRX:
        case CONTRACTS.CEL:
        case CONTRACTS.YFII:
        case CONTRACTS.MKR:
        case CONTRACTS.ENZF:
        case CONTRACTS.YFI:
            return new web3.eth.Contract(ERC20_INSTANCE_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.WETH:
            return new web3.eth.Contract(WETH_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.UNISWAP_FACTORY:
            return new web3.eth.Contract(UNISWAP_FACTORY_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.UNISWAP_ROUTER:
            return new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.INDEX_FUND_JSON:
            return new web3.eth.Contract(INDEX_FUND_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.INDEX_TOKEN_JSON:
            return new web3.eth.Contract(INDEX_TOKEN_JSON.abi, _allAddrs[contract]);
        case CONTRACTS.ORACLE:
            return new web3.eth.Contract(ORACLE_JSON.abi, _allAddrs[contract]);
    }
}



/* ************************************************************************* */

module.exports = {
    storeAddresses,
    storeTokenPrices,
    storeItcTokens,

    loadTokenPrices,
    loadItsaTokenInfo,
    loadLastUniswapPrices,
    assembleTokenSet,
    filterTokenSet,
    queryEthBalance,
    queryIndexBalance,
    queryTokenBalance,
    queryPairAddress,
    queryReserves,

    getContract,
    CONTRACTS,

    getAllAddrs,
    float2TokenUnits,
    log
};