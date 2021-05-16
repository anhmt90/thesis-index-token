const fs = require('fs');

const web3 = require('./getWeb3');
const {
    ADDRESS_FILE,
    UNISWAP_FACTORY_JSON,
    UNISWAP_PAIR_JSON
} = require('./constants.js');

const storeAddresses = (addresses) => {
    const contractAddressJson = JSON.stringify(addresses, null, 4);
    fs.writeFileSync(ADDRESS_FILE, contractAddressJson, (err) => {
        if (err) throw err;
        console.log('\nJson file of contract addresses saved at:', savePath);
    });
};

const loadAddresses = () => {
    let allAddr = {};
    if (fs.existsSync(ADDRESS_FILE)) {
        const jsonData = fs.readFileSync(ADDRESS_FILE, 'utf-8');
        allAddr = JSON.parse(jsonData.toString());
    } else {
        console.log('INFO: Skip loading contract addresses!');
        console.log('INFO: All addresses: ', allAddr);
    }
    return allAddr;
};

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

module.exports = {
    storeAddresses,
    loadAddresses,
    getEthBalance,
    getERC20Balance,
    getPairAddress,
    getReservesWETH_ERC20
};