const web3 = require('./getWeb3');
const log = require('../config/logger');

const {
    DAI_JSON,
    BNB_JSON,
    ZRX_JSON,
    ERC20_INSTANCE_JSON,

    WETH_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    INDEX_TOKEN_JSON,
    ORACLE_JSON,
    INDEX_FUND_JSON,
    LENDING_TOKENS
} = require('./constants.js');


const {
    storeAddresses,
    queryReserves,
    getAllAddrs,
    float2TokenUnits,
    assembleTokenSet,
    filterTokenSet,
    computeFutureAddress,
    getContract,
    CONTRACTS,
    calcTokenAmountFromEthAmountAndPoolPrice,
    getAddress,

    BN,
    Ether,
    ETHER
} = require('./utils');


const mintDaiToAdmin = async ({ msgSender, value, tokenAddr, tokenJson }) => {
    const daiContract = new web3.eth.Contract(tokenJson.abi, tokenAddr);
    const decimals = parseInt(await daiContract.methods.decimals().call());
    await daiContract.methods.mint(msgSender, BN(String(value) + '0'.repeat(decimals))).send({
        from: msgSender,
        gas: '3000000'
    });
};

const transferToken = async ({ tokenSymbol, value, msgSender }) => {
    const token = tokenSet[tokenSymbol];
    const tokenContract = new web3.eth.Contract(token.json.abi, tokem.address);
    const decimals = parseInt(await tokenContract.methods.decimals().call());
    await tokenContract.methods.transfer(msgSender, BN(String(value) + "0".repeat(decimals))).send({
        from: msgSender,
        gas: '3000000'
    });
    let balance = await tokenContract.methods.balanceOf(msgSender).call();
    log.debug(`${msgSender} has`, balance, ' token units = ', BN(balance).div(BN('1' + '0'.repeat(decimals))), tokenSymbol);
};



/* **************************************************************************************************** */

