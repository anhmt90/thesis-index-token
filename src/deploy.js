// const ganache = require('ganache-cli');
// const web3 = new Web3(ganache.provider());
const Web3 = require('web3');
// const web3 = new Web3("http://localhost:8545");

// Ref.: https://hanezu.net/posts/Enable-WebSocket-support-of-Ganache-CLI-and-Subscribe-to-Events.html
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));

const TOKEN_CONTRACT_JSON = require('../build/contracts/IndexToken.json');
const ORACLE_CONTRACT_JSON = require('../build/contracts/Oracle.json');
const INVESTMENT_CONTRACT_JSON = require('../build/contracts/PassiveInvestment.json');

let admin;
let trustedOracleServer;


const deployTokenContract = async () => {
    console.log("\nDeploying Token contract...");
    console.log("Using account: ", admin);

    let contractAddress;
    const tokenContractInstance = new web3.eth.Contract(TOKEN_CONTRACT_JSON.abi);
    await tokenContractInstance.deploy({
        data: TOKEN_CONTRACT_JSON.bytecode,
        arguments: ["100000"]
    })
        .send({
            from: admin,
            gas: '3000000'
        })
        .on('receipt', async (txReceipt) => {
            if (txReceipt.contractAddress) {
                contractAddress = txReceipt.contractAddress;
            }
            // const costPaid = txReceipt.gasUsed * web3.utils.fromWei(await web3.eth.getGasPrice(), 'ether');
            console.log("Gas used (token): ", txReceipt.gasUsed);
        });

    return contractAddress;
};


const deployOracleContract = async () => {
    console.log("\nDeploying Oracle contract...");
    console.log("Using account: ", admin);
    console.log("Using trusted Oracle server: ", trustedOracleServer);

    let contractAddress;
    const oracleContractInstance = new web3.eth.Contract(ORACLE_CONTRACT_JSON.abi);
    await oracleContractInstance.deploy({
        data: ORACLE_CONTRACT_JSON.bytecode,
        arguments: [trustedOracleServer]
    })
        .send({
            from: admin,
            gas: '3000000'
        })
        .on('receipt', async (txReceipt) => {
            if (txReceipt.contractAddress) {
                contractAddress = txReceipt.contractAddress;
            }

            console.log("Gas used (oracle): ", txReceipt.gasUsed);

        });

    return contractAddress;
};


const deployInvestmentContract = async (tokenContractAddress, oracleContractAddress) => {
    console.log("\nDeploying Investment contract...");
    console.log("Using account: ", admin);

    let contractAddress;
    const investmentContractInstance = new web3.eth.Contract(INVESTMENT_CONTRACT_JSON.abi);
    await investmentContractInstance.deploy({
        data: INVESTMENT_CONTRACT_JSON.bytecode,
        arguments: [tokenContractAddress, oracleContractAddress]
    })
        .send({
            from: admin,
            gas: '3000000'
        })
        .on('receipt', async (txReceipt) => {
            if (txReceipt.contractAddress) {
                contractAddress = txReceipt.contractAddress;
            }
            console.log("Gas used (investment): ", txReceipt.gasUsed);
        });
    return contractAddress;
};

let tokenContractAddress;
let oracleContractAddress;
let investmentContractAddress;

(async () => {
    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    trustedOracleServer = accounts[1];

    tokenContractAddress = await deployTokenContract();
    console.log("Token contract deployed at: ", tokenContractAddress);

    oracleContractAddress = await deployOracleContract();
    console.log("Oracle contract deployed at: ", oracleContractAddress);

    investmentContractAddress = await deployInvestmentContract(tokenContractAddress, oracleContractAddress);
    console.log("Investment contract deployed at: ", investmentContractAddress);


    const oracleContractInstance = new web3.eth.Contract(ORACLE_CONTRACT_JSON.abi, oracleContractAddress);
    await oracleContractInstance.methods.addClient(investmentContractAddress).send({
        from: admin,
        gas: '3000000'
    });

    const tokenContractInstance = new web3.eth.Contract(TOKEN_CONTRACT_JSON.abi, tokenContractAddress);
    await tokenContractInstance.methods.transfer(investmentContractAddress, 80000).send({
        from: admin,
        gas: '3000000'
    })

})();
