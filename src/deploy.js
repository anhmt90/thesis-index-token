const fs = require('fs');

// const ganache = require('ganache-cli');
// const web3 = new Web3(ganache.provider());

const Web3 = require('web3');
// const web3 = new Web3("http://localhost:8545");

// Ref.: https://hanezu.net/posts/Enable-WebSocket-support-of-Ganache-CLI-and-Subscribe-to-Events.html
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));

const DAI_JSON = require(`./token-jsons/Dai.json`);
const WETH_JSON = require('@uniswap/v2-periphery/build/WETH9.json');
const UNISWAP_FACTORY_JSON = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const UNISWAP_ROUTER_JSON = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');


const ETF_TOKEN_JSON = require('../build/contracts/IndexToken.json');
const ORACLE_JSON = require('../build/contracts/Oracle.json');
const ETF_JSON = require('../build/contracts/PassiveInvestment.json');

let admin;
let trustedOracleServer;


const deployTokenContract = async () => {
    console.log("\nDeploying Token contract...");
    console.log("Using account: ", admin);

    let contractAddress;
    const tokenContractInstance = new web3.eth.Contract(ETF_TOKEN_JSON.abi);
    await tokenContractInstance.deploy({
        data: ETF_TOKEN_JSON.bytecode,
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
    const oracleContractInstance = new web3.eth.Contract(ORACLE_JSON.abi);
    await oracleContractInstance.deploy({
        data: ORACLE_JSON.bytecode,
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


const deployEtfContract = async (tokenContractAddress, oracleContractAddress) => {
    console.log("\nDeploying ETF contract...");
    console.log("Using account: ", admin);

    let contractAddress;
    const investmentContractInstance = new web3.eth.Contract(ETF_JSON.abi);
    await investmentContractInstance.deploy({
        data: ETF_JSON.bytecode,
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

const deployContract = async ({name, msgSender, contractJson, args}) => {
    console.log(`\nDeploying contract ${name} ...`);
    console.log("Using account: ", msgSender);

    let contractAddress;
    const contractInstance = new web3.eth.Contract(contractJson.abi);
    await contractInstance.deploy({
        data: contractJson.bytecode,
        arguments: args
    })
        .send({
            from: msgSender,
            gas: '3000000'
        })
        .on('receipt', async (txReceipt) => {
            if (txReceipt.contractAddress) {
                contractAddress = txReceipt.contractAddress;
            }
            console.log(`Gas used (${name}): `, txReceipt.gasUsed);
        });
    console.log(`Contract ${name} deployed at: `, contractAddress)
    return contractAddress;
};


let tokenContractAddress;
let oracleContractAddress;
let etfContractAddress;

(async () => {
    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    trustedOracleServer = accounts[1];

    tokenContractAddress = await deployTokenContract();
    console.log("Token contract deployed at: ", tokenContractAddress);

    oracleContractAddress = await deployOracleContract();
    console.log("Oracle contract deployed at: ", oracleContractAddress);

    etfContractAddress = await deployEtfContract(tokenContractAddress, oracleContractAddress);
    console.log("Investment contract deployed at: ", etfContractAddress);


    const oracleContractInstance = new web3.eth.Contract(ORACLE_JSON.abi, oracleContractAddress);
    await oracleContractInstance.methods.addClient(etfContractAddress).send({
        from: admin,
        gas: '3000000'
    });

    const tokenContractInstance = new web3.eth.Contract(ETF_TOKEN_JSON.abi, tokenContractAddress);
    await tokenContractInstance.methods.transfer(etfContractAddress, 80000).send({
        from: admin,
        gas: '3000000'
    });


    // --------------------------------
    const dai = deployContract({
        name: 'DAI',
        msgSender: admin,
        contractJson: DAI_JSON,
        args: [1337]
    })

    const daiInstance = new web3.eth.Contract(DAI_JSON.abi, dai);
    await daiInstance.methods.mint(admin, web3.utils.toBN('1000' + "0".repeat(18))).send({
        from: admin,
        gas: '3000000'
    });

    const weth = deployContract({
        name: 'WETH',
        msgSender: admin,
        contractJson: WETH_JSON,
        args: []
    })

    const uniswapFactory = deployContract({
        name: 'UniswapV2Factory',
        msgSender: admin,
        contractJson: UNISWAP_FACTORY_JSON,
        args: []
    })

    const uniswapRouter = deployContract({
        name: 'UniswapV2Router02',
        msgSender: admin,
        contractJson: UNISWAP_ROUTER_JSON,
        args: [uniswapFactory, weth]
    })

    //-------------------------------------

    const contractAddressesJson = JSON.stringify({
        tokenContractAddress,
        oracleContractAddress,
        investmentContractAddress: etfContractAddress
    }, null, 4);

    const savePath = 'data/contractAddresses.json';
    fs.writeFile(savePath, contractAddressesJson, (err) => {
        if (err) throw err;
        console.log('\nJson file of contract addresses saved at:', savePath);
    });

})();


