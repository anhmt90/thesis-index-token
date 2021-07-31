const fs = require('fs');
const assert = require('assert');
const web3 = require('../src/getWeb3');
const BN = web3.utils.toBN;

const log = require('../config/logger');

const {
    INDEX_TOKEN_JSON,
    INDEX_FUND_JSON,
    PATH_ADDRESS_FILE,
    UNISWAP_ROUTER_JSON,
    DAI_JSON
} = require('./fixtures/constants');

const {
    deployAllContracts,
    setUpIndexFund,
    setDeployGlobalVars,
    mintTokens,
    provisionLiquidity,
    initialSupply
} = require('../src/deploy');

const {
    setIndexFundGlobalVars,
    setPortfolio,
} = require('../src/indexFund');


const {
    queryReserves,
    float2TokenUnits,
    queryTokenBalance
} = require('../src/utils');

let accounts;
let allAddrs;
let tokenSet;
let admin;
let investor;
let indexContract;
let fundContract;
let routerContract;
let path;
let componentAddrs;
let componentJsons;

const expectComponentPrice = async (amountEthInEach = 1) => {
    path = [allAddrs.weth, ''];
    const expectedPrices = [];
    for (i = 0; i < componentAddrs.length; i++) {
        const tokenContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
        const decimals = await tokenContract.methods.decimals().call();

        path[1] = componentAddrs[i];
        const amountsOut = await routerContract.methods.getAmountsOut(float2TokenUnits(amountEthInEach, decimals), path).call();
        console.log('Component', i, ':', amountsOut[1])

        const componentSwapRate = BN('1' + '0'.repeat(18*2)).div(BN(amountsOut[1]))
        expectedPrices.push(componentSwapRate.toString());
    }
    return expectedPrices;
};

before(async () => {
    console.log('Index Fund Test Cases');

    if (fs.existsSync(PATH_ADDRESS_FILE))
        fs.unlinkSync(PATH_ADDRESS_FILE);

    await deployAllContracts();
    [allAddrs, tokenSet] = setDeployGlobalVars();
    indexContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddrs.indexToken);
    fundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    routerContract = new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, allAddrs.uniswapRouter);
    setIndexFundGlobalVars();

    accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    investor = accounts[2];

    await setPortfolio();
    // await setUpIndexFund();
    // await mintTokens({ tokenSymbol: 'dai', value: 1000000, receiver: admin });
    // await provisionLiquidity(ethProvisioned);

    componentAddrs = Object.values(tokenSet).map(token => token.address);
    componentJsons = Object.values(tokenSet).map(token => token.json);
});


describe('Deploy and setup smart contracts', () => {

    it('should deploy Index Token and Index Fund Contracts', () => {
        assert.ok(allAddrs.indexToken);
        assert.ok(allAddrs.indexFund);
    });

    it(`should have 0 totalSupply in IndexToken after deployment`, async () => {
        // await setUpIndexFund();
        const totalSupply = await indexContract.methods.totalSupply().call();
        assert.strictEqual('0', totalSupply);

        const indexFundIdxBalance = await indexContract.methods.balanceOf(allAddrs.indexFund).call();
        assert.strictEqual('0', indexFundIdxBalance);
    });

    it(`should mint ${initialSupply} DAI to admin`, async () => {
        await mintTokens({ tokenSymbol: 'dai', value: initialSupply, receiver: admin });
        const daiContract = new web3.eth.Contract(DAI_JSON.abi, allAddrs.dai);
        const adminDaiBalance = await daiContract.methods.balanceOf(admin).call();
        assert.strictEqual(float2TokenUnits(initialSupply), adminDaiBalance);
    });

});

describe('Uniswap lidquidity provision', () => {
    it(' should provision all Uniswap ERC20/WETH pools with the expected liquidity', async () => {
        const ethAmount = 20;
        await provisionLiquidity(ethAmount);

        for (const [symbol, token] of Object.entries(tokenSet)) {
            const [actualWeth, actualToken] = await queryReserves(symbol);
            const expectedWeth = float2TokenUnits(ethAmount);
            assert.strictEqual(expectedWeth, actualWeth, `expected ${expectedWeth} wei but got ${actualWeth}`);
            const expectedTokenAmount = float2TokenUnits(ethAmount * token.price);
            assert.strictEqual(actualToken, expectedTokenAmount, `expected ${expectedTokenAmount} token units but got ${actualToken}`);
        }

    });
});



