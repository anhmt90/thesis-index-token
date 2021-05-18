const fs = require('fs');

const web3 = require('./getWeb3');
const {
    PATH_ADDRESS_FILE,
    PATH_TOKENPRICE_FILE,
    UNISWAP_FACTORY_JSON,
    UNISWAP_PAIR_JSON
} = require('./constants.js');

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


const loadAddresses = () => {
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

const getEthBalance = async (account) => {
    return web3.utils.fromWei(await web3.eth.getBalance(account), 'ether');
};

const getERC20Balance = async ({ tokenJson, tokenAddr, account }) => {
    const tokenContract = new web3.eth.Contract(tokenJson.abi, tokenAddr);
    return (await tokenContract.methods.balanceOf(account).call());

};

const getPairAddress = async (allAddr, tokenSymbol) => {
    const factoryContract = new web3.eth.Contract(UNISWAP_FACTORY_JSON.abi, allAddr.uniswapFactory);
    const pairAddress = await factoryContract.methods.getPair(allAddr[tokenSymbol.toLowerCase()], allAddr.weth).call();
    return pairAddress;
};

const getReservesWETH_ERC20 = async (allAddr, tokenSymbol, print = false) => {
    const pairAddr = await getPairAddress(allAddr, tokenSymbol);
    const pairContract = new web3.eth.Contract(UNISWAP_PAIR_JSON.abi, pairAddr);
    const reserves = await pairContract.methods.getReserves().call();
    let resWeth, resErc20;
    if (reserves[0] !== '0' && reserves[1] !== '0') {
        const token0Addr = await pairContract.methods.token0().call();
        resWeth = reserves[(token0Addr == allAddr.weth) ? 0 : 1];
        resErc20 = reserves[(token0Addr == allAddr.weth) ? 1 : 0];

        if (print) {
            console.log('reserve WETH =', web3.utils.fromWei(resWeth),
                `, reserve ${tokenSymbol} =`, web3.utils.fromWei(resErc20),
                `--> price: WETH/${tokenSymbol} = ${resWeth / resErc20} and`, `${tokenSymbol}/WETH=${resErc20 / resWeth}`);
        }
    } else {
        console.log('WARNING: One of the reserves is 0');
    }
    return resWeth, resErc20;
};

const float2TokenUnits = (num, decimals) => {
    const [integral, fractional] = String(num).split('.');
    if (fractional === undefined)
        return integral + '0'.repeat(decimals);
    return integral + fractional + '0'.repeat(decimals - fractional.length);
};


module.exports = {
    storeAddresses,
    storeTokenPrices,
    loadAddresses,
    loadTokenPrices,
    getEthBalance,
    getERC20Balance,
    getPairAddress,
    getReservesWETH_ERC20,
    float2TokenUnits
};