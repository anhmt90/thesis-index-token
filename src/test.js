var wtf = require('wtfnode');

const web3 = require('./getWeb3');

const {
    UNISWAP_PAIR_JSON,
    UNISWAP_FACTORY_JSON,
    UNISWAP_ROUTER_JSON,
    DAI_JSON,
    INDEX_TOKEN_JSON,
    ETF_JSON
} = require('./constants');

const {
    queryEthBalance,
    queryIndexBalance,
    queryTokenBalance,
    getAllAddrs,
    assembleTokenSet,
    float2TokenUnits
} = require("./utils");

const testGetIndexPrice = async () => {
    const etfContract = new web3.eth.Contract(ETF_JSON.abi, allAddr.etf);
    const indexPrice = await etfContract.methods.getIndexPrice().call();
    console.log('INDEX PRICE:', indexPrice);
}

const testSwap = async () => {
    const etfContract = new web3.eth.Contract(ETF_JSON.abi, allAddr.etf);
    const decimals = (new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddr.indexToken)).methods.decimals().call();

    const ethIn = (1 / 0.997);
    let amountsOut = await etfContract.methods.getAmountsOutForExactETH(float2TokenUnits(ethIn, decimals)).call();
    console.log("Real amount outputs (before swap):", amountsOut);

    /**
     * Test token ordering
     */
    console.log('DAI balance of ETF (before swap):', await queryTokenBalance({ tokenSymbol: 'dai', account: allAddr.etf }));
    console.log('ETH balance of ETF (before swap):', await queryEthBalance(allAddr.etf));
    console.log('INDEX balance of ETF (before swap):', await queryIndexBalance(allAddr.etf));

    console.log('Wallet balance of Investor (before swap):', await queryEthBalance(investor));
    const tokenSet = assembleTokenSet()

    const ethToSwap = (1 / 0.997) * Object.keys(tokenSet).length;
    console.log('Swapping', ethToSwap, `ETH (= ${float2TokenUnits(ethToSwap)} wei) for DAI`);
    await etfContract.methods.orderTokens(float2TokenUnits(ethToSwap)).send({
        from: investor,
        value: web3.utils.toWei(String(ethToSwap), "ether"),
        gas: '5000000'
    });

    console.log('DAI balance of ETF (after swap):', await queryTokenBalance({ tokenSymbol: 'dai', account: allAddr.etf }));
    console.log('ETH balance of ETF (after swap):', await queryEthBalance(allAddr.etf));
    console.log('Wallet balance of Investor (after swap):', await queryEthBalance(investor));

    console.log("******************************************************");

    amountsOut = await etfContract.methods.getAmountsOutForExactETH('1' + '0'.repeat(18)).call();
    console.log("Real amount outputs (after swap):", web3.utils.fromWei(amountsOut[0]));
};

const setPortfolio = async () => {
    const etfContract = new web3.eth.Contract(ETF_JSON.abi, allAddr.etf);
    /**
     * Set portfolio
     */
    const tokenSet = assembleTokenSet();
    const tokenNames = Object.keys(tokenSet).map(symbol => symbol.toUpperCase());
    const tokenAddresses = Object.values(tokenSet).map(({ address }) => address);
    await etfContract.methods.setPorfolio(tokenNames, tokenAddresses).send({
        from: admin,
        gas: '3000000'
    });
    console.log('SUCCESS: Portfolio set!');
    const portfolioNamesOnchain = await etfContract.methods.getNamesInPortfolio().call();
    console.log('PORTFOLIO NAMES ONCHAIN:', portfolioNamesOnchain);

    const portfolioAddrsOnchain = await etfContract.methods.getAddressesInPortfolio().call();
    console.log('PORTFOLIO ADDRS ONCHAIN:', portfolioAddrsOnchain);
};

const run = async () => {
    // _setUtilsGlobalVars();

    const accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    investor = accounts[2];

    await setPortfolio();
    await testGetIndexPrice();
    await testSwap();
    /** ================================================================= */

    /** ================================================================= */

};

const allAddr = getAllAddrs();
let admin;
let investor;

run().finally(() => {
    // console.log("Active Handles: ", process._getActiveHandles())
    // console.log("Active Reqs: ", process._getActiveRequests())
    web3.currentProvider.disconnect();
    // wtf.dump()
    // process.exit();
});

