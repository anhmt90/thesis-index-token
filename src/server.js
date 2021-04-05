const fs = require('fs');
const path = require('path');

// const ganache = require('ganache-cli');
// const web3 = new Web3(ganache.provider());

const Web3 = require('web3');
const web3 = new Web3("http://localhost:8545");

const TOKEN_CONTRACT =  require('../build/contracts/IndexToken.json');
const ORACLE_CONTRACT = require('../build/contracts/Oracle.json');
const INVESTMENT_CONTRACT =  require('../build/contracts/PassiveInvestment.json');

let admin;
let trustedOracleServer;


const deployTokenContract = async () => {
    console.log("\nDeploying Token contract...");
    console.log("Using account: ", admin);

    let contractAddress;
    let costPaid;
    const tokenContractInstance = new web3.eth.Contract(TOKEN_CONTRACT.abi);
    await tokenContractInstance.deploy({
        data: TOKEN_CONTRACT.bytecode,
        arguments: ["100000"]
    })
    .send({
        from: admin,
        gas: '3000000'
    })
    .on('receipt', async (txReceipt) => {
        if(txReceipt.contractAddress) {
            contractAddress = txReceipt.contractAddress;
            console.log("Deployed at address: ", contractAddress);
        }
        // costPaid = txReceipt.gasUsed * web3.utils.fromWei(await web3.eth.getGasPrice(), 'ether');
        console.log("Gas used (token): ", txReceipt.gasUsed);
    })

    return contractAddress;
};


const deployOracleContract = async () => {
    console.log("\nDeploying Oracle contract...");
    console.log("Using account: ", admin);
    console.log("Using trusted Oracle server: ", trustedOracleServer);

    let contractAddress;
    const oracleContractInstance = new web3.eth.Contract(ORACLE_CONTRACT.abi);
    await oracleContractInstance.deploy({
        data: ORACLE_CONTRACT.bytecode,
        arguments: [trustedOracleServer]
    })
    .send({
        from: admin,
        gas: '3000000'
    })
    .on('receipt', async (txReceipt) => {
        if(txReceipt.contractAddress) {
            contractAddress = txReceipt.contractAddress;
            console.log("Deployed at address: ", contractAddress);
        }

        console.log("Gas used (oracle): ", txReceipt.gasUsed);

    })

    return contractAddress;
};


const deployInvestmentContract = async (tokenContractAddress, oracleContractAddress) => {
    console.log("\nDeploying Investment contract...");
    console.log("Using account: ", admin);

    let contractAddress;
    const investmentContractInstance = new web3.eth.Contract(INVESTMENT_CONTRACT.abi);
    await investmentContractInstance.deploy({
        data: INVESTMENT_CONTRACT.bytecode,
        arguments: [tokenContractAddress, oracleContractAddress]
    })
    .send({
        from: admin,
        gas: '3000000'
    })
    .on('receipt', async (txReceipt) => {
        if(txReceipt.contractAddress) {
            contractAddress = txReceipt.contractAddress;
            console.log("Deployed at address: ", contractAddress);
        }
        console.log("Gas used (investment): ", txReceipt.gasUsed);
    })
    return contractAddress;
}

(async () => {
    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    trustedOracleServer = accounts[1];

    const tokenContractAddress = await deployTokenContract();
    console.log("Token contract at: ", tokenContractAddress);

    const oracleContractAddress = await deployOracleContract();
    console.log("Oracle contract at: ", oracleContractAddress);

    const investmentContractAddress = await deployInvestmentContract(tokenContractAddress, oracleContractAddress);
    console.log("Investment contract at: ", investmentContractAddress);

})();

