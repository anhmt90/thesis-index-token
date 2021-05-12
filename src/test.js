var wtf = require('wtfnode');

const web3 = require('./getWeb3');

const {
    UNISWAP_PAIR_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    DAI_JSON,
    ETF_JSON
} = require('./constants');

const { getEthBalance, loadAddresses } = require("./utils");
const allAddr = loadAddresses();

const getPairAddress = async ({ tokenA, tokenB, factoryAddr = allAddr.uniswapFactory }) => {
    const factoryInstance = new web3.eth.Contract(UNISWAP_FACTORY_JSON.abi, factoryAddr);
    const pairAddress = await factoryInstance.methods.getPair(tokenA, tokenB).call();
    console.log('Pair address', pairAddress);

    return pairAddress;
};

const addLiquidityExactWETH = async ({ ethAmount, msgSender, tokenAddr, tokenJson, routerAddr = allAddr.uniswapRouter }) => {
    const price = '2';

    const tokenInstance = new web3.eth.Contract(tokenJson.abi, tokenAddr);
    const tokenDecimals = await tokenInstance.methods.decimals().call();
    await tokenInstance.methods.approve(routerAddr, web3.utils.toBN(String('100') + "0".repeat(tokenDecimals))).send({
        from: msgSender,
        gas: '3000000'
    });

    const routerInstance = new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, routerAddr);
    await routerInstance.methods.addLiquidityETH(
        tokenAddr,
        web3.utils.toBN(String(price) + '0'.repeat(tokenDecimals)),
        web3.utils.toBN('1' + '0'.repeat(tokenDecimals)),
        '1000000000000000000',
        msgSender,
        String(Math.floor(Date.now() / 1000) + 10)
    ).send({
        from: msgSender,
        value: web3.utils.toWei(String(ethAmount), "ether"),
        gas: '5000000'
    });
};

const run = async () => {
    const accounts = await web3.eth.getAccounts();
    const admin = accounts[0];
    const investor = accounts[2];

    console.log("DAI address=", allAddr.dai);
    console.log("WETH address=", allAddr.weth);

    /**
     * Get address of DAI/WETH pool
     */
    const dai_wethPairAddr = await getPairAddress({
        tokenA: allAddr.dai,
        tokenB: allAddr.weth
    });

    console.log('Pool DAI/WETH at: ', dai_wethPairAddr);

    /**
     * Add Liquidity into DAI/WETH pool with LP being admin
     */
    await addLiquidityExactWETH({
        ethAmount: 1,
        msgSender: admin,
        tokenAddr: allAddr.dai,
        tokenJson: DAI_JSON,
        routerAddr: allAddr.uniswapRouter
    });

    /**
     * Get pool's info
     */
    const dai_wethInstance = new web3.eth.Contract(UNISWAP_PAIR_JSON.abi, dai_wethPairAddr);
    const token0Addr = await dai_wethInstance.methods.token0().call();
    console.log('Token 0 is', token0Addr === allAddr.weth ? 'WETH' : token0Addr === allAddr.dai ? 'DAI' : 'unknown!');

    const reserves = await dai_wethInstance.methods.getReserves().call();
    console.log('reserve0=', reserves[0], ', reserve1=', reserves[1]);

    // const res0 = Res0 * (10 ** 18);
    console.log('price=', token0Addr === allAddr.weth ? (reserves[0] / reserves[1]) : (reserves[1] / reserves[0]));

    console.log("Calling getTokenPrice() from ETF...");
    const etfInstance = new web3.eth.Contract(ETF_JSON.abi, allAddr.etf);
    const onchainPrice = await etfInstance.methods.getTokenPrice(dai_wethPairAddr).call();
    console.log("Token Price (onchain)=", onchainPrice);

    /**
     * Set portfolio
     */
    const tokenNames = ['DAI'];
    const tokenAddresses = [allAddr.dai];
    await etfInstance.methods.setPorfolio(tokenNames, tokenAddresses).send({
        from: admin,
        gas: '3000000'
    });
    console.log('SUCCESS: Portfolio set!');


    /**
     * Test token ordering
     */
    const daiInstance = new web3.eth.Contract(DAI_JSON.abi, allAddr.dai);
    let daiBalanceEtf = await daiInstance.methods.balanceOf(allAddr.etf).call();
    let daiBalanceAdmin = await daiInstance.methods.balanceOf(admin).call();

    console.log('DAI balance of ETF (before): ', web3.utils.fromWei(daiBalanceEtf));
    console.log('DAI balance of admin (before): ', web3.utils.fromWei(daiBalanceAdmin));

    console.log('Account balance of ETF (before): ', await getEthBalance(allAddr.etf));
    console.log('Wallet balance of Investor (before): ', await getEthBalance(investor));

    const ethToSwap = 2;
    console.log('Swapping', ethToSwap, ' ethers for DAI')
    const txReceipt = await etfInstance.methods.orderTokens(1).send({
        from: investor,
        value: web3.utils.toWei(String(ethToSwap), "ether"),
        gas: '3000000'
    });
    daiBalanceEtf = await daiInstance.methods.balanceOf(allAddr.etf).call();
    console.log('DAI balance of ETF (after): ', web3.utils.fromWei(daiBalanceEtf));
    console.log('Account balance of ETF (before): ', await getEthBalance(allAddr.etf));
    console.log('Wallet balance of Investor (before): ', await getEthBalance(investor));
};

run().finally(() => {
    // console.log("Active Handles: ", process._getActiveHandles())
    // console.log("Active Reqs: ", process._getActiveRequests())
    web3.currentProvider.disconnect();
    // wtf.dump()
    // process.exit();
});

