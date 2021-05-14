const fs = require('fs');

const web3 = require('./getWeb3');
const { ADDRESS_FILE } = require('./constants.js');

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

module.exports = {
    storeAddresses,
    loadAddresses,
    getEthBalance,
    getERC20Balance
};