const deployContract = async ({ name, msgSender, contractJson, args }) => {
    log.debug(`\nDeploying ${name} contract  ...`);
    log.debug("Using account:", msgSender);
    log.debug("Arguments:", args);

    let contractAddress;
    const contractInstance = new web3.eth.Contract(contractJson.abi);
    await contractInstance.deploy({
        data: contractJson.bytecode,
        arguments: args
    })
        .send({
            from: msgSender,
            gas: '8000000'
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



const addLiquidityExactWETH = async ({ ethAmount, msgSender, symbol, price }) => {
    const tokenContract = getContract(CONTRACTS[symbol.toUpperCase()]);
    const decimals = await tokenContract.methods.decimals().call();
    log.info(`******** ADD LIQUIDITY ${symbol}/WETH ********`);

    /** Approve before adding liquidity */
    const tokenAmountInUnit = calcTokenAmountFromEthAmountAndPoolPrice(ethAmount, price, decimals);
    log.debug('APRROVING', tokenAmountInUnit, `units of ${symbol} to Uniswap Router...`);
    await tokenContract.methods.approve(allAddrs.uniswapRouter, BN(tokenAmountInUnit)).send({
        from: msgSender,
        gas: '3000000'
    });

    const amountTokenDesired = BN(tokenAmountInUnit);
    const amountTokenMin = BN(float2TokenUnits(1, decimals));
    const amountETHMin = BN(float2TokenUnits(1, decimals));
    const to = msgSender;
    const deadline = String(Math.floor(Date.now() / 1000) + 5);

    log.debug(`Adding ${ethAmount} ETH and ${tokenAmountInUnit} ${symbol} to pool`);
    const routerContract = getContract(CONTRACTS.UNISWAP_ROUTER);
    await routerContract.methods.addLiquidityETH(
        allAddrs[symbol],
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

const deployAuxContracts = async () => {
    if (!admin) await setAccounts();

    allAddrs.DAI = await deployContract({
        name: CONTRACTS.DAI,
        msgSender: admin,
        contractJson: DAI_JSON,
        args: [1337]
    });

    allAddrs.BNB = await deployContract({
        name: CONTRACTS.BNB,
        msgSender: admin,
        contractJson: BNB_JSON,
        args: [String(initialSupply) + '0'.repeat(18), 'BNB', 18, 'BNB']
    });

    allAddrs.ZRX = await deployContract({
        name: CONTRACTS.ZRX,
        msgSender: admin,
        contractJson: ZRX_JSON,
        args: []
    });

    const getDecimals = (symbol) => {
        switch (symbol) {
            case CONTRACTS.CEL:
                return 4;
            default:
                return 18;
        }
    };

    for (const [symbol, name] of Object.entries(LENDING_TOKENS)) {
        const decimals = getDecimals(symbol);

        allAddrs[symbol] = await deployContract({
            name: symbol,
            msgSender: admin,
            contractJson: ERC20_INSTANCE_JSON,
            args: [name, symbol, decimals]
        });
    }

    allAddrs.WETH = await deployContract({
        name: CONTRACTS.WETH,
        msgSender: admin,
        contractJson: WETH_JSON,
        args: []
    });

    // --------------------------------

    allAddrs.uniswapFactory = await deployContract({
        name: 'UniswapV2Factory',
        msgSender: admin,
        contractJson: UNISWAP_FACTORY_JSON,
        args: [admin]
    });

    allAddrs.uniswapRouter = await deployContract({
        name: 'UniswapV2Router02',
        msgSender: admin,
        contractJson: UNISWAP_ROUTER_JSON,
        args: [allAddrs.uniswapFactory, allAddrs.WETH]
    });


    storeAddresses(allAddrs);
    log.info('Finished deployments of auxiliary contracts');
    log.info('-------------------------------------------------------------');
};

const deployCoreContracts = async (componentNames) => {
    // const futureIndexFundAddr = await computeFutureAddress(admin, 1)
    // log.debug('Future INDEX TOKEN address:', futureIndexFundAddr);

    allAddrs.oracle = await deployContract({
        name: 'Oracle',
        msgSender: admin,
        contractJson: ORACLE_JSON,
        args: []
    });

    let componentAddrs = [];
    const preparePortfolio = (portfolio) => {
        /**
         * Set portfolio
         */
        if (portfolio.length === 0) {
            throw Error("indexFund: cannot set empty portfolio");
        }
        // portfolio = portfolio.map(component => component.toUpperCase());

        componentNames = portfolio;
        componentAddrs = portfolio.map(component => allAddrs[component]);
    };

    preparePortfolio(componentNames);
    allAddrs.indexFund = await deployContract({
        name: 'IndexFund',
        msgSender: admin,
        contractJson: INDEX_FUND_JSON,
        args: [
            componentNames,
            componentAddrs,
            allAddrs.uniswapRouter,
            allAddrs.oracle
        ]
    });

    const fundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);

    allAddrs.indexToken = await fundContract.methods.indexToken().call();
    log.debug('INDEX FUND deployed at:', allAddrs.indexFund);

    // const indexTokenContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddrs.indexToken);
    // await indexTokenContract.methods.transferOwnership(allAddrs.indexFund).send({
    //     from: admin,
    //     gas: '3000000'
    // })

    allAddrs.indexToken = await fundContract.methods.indexToken().call();
    log.debug('INDEX TOKEN deployed at:', allAddrs.indexToken);

    const oracleContract = new web3.eth.Contract(ORACLE_JSON.abi, allAddrs.oracle);
    await oracleContract.methods.setIndexFund(allAddrs.indexFund).send({
        from: admin,
        gas: '3000000'
    });

    allAddrs.oracle = await fundContract.methods.oracle().call();
    log.debug('ORACLE deployed at:', allAddrs.oracle);

    const portfolioNamesOnchain = await fundContract.methods.getComponentSymbols().call();
    log.debug('PORTFOLIO NAMES ONCHAIN:', portfolioNamesOnchain);

    const portfolioAddrsOnchain = await fundContract.methods.getAddressesInPortfolio().call();
    log.debug('PORTFOLIO ADDRS ONCHAIN:', portfolioAddrsOnchain);

    storeAddresses(allAddrs);
    log.info('Finished deployments of IndexFund, IndexToken and Oracle contracts');
    log.info('-------------------------------------------------------------');
};

const mintTokens = async ({ tokenSymbol, value, receiver }) => {
    const token = tokenSet[tokenSymbol];
    await mintDaiToAdmin({
        msgSender: receiver,
        value,
        tokenAddr: token.address,
        tokenJson: token.json
    });
};

const provisionLiquidity = async (ethAmount) => {
    for (const [symbol, token] of Object.entries(uniswapTokenSet)) {
        const tokenContract = new web3.eth.Contract(token.json.abi, token.address);
        const decimals = parseInt(await tokenContract.methods.decimals().call());

        let adminTokenBalance = await tokenContract.methods.balanceOf(admin).call();
        log.debug(`\nBefore providing liquidity: admin has ${adminTokenBalance} token units = ${BN(adminTokenBalance).div(BN('1' + '0'.repeat(decimals)))} ${symbol}`);

        await addLiquidityExactWETH({
            ethAmount,
            msgSender: admin,
            symbol,
            price: token.price,
            // tokenAddr: token.address,
            // tokenJson: token.json,
            // routerAddr: allAddrs.uniswapRouter
        });
        await queryReserves(symbol, true);

        adminTokenBalance = await tokenContract.methods.balanceOf(admin).call();
        log.debug(`After providing liquidity: admin has ${adminTokenBalance} token units = ${BN(adminTokenBalance).div(BN('1' + '0'.repeat(decimals)))} ${symbol}\n`);
    };

    log.debug('DONE PROVIDING LIQUIDITY');
};

const setDeployGlobalVars = (_tokensNotOnUniswap = []) => {
    if (Object.keys(allAddrs).length === 0) {
        allAddrs = getAllAddrs();
    }
    tokenSet = assembleTokenSet();
    uniswapTokenSet = filterTokenSet(tokenSet, _tokensNotOnUniswap);
    return [allAddrs, tokenSet, uniswapTokenSet];
};

const setUp = async () => {
    setDeployGlobalVars(tokensNotOnUniswap);

    await mintTokens({ tokenSymbol: CONTRACTS.DAI, value: 1000000, receiver: admin });
    await provisionLiquidity(300);

    await increasePoolPricesForTesting();
    await reducePoolPricesForTesting();
};

const increasePoolPricesForTesting = async () => {
    log.debug("--- increasePoolPricesForTesting() ---");

    // increase YFI token price
    let amounts = await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
        0,
        [allAddrs.WETH, allAddrs.YFI],
        investor,
        ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
    ).send({
        from: investor,
        value: Ether('100'),
        gas: '5000000'
    })


    // increase MRK token price
    await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
        0,
        [allAddrs.WETH, allAddrs.MKR],
        investor,
        ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
    ).send({
        from: investor,
        value: Ether('50'),
        gas: '5000000'
    });
};


const reducePoolPricesForTesting = async () => {
    log.debug("--- reducePoolPricesForTesting() ---");
    // increase YFI token price
    const brzxAmount = "1000000" + '0'.repeat(18);

    await getContract(CONTRACTS.BZRX).methods.approve(allAddrs.uniswapRouter, brzxAmount).send({
        from: admin,
        gas: '5000000'
    });

    await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactTokensForETH(
        "1000000" + '0'.repeat(18),
        "0",
        [allAddrs.BZRX, allAddrs.WETH],
        admin,
        ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
    ).send({
        from: admin,
        gas: '5000000'
    });

};

const main = async () => {
    await deployAuxContracts();
    await deployCoreContracts(initialPortfolio);
    await setUp();
};


let allAddrs = {};
let tokenSet;
let uniswapTokenSet;
const initialSupply = 1000000;
const tokensNotOnUniswap = [CONTRACTS.DAI, CONTRACTS.BNB, CONTRACTS.ZRX, CONTRACTS.ENZF];
const initialPortfolio = [CONTRACTS.AAVE, CONTRACTS.COMP, CONTRACTS.BZRX, CONTRACTS.CEL, CONTRACTS.YFII];


let admin;
let investor;

const setAccounts = async () => {
    accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    investor = accounts[2];
};
(async () => { await setAccounts(); });

if ((process.env.NODE_ENV).toUpperCase() !== 'TEST') {
    main().finally(() => {
        web3.currentProvider.disconnect();
    });
}

module.exports = {
    deployAuxContracts,
    deployCoreContracts,
    setUp,
    setDeployGlobalVars,
    mintTokens,
    provisionLiquidity,
    initialSupply,
};

