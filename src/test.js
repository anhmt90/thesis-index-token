var wtf = require('wtfnode');

const web3 = require('./getWeb3');

const {
    UNISWAP_PAIR_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    DAI_JSON,
    ETF_JSON
} = require('./constants');

const { getEthBalance, getERC20Balance, loadAddresses } = require("./utils");
const allAddr = loadAddresses();

const getPairAddress = async (tokenAddr, factoryAddr = allAddr.uniswapFactory) => {
    const factoryInstance = new web3.eth.Contract(UNISWAP_FACTORY_JSON.abi, factoryAddr);
    const pairAddress = await factoryInstance.methods.getPair(tokenAddr, allAddr.weth).call();
    return pairAddress;
};

const printPrice = async (tokenAddr, verbose = false) => {
    /**
     * Get pool's info
     */
    const pairAddr = await getPairAddress(tokenAddr);
    const pairInstance = new web3.eth.Contract(UNISWAP_PAIR_JSON.abi, pairAddr);
    const reserves = await pairInstance.methods.getReserves().call();
    if (reserves[0] !== '0' && reserves[1] !== '0') {
        const token0Addr = await pairInstance.methods.token0().call();
        console.log('reserve0 =', web3.utils.fromWei(reserves[0]),
            ', reserve1 =', web3.utils.fromWei(reserves[1]),
            '--> price:', token0Addr === allAddr.weth ? `WETH/ERC20 = ${reserves[0] / reserves[1]}` : `ERC20/WETH=${reserves[1] / reserves[0]}`);

        if (verbose) {
            const etfContract = new web3.eth.Contract(ETF_JSON.abi, allAddr.etf);
            const onchainPrice = await etfContract.methods.getTokenPrice(pairAddr).call();
            console.log("Token Price (onchain)=", web3.utils.fromWei(onchainPrice));
        }
    } else {
        console.log('WARNING: One of the reserves is 0');
    }
};

const addLiquidityExactWETH = async ({ ethAmount, msgSender, tokenAddr, tokenJson, routerAddr = allAddr.uniswapRouter }) => {
    console.log("\n******** ADD LIQUIDITY ********");
    console.log('==== Current Price:');
    await printPrice(tokenAddr, true);

    const tokenContract = new web3.eth.Contract(tokenJson.abi, tokenAddr);
    let msgSenderTokenBalance = await tokenContract.methods.balanceOf(msgSender).call();
    console.log('Token balance of', msgSender, '(before adding liquidity): ', msgSenderTokenBalance);

    /** Approve before adding liquidity */
    const tokenDecimals = await tokenContract.methods.decimals().call();

    const approvedAmount = 3724;
    console.log('APRROVING', approvedAmount, ' DAI TO ROUTER...');
    await tokenContract.methods.approve(routerAddr, web3.utils.toBN(String(approvedAmount) + "0".repeat(tokenDecimals))).send({
        from: msgSender,
        gas: '3000000'
    });

    const amountTokenDesired = web3.utils.toBN(String(approvedAmount) + '0'.repeat(tokenDecimals));
    const amountTokenMin = web3.utils.toBN('1' + '0'.repeat(tokenDecimals));
    const amountETHMin = web3.utils.toBN('1' + '0'.repeat(tokenDecimals));
    const to = msgSender;
    const deadline = String(Math.floor(Date.now() / 1000) + 10);

    console.log("Adding", ethAmount, "ethers to pool with desired tokens", approvedAmount);
    const routerInstance = new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, routerAddr);
    await routerInstance.methods.addLiquidityETH(
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

    msgSenderTokenBalance = await tokenContract.methods.balanceOf(msgSender).call();
    console.log('Token balance of', msgSender, '(after adding liquidity): ', msgSenderTokenBalance);

    console.log('==== New Price:');
    await printPrice(tokenAddr)
    console.log("******** LIQUIDITY ADDED ********\n");
};

const run = async () => {
    const accounts = await web3.eth.getAccounts();
    const admin = accounts[0];
    const investor = accounts[2];

    /**
     * Get address of DAI/WETH pool
     */
    const dai_wethPairAddr = await getPairAddress(allAddr.dai);

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

    /** ================================================================= */
    const etfContract = new web3.eth.Contract(ETF_JSON.abi, allAddr.etf);
    /**
     * Set portfolio
     */
    const tokenNames = ['DAI'];
    const tokenAddresses = [allAddr.dai];
    await etfContract.methods.setPorfolio(tokenNames, tokenAddresses).send({
        from: admin,
        gas: '3000000'
    });
    console.log('SUCCESS: Portfolio set!');
    /** ================================================================= */

    let amountsOut = await etfContract.methods.getAmountsOutForExactETH('1' + '0'.repeat(18)).call();
    console.log("Real amount outputs (before swap):", web3.utils.fromWei(amountsOut[0]));

    /**
     * Test token ordering
     */
    console.log('DAI balance of ETF (before swap):', await getERC20Balance({ tokenJson: DAI_JSON, tokenAddr: allAddr.dai, account: allAddr.etf }));
    console.log('ETH balance of ETF (before swap):', await getEthBalance(allAddr.etf));
    console.log('Wallet balance of Investor (before swap):', await getEthBalance(investor));


    const ethToSwap = 1;
    console.log('Swapping', ethToSwap, 'ethers for DAI');
    await etfContract.methods.orderTokens(1).send({
        from: investor,
        value: web3.utils.toWei(String(ethToSwap), "ether"),
        gas: '3000000'
    });

    console.log('DAI balance of ETF (after swap):', await getERC20Balance({ tokenJson: DAI_JSON, tokenAddr: allAddr.dai, account: allAddr.etf }));
    console.log('ETH balance of ETF (after swap):', await getEthBalance(allAddr.etf));
    console.log('Wallet balance of Investor (after swap):', await getEthBalance(investor));

    console.log('==== Price changed: ');
    await printPrice(allAddr.dai)

    console.log("******************************************************")

    amountsOut = await etfContract.methods.getAmountsOutForExactETH('1' + '0'.repeat(18)).call();
    console.log("Real amount outputs (after swap):", web3.utils.fromWei(amountsOut[0]));
};

run().finally(() => {
    // console.log("Active Handles: ", process._getActiveHandles())
    // console.log("Active Reqs: ", process._getActiveRequests())
    web3.currentProvider.disconnect();
    // wtf.dump()
    // process.exit();
});

