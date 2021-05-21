const web3 = require('./getWeb3');
const log = require('../config/logger');

const {
    DAI_JSON,
    BNB_JSON,
    ZRX_JSON,

    WETH_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    INDEX_TOKEN_JSON,
    ORACLE_JSON,
    ETF_JSON
} = require('./constants.js');


const {
    storeAddresses,
    queryReserves,
    getAllAddrs,
    float2TokenUnits,
    assembleTokenSet,
} = require('./utils');

const mintDaiToAdmin = async ({ msgSender, value, tokenAddr, tokenJson }) => {
    const daiContract = new web3.eth.Contract(tokenJson.abi, tokenAddr);
    const decimals = parseInt(await daiContract.methods.decimals().call());
    await daiContract.methods.mint(msgSender, web3.utils.toBN(String(value) + '0'.repeat(decimals))).send({
        from: msgSender,
        gas: '3000000'
    });
};

const transferToken = async ({ tokenSymbol, value, msgSender }) => {
    const token = tokenSet[tokenSymbol.toLowerCase()];
    const tokenContract = new web3.eth.Contract(token.json.abi, tokem.address);
    const decimals = await tokenContract.methods.decimals().call();
    await tokenContract.methods.transfer(msgSender, web3.utils.toBN(String(value) + "0".repeat(decimals))).send({
        from: msgSender,
        gas: '3000000'
    });
    let balance = await tokenContract.methods.balanceOf(msgSender).call();
    log.debug(`${msgSender} has`, balance, ' token units = ', web3.utils.toBN(balance) / (10 ** parseInt(decimals)), tokenSymbol);
};



/* **************************************************************************************************** */



const deployContract = async ({ name, msgSender, contractJson, args }) => {
    log.debug(`\nDeploying ${name} contract  ...`);
    log.debug("Using account:", msgSender);

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
            log.debug(`Gas used (${name}): `, txReceipt.gasUsed);
        });
    log.debug(`Contract ${name} deployed at: `, contractAddress);
    return contractAddress;
};


const addLiquidityExactWETH = async ({ ethAmount, rate, msgSender, tokenAddr, tokenJson, routerAddr }) => {
    const tokenContract = new web3.eth.Contract(tokenJson.abi, tokenAddr);
    const symbol = await tokenContract.methods.symbol().call();
    const decimals = await tokenContract.methods.decimals().call();
    log.info(`******** ADD LIQUIDITY ${symbol}/WETH ********`);

    /** Approve before adding liquidity */
    const tokenAmount = ethAmount * rate;
    const tokenAmountInUnit = float2TokenUnits(tokenAmount, decimals);
    log.debug('APRROVING', ethAmount * rate, `${symbol} to Uniswap Router...`);
    await tokenContract.methods.approve(routerAddr, web3.utils.toBN(tokenAmountInUnit)).send({
        from: msgSender,
        gas: '3000000'
    });

    const amountTokenDesired = web3.utils.toBN(tokenAmountInUnit);
    const amountTokenMin = web3.utils.toBN(float2TokenUnits(1, decimals));
    const amountETHMin = web3.utils.toBN(float2TokenUnits(1, decimals));
    const to = msgSender;
    const deadline = String(Math.floor(Date.now() / 1000) + 5);

    log.debug(`Adding ${ethAmount} ETH and ${tokenAmount} ${symbol} to pool`);
    const routerContract = new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, routerAddr);
    await routerContract.methods.addLiquidityETH(
        tokenAddr,
        amountTokenDesired,
        amountTokenMin,
        amountETHMin,
        to,
        deadline
    ).send({
        from: msgSender,
        value: web3.utils.toWei(String(ethAmount), "ether"),
        gas: '5000000'
    });

    log.debug("***************************************");
};

const deploy = async () => {
    const accounts = await web3.eth.getAccounts();
    const trustedOracleServer = accounts[1];

    allAddr.indexToken = await deployContract({
        name: 'Index Token',
        msgSender: admin,
        contractJson: INDEX_TOKEN_JSON,
        args: [float2TokenUnits(initialSupply)]
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

    allAddr.bnb = await deployContract({
        name: 'BNB',
        msgSender: admin,
        contractJson: BNB_JSON,
        args: [String(initialSupply) + '0'.repeat(18), 'BNB', 18, 'BNB']
    });

    allAddr.zrx = await deployContract({
        name: 'ZRX',
        msgSender: admin,
        contractJson: ZRX_JSON,
        args: []
    });

    allAddr.weth = await deployContract({
        name: 'WETH',
        msgSender: admin,
        contractJson: WETH_JSON,
        args: []
    });

    // --------------------------------

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


    storeAddresses(allAddr);
    log.debug('Finished contract deployments');
};

const setUpETF = async () => {
    const oracleInstance = new web3.eth.Contract(ORACLE_JSON.abi, allAddr.oracle);
    await oracleInstance.methods.addClient(allAddr.etf).send({
        from: admin,
        gas: '3000000'
    });

    const indexTokenInstance = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddr.indexToken);
    await indexTokenInstance.methods.transfer(allAddr.etf, float2TokenUnits(initialSupply)).send({
        from: admin,
        gas: '3000000'
    });
};

const mintTokens = async ({ tokenSymbol, value, receiver }) => {
    tokenSet = assembleTokenSet();
    const token = tokenSet[tokenSymbol];
    await mintDaiToAdmin({
        msgSender: receiver,
        value,
        tokenAddr: token.address,
        tokenJson: token.json
    });
};

const provisionLiquidity = async (ethAmount) => {
    for (const [symbol, token] of Object.entries(tokenSet)) {
        const tokenContract = new web3.eth.Contract(token.json.abi, token.address);
        const decimals = parseInt(await tokenContract.methods.decimals().call());

        const adminTokenBalance = await tokenContract.methods.balanceOf(admin).call();
        log.debug(`\nadmin has ${adminTokenBalance} token units = ${web3.utils.toBN(adminTokenBalance) / (10 ** decimals)} ${symbol}\n`);

        await addLiquidityExactWETH({
            ethAmount,
            rate: token.price,
            msgSender: admin,
            tokenAddr: token.address,
            tokenJson: token.json,
            routerAddr: allAddr.uniswapRouter
        });

        await queryReserves(symbol, true);
    };
};

const setDeployGlobalVars = () => {
    if (Object.keys(allAddr).length == 0) {
        allAddr = getAllAddrs();
    }
    tokenSet = assembleTokenSet();
    return [allAddr, tokenSet];
};

const setUp = async () => {
    setDeployGlobalVars();

    await setUpETF();
    await mintTokens({ tokenSymbol: 'dai', value: 1000000, receiver: admin });
    await provisionLiquidity(4);
};


const main = async () => {
    await deploy();
    await setUp();
};


let allAddr = {};
let tokenSet = {};
const initialSupply = 1000000;

let admin;
(async () => { admin = (await web3.eth.getAccounts())[0]; })();

if ((process.env.NODE_ENV).toUpperCase() !== 'TEST') {
    main().finally(() => {
        web3.currentProvider.disconnect();
    });
}

module.exports = {
    deploy,
    setUp,
    setUpETF,
    setDeployGlobalVars,
    mintTokens,
    provisionLiquidity,
    initialSupply,
};

