const fs = require('fs');

const web3 = require('./getWeb3');
const {
    PATH_ADDRESS_FILE,
    PATH_TOKENPRICE_FILE,
    UNISWAP_FACTORY_JSON,
    UNISWAP_PAIR_JSON,
    TOKEN_JSONS,
    INDEX_TOKEN_JSON
} = require('./constants.js');

let _tokenSet = {};
let _allAddr = {};

/* ************************************************************************* */

const storeAddresses = (addresses) => {
    pickle(addresses, PATH_ADDRESS_FILE);
};

const storeTokenPrices = (tokenPrices) => {
    pickle(tokenPrices, PATH_TOKENPRICE_FILE);
};

const pickle = (obj, path) => {
    const json = JSON.stringify(obj, null, 4);
    fs.writeFileSync(path, json, (err) => {
        if (err) throw err;
        console.log('\nJson file saved at:', savePath);
    });
};


const _loadAddresses = () => {
    return load(PATH_ADDRESS_FILE, 'Contract Addresses');
};

const loadTokenPrices = () => {
    return load(PATH_TOKENPRICE_FILE, 'Token Prices');
};

const load = (path, objName) => {
    let obj = {};
    if (fs.existsSync(path)) {
        const jsonData = fs.readFileSync(path, 'utf-8');
        obj = JSON.parse(jsonData.toString());
        console.log(`INFO: ${objName} Loaded: `, obj);
    } else {
        console.log(`INFO: Skip loading ${objName}!`);
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
    const indexContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, _allAddr.indexToken);
    return (await indexContract.methods.balanceOf(account).call());

};

const queryPairAddress = async (tokenSymbol) => {
    const token = _tokenSet[tokenSymbol.toLowerCase()];
    const factoryContract = new web3.eth.Contract(UNISWAP_FACTORY_JSON.abi, _allAddr.uniswapFactory);
    const pairAddress = await factoryContract.methods.getPair(token.address, _allAddr.weth).call();
    return pairAddress;
};

const queryReserves = async ({ tokenSymbol, print = false }) => {
    const symbol = tokenSymbol.toLowerCase()
    const pairAddr = await queryPairAddress(symbol);
    const pairContract = new web3.eth.Contract(UNISWAP_PAIR_JSON.abi, pairAddr);
    const reserves = await pairContract.methods.getReserves().call();
    let resWeth, resToken;
    if (reserves[0] !== '0' && reserves[1] !== '0') {
        const token0Addr = await pairContract.methods.token0().call();
        resWeth = reserves[(token0Addr == _allAddr.weth) ? 0 : 1];
        resToken = reserves[(token0Addr == _allAddr.weth) ? 1 : 0];

        if (print) {
            console.log('reserve WETH =', web3.utils.fromWei(resWeth),
                `, reserve ${symbol} =`, web3.utils.fromWei(resToken),
                `--> price: WETH/${symbol} = ${resWeth / resToken} and`, `${symbol}/WETH=${resToken / resWeth}`);
        }
    } else {
        console.log('WARNING: One of the reserves is 0');
    }
    return resWeth, resToken;
};

/* ************************************************************************* */

const float2TokenUnits = (num, decimals=18) => {
    const [integral, fractional] = String(num).split('.');
    if (fractional === undefined)
        return integral + '0'.repeat(decimals);
    return integral + fractional + '0'.repeat(decimals - fractional.length);
};

/* ************************************************************************* */

const getAllAddrs = () => {
    if (Object.keys(_allAddr).length === 0) {
        _allAddr = _loadAddresses()
    }
    return _allAddr;
};

const assembleTokenSet = () => {
    if (Object.keys(_tokenSet).length === 0) {
        _allAddr = getAllAddrs();
        const prices = loadTokenPrices();

        Object.entries(TOKEN_JSONS).forEach(([symbol, json]) => {
            _tokenSet[symbol] = {
                json,
                address: _allAddr[symbol],
                price: prices[symbol]
            };
        });
    }
    return _tokenSet;
};

const _setUtilsGlobalVars = () => {
    console.log("Setting Utils Global Vars")
    _allAddr = _loadAddresses();
    _tokenSet = assembleTokenSet();
};

/* ************************************************************************* */

module.exports = {
    _setUtilsGlobalVars,
    storeAddresses,
    storeTokenPrices,
    loadTokenPrices,
    assembleTokenSet,
    queryEthBalance,
    queryIndexBalance,
    queryTokenBalance,
    queryPairAddress,
    queryReserves,
    getAllAddrs,
    float2TokenUnits
};