describe('IndexFund functionalities', () => {
    it('checks if portfolio is properly set in Index Fund smart contract', async () => {
        const expectedTokenNames = Object.keys(tokenSet).map(name => name.toLowerCase());
        const actualTokenNames = (await fundContract.methods.getNamesInPortfolio().call()).map(name => name.toLowerCase());

        assert.deepStrictEqual(actualTokenNames, expectedTokenNames, 'Token names not match');

        const expectedTokenAddrs = Object.values(tokenSet).map(token => token.address);
        const actualTokenAddrs = await fundContract.methods.getAddressesInPortfolio().call();
        assert.deepStrictEqual(actualTokenAddrs, expectedTokenAddrs, 'Token addresses not match');
    });

    it('should return correct *nominal* Index price when totalSupply = 0', async () => {
        const totalSupply = BN(await indexContract.methods.totalSupply().call());
        assert.strictEqual(totalSupply.eq(BN(0)), true, 'Total supply is not 0');

        const componentPrices = await expectComponentPrice();
        let expectedIndexPrice = BN(0);
        for (let i = 0; i < componentPrices.length; i++) {
            expectedIndexPrice = expectedIndexPrice.add(BN(componentPrices[i]));
        }

        expectedIndexPrice = expectedIndexPrice.div(BN(componentPrices.length));
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(), `Incorrect Index Price expected ${expectedIndexPrice}, but got ${actualIndexPrice}`);

    });

    it('should purchase Index Tokens properly', async () => {
        const expectedAmountsOut = await expectComponentPrice();

        const ethAmount = web3.utils.toWei(String(componentAddrs.length), "ether");
        const amountsOutMin = []
        await fundContract.methods.buy(amountsOutMin).send({
            from: investor,
            value: ethAmount,
            gas: '5000000'
        });

        const indexFundEthBalance = await web3.eth.getBalance(allAddrs.indexFund);
        assert.strictEqual(indexFundEthBalance, '0');

        for (i = 0; i < componentAddrs.length; i++) {
            const tokenContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            const actualAmountOut = await tokenContract.methods.balanceOf(allAddrs.indexFund).call();
            assert.strictEqual(actualAmountOut, expectedAmountsOut[i]);
        }

        const investorIndexBalance = await indexContract.methods.balanceOf(investor).call();
        assert.strictEqual(investorIndexBalance, ethAmount, `Expected ${ethAmount} itokens but got ${investorIndexBalance}`)
    });

    it('should return correct Index price when totalSupply > 0', async () => {
        const totalSupply = BN(await indexContract.methods.totalSupply().call());
        assert.strictEqual(totalSupply.gt(new BN(0)), true, 'Total supply is 0');


        const expectedAmountsOut = await expectComponentPrice();
        let expectedIndexPrice = BN(0);
        for (let i = 0; i < expectedAmountsOut.length; i++) {
            const tokenContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            const tokenPrice = BN(expectedAmountsOut[i]);
            // console.log('tokenPrice', tokenPrice);
            const tokenBalanceOfIndexFund = BN(await tokenContract.methods.balanceOf(allAddrs.indexFund).call());
            expectedIndexPrice = expectedIndexPrice.add(tokenPrice.mul(tokenBalanceOfIndexFund));
        }

        expectedIndexPrice = expectedIndexPrice.div(totalSupply);
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        console.log("INDEX PRICE: ", actualIndexPrice);

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(), `Incorrect Index Price expected ${expectedIndexPrice}, but got ${actualIndexPrice}`);
    });

    it('should purchase Index Tokens properly (with frontrunning prevention)', async () => {
        const expectedAmountsOut = await expectComponentPrice();

        const tokenBalancesOfIndexFundBefore = []
        for (i = 0; i < componentAddrs.length; i++) {
            const tokenContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            tokenBalancesOfIndexFundBefore[i] = BN(await tokenContract.methods.balanceOf(allAddrs.indexFund).call());
        }

        let investorBalance = await indexContract.methods.balanceOf(investor).call();
        console.log('INVESTOR BALANCE BEFORE: ', investorBalance);

        const ethAmount = web3.utils.toWei(String(componentAddrs.length), "ether");
        // const amountsOutMin = expectedAmountsOut;
        const amountsOutMin = [];
        await fundContract.methods.buy(amountsOutMin).send({
            from: investor,
            value: ethAmount,
            gas: '5000000'
        });

        const indexFundEthBalance = await web3.eth.getBalance(allAddrs.indexFund);
        assert.strictEqual(indexFundEthBalance, '0');

        for (i = 0; i < componentAddrs.length; i++) {
            const tokenContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            const tokenBalanceOfIndexFundAfter = BN(await tokenContract.methods.balanceOf(allAddrs.indexFund).call());
            const actualAmountOut = tokenBalanceOfIndexFundAfter.sub(tokenBalancesOfIndexFundBefore[i]).toString();
            assert.strictEqual(actualAmountOut, expectedAmountsOut[i]);
        }

        investorBalance = await indexContract.methods.balanceOf(investor).call();
        console.log('INVESTOR BALANCE AFTER: ', investorBalance);

        const investorIndexBalance = await indexContract.methods.balanceOf(investor).call();
        assert.strictEqual(investorIndexBalance,ethAmount, `Expected ${ethAmount} index tokens but got ${investorIndexBalance}`)
    });

});