const fs = require('fs');

const web3 = require('./getWeb3')

const {
    DAI_JSON,
    WETH_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    INDEX_TOKEN_JSON,
    ORACLE_JSON,
    ETF_JSON
} = require ('./constants.js')


// if (fs.existsSync(ADDRESS_FILE)) {
//     fs.unlinkSync(ADDRESS_FILE);
//     console.log('Removed file', ADDRESS_FILE)
// }

const { storeAddresses } = require('./utils');
const allAddr = {}

const mintDai = async ({ msgSender, totalSupply, daiAddr = allAddr.dai }) => {
    const daiInstance = new web3.eth.Contract(DAI_JSON.abi, daiAddr);
    await daiInstance.methods.mint(msgSender, web3.utils.toBN(String(totalSupply) + "0".repeat(18))).send({
        from: msgSender,
        gas: '3000000'
    });
    let daiBalance = await daiInstance.methods.balanceOf(msgSender).call();
    console.log(`${msgSender} has`, daiBalance, 'wad = ', web3.utils.toBN(daiBalance) / (10 ** 18), 'dai');
};


const createPool = async ({ msgSender, tokenA, tokenB, factoryAddr = allAddr.uniswapFactory }) => {
    const factoryInstance = new web3.eth.Contract(UNISWAP_FACTORY_JSON.abi, factoryAddr);
    await factoryInstance.methods.createPair(tokenA, tokenB).send({
        from: msgSender,
        gas: '3000000'
    });

    // await getPairAddress({
    //     factoryAddr,
    //     tokenA,
    //     tokenB
    // });
};



const deployContract = async ({ name, msgSender, contractJson, args }) => {
    console.log(`\nDeploying ${name} contract  ...`);
    console.log("Using account: ", msgSender);

    let contractAddress;
    const contractInstance = new web3.eth.Contract(contractJson.abi);
    await contractInstance.deploy({
        data: contractJson.bytecode,
        arguments: args
    })
        .send({
            from: msgSender,
            gas: '5000000'
        })
        .on('receipt', async (txReceipt) => {
            if (txReceipt.contractAddress) {
                contractAddress = txReceipt.contractAddress;
            }
            console.log(`Gas used (${name}): `, txReceipt.gasUsed);
        });
    console.log(`Contract ${name} deployed at: `, contractAddress);
    return contractAddress;
};


const deploy = async () => {
    const accounts = await web3.eth.getAccounts();
    const admin = accounts[0];
    const trustedOracleServer = accounts[1];

    allAddr.indexToken = await deployContract({
        name: 'Index Token',
        msgSender: admin,
        contractJson: INDEX_TOKEN_JSON,
        args: ["1000000"]
    });

    allAddr.oracle = await deployContract({
        name: 'Oracle',
        msgSender: admin,
        contractJson: ORACLE_JSON,
        args: [trustedOracleServer]
    });


    // --------------------------------
    allAddr.dai = await deployContract({
        name: 'DAI',
        msgSender: admin,
        contractJson: DAI_JSON,
        args: [1337]
    });


    allAddr.weth = await deployContract({
        name: 'WETH',
        msgSender: admin,
        contractJson: WETH_JSON,
        args: []
    });

    allAddr.uniswapFactory = await deployContract({
        name: 'UniswapV2Factory',
        msgSender: admin,
        contractJson: UNISWAP_FACTORY_JSON,
        args: [admin]
    });

    allAddr.uniswapRouter = await deployContract({
        name: 'UniswapV2Router02',
        msgSender: admin,
        contractJson: UNISWAP_ROUTER_JSON,
        args: [allAddr.uniswapFactory, allAddr.weth]
    });

    allAddr.etf = await deployContract({
        name: 'ETF',
        msgSender: admin,
        contractJson: ETF_JSON,
        args: [allAddr.indexToken, allAddr.uniswapFactory, allAddr.uniswapRouter, allAddr.weth]
    });

    //-------------------------------------

    const oracleInstance = new web3.eth.Contract(ORACLE_JSON.abi, allAddr.oracle);
    await oracleInstance.methods.addClient(allAddr.etf).send({
        from: admin,
        gas: '3000000'
    });

    const indexTokenInstance = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddr.indexToken);
    await indexTokenInstance.methods.transfer(allAddr.etf, 800000).send({
        from: admin,
        gas: '3000000'
    });

    await mintDai({
        msgSender: admin,
        totalSupply: 1000000
    });

    await createPool({
        msgSender: admin,
        tokenA: allAddr.dai,
        tokenB: allAddr.weth
    });


    //-------------------------------------

    storeAddresses(allAddr);

};

deploy().then(() => {
    web3.currentProvider.disconnect();
    console.log('Done');
});

