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

const expectComponentAmountsOut = async (amountEthInEach = 1) => {
    path = [allAddrs.weth, ''];
    const expectedAmountsOut = [];
    for (i = 0; i < componentAddrs.length; i++) {
        const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
        const decimals = await componentContract.methods.decimals().call();

        path[1] = componentAddrs[i];
        const amountsOut = await routerContract.methods.getAmountsOut(float2TokenUnits(amountEthInEach, decimals), path).call();
        expectedAmountsOut.push(amountsOut[1]);
    }
    return expectedAmountsOut;
};


const expectComponentPrices = async (amountEthInEach = 1) => {
    const expectedAmountsOut = await expectComponentAmountsOut(amountEthInEach);
    const expectedPrices = [];

    for (i = 0; i < expectedAmountsOut.length; i++) {
        const componentPrice = BN('1' + '0'.repeat(18 * 2)).div(BN(expectedAmountsOut[i]));
        expectedPrices.push(componentPrice.toString());
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
        assert.strictEqual(totalSupply.eq(BN(0)), true, 'Total supply > 0');

        const componentPrices = await expectComponentPrices();
        let expectedIndexPrice = BN(0);
        for (let i = 0; i < componentPrices.length; i++) {
            expectedIndexPrice = expectedIndexPrice.add(BN(componentPrices[i]));
        }

        expectedIndexPrice = expectedIndexPrice.div(BN(componentPrices.length));
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(), `Incorrect Index Price expected ${expectedIndexPrice}, but got ${actualIndexPrice}`);

    });

    it('should properly buy Index Tokens (nominal price calc + no frontrunning prevention)', async () => {
        const totalSupply = BN(await indexContract.methods.totalSupply().call());
        assert.strictEqual(totalSupply.eq(BN(0)), true, 'Total supply > 0');

        const expectedComponentAmountsOut = await expectComponentAmountsOut();
        const componentPrices = await expectComponentPrices();
        let componentPriceSum = BN(0);
        for (i = 0; i < componentPrices.length; i++) {
            componentPriceSum = componentPriceSum.add(BN(componentPrices[i]));
        }
        const indexPrice = componentPriceSum.div(BN(componentPrices.length));

        const ethAmount = web3.utils.toWei(String(componentAddrs.length), "ether");
        const expectedIndexTokenAmount = BN(ethAmount + '0'.repeat(18)).div(indexPrice);

        await fundContract.methods.buy([]).send({
            from: investor,
            value: ethAmount,
            gas: '5000000'
        });

        const indexFundEthBalance = await web3.eth.getBalance(allAddrs.indexFund);
        assert.strictEqual(indexFundEthBalance, '0');

        const investorIndexBalance = await indexContract.methods.balanceOf(investor).call();
        assert.strictEqual(investorIndexBalance, expectedIndexTokenAmount.toString(), `Expected ${expectedIndexTokenAmount} itokens but got ${investorIndexBalance}`);


        for (i = 0; i < componentAddrs.length; i++) {
            const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            const actualAmountOut = await componentContract.methods.balanceOf(allAddrs.indexFund).call();
            assert.strictEqual(actualAmountOut, expectedComponentAmountsOut[i]);
        }
    });


    it('should return correct Index price when totalSupply > 0', async () => {
        const totalSupply = BN(await indexContract.methods.totalSupply().call());
        assert.strictEqual(totalSupply.gt(BN(0)), true, 'Total supply is 0');


        const expectedAmountsOut = await expectComponentPrices();
        let expectedIndexPrice = BN(0);
        for (let i = 0; i < expectedAmountsOut.length; i++) {
            const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            const componentPrice = BN(expectedAmountsOut[i]);
            // console.log('tokenPrice', tokenPrice);
            const tokenBalanceOfIndexFund = BN(await componentContract.methods.balanceOf(allAddrs.indexFund).call());
            expectedIndexPrice = expectedIndexPrice.add(componentPrice.mul(tokenBalanceOfIndexFund));
        }

        expectedIndexPrice = expectedIndexPrice.div(totalSupply);
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        console.log("INDEX PRICE: ", actualIndexPrice);

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(), `Incorrect Index Price expected ${expectedIndexPrice}, but got ${actualIndexPrice}`);
    });



    it('should purchase Index Tokens properly (regular price calc + with frontrunning prevention)', async () => {
        const indexTokenTotalSupplyBefore = BN(await indexContract.methods.totalSupply().call());
        assert.strictEqual(indexTokenTotalSupplyBefore.gt(BN(0)), true, 'Total supply is 0');

        const expectedComponentAmountsOut = await expectComponentAmountsOut();

        /**
         * -----------------------------------------------------------------
         * compute the expected tokens to mint
         */
        const componentPricesBefore = await expectComponentPrices();
        const componentBalancesOfIndexFundBefore = [];
        for (i = 0; i < componentAddrs.length; i++) {
            const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            componentBalancesOfIndexFundBefore[i] = BN(await componentContract.methods.balanceOf(allAddrs.indexFund).call());
        }
        let indexPrice = BN(0);
        for (i = 0; i < componentPricesBefore.length; i++) {
            indexPrice = indexPrice.add(componentBalancesOfIndexFundBefore[i].mul(BN(componentPricesBefore[i])));
        }
        indexPrice = indexPrice.div(indexTokenTotalSupplyBefore);

        const ethAmount = web3.utils.toWei(String(componentAddrs.length), "ether");
        const expectedAmountToMint = BN(ethAmount + '0'.repeat(18)).div(indexPrice);

        /**
         * -----------------------------------------------------------------
         * inspect the index token balance of investor before buying for later comparison
         */
        const balanceOfInvestorBefore = await indexContract.methods.balanceOf(investor).call();
        console.log('INVESTOR BALANCE BEFORE: ', balanceOfInvestorBefore);

        /**
         * -----------------------------------------------------------------
         * Execute the purchase on-chain
         */
        await fundContract.methods.buy(expectedComponentAmountsOut).send({
            from: investor,
            value: ethAmount,
            gas: '5000000'
        });

        /**
         * -----------------------------------------------------------------
         * Make sure IndexFund does not hold ETH
         */
        const indexFundEthBalance = await web3.eth.getBalance(allAddrs.indexFund);
        assert.strictEqual(indexFundEthBalance, '0');

        /**
         * -----------------------------------------------------------------
         * check the increase in index token balance of investor
         */
        const expectedInvestorIndexBalance = BN(balanceOfInvestorBefore).add(expectedAmountToMint).toString();
        const actualInvestorIndexBalance = await indexContract.methods.balanceOf(investor).call();

        assert.strictEqual(actualInvestorIndexBalance, expectedInvestorIndexBalance,
            `Expected ${expectedInvestorIndexBalance} index tokens but got ${actualInvestorIndexBalance}`
        );

        console.log('INVESTOR BALANCE AFTER: ', actualInvestorIndexBalance);
        console.log('MINTED: ', expectedAmountToMint.toString());

        /**
         * -----------------------------------------------------------------
         * check the increases in component balances of IndexFund
         */
        for (i = 0; i < componentAddrs.length; i++) {
            const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            const componentBalanceOfIndexFundAfter = BN(await componentContract.methods.balanceOf(allAddrs.indexFund).call());
            const actualAmountOut = componentBalanceOfIndexFundAfter.sub(componentBalancesOfIndexFundBefore[i]).toString();
            assert.strictEqual(actualAmountOut, expectedComponentAmountsOut[i]);
        }
    });



    // const expectEthAmountsOut = async (amountInEach = 1) => {
    //     path = ['', allAddrs.weth];
    //     const expectedAmountsOut = [];
    //     for (i = 0; i < componentAddrs.length; i++) {
    //         const tokenContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
    //         const decimals = await tokenContract.methods.decimals().call();

    //         path[0] = componentAddrs[i];
    //         const amounts = await routerContract.methods.getAmountsOut(float2TokenUnits(amountInEach, decimals), path).call();
    //         const amountEth = amounts[1];
    //         expectedAmountsOut.push(amountEth);
    //     }
    //     return expectedAmountsOut;
    // };


    // it('should sell back Index Tokens properly', async () => {
    //     const expectedAmountsOut = await expectEthAmountsOut();

    //     let investorBalance = await indexContract.methods.balanceOf(investor).call();
    //     console.log('INVESTOR BALANCE: ', investorBalance);
    //     console.log('EXPECTED AMOUNTS OUT: ', expectedAmountsOut);

    // const indexTokenAmount = web3.utils.toWei(String(tokenAddrs.length), "ether");
    // const minPrices = []
    // await fundContract.methods.buy(minPrices).send({
    //     from: investor,
    //     value: ethAmount,
    //     gas: '5000000'
    // });

    // const indexFundEthBalance = await web3.eth.getBalance(allAddrs.indexFund);
    // assert.strictEqual(indexFundEthBalance, '0');

    // for (i = 0; i < tokenAddrs.length; i++) {
    //     const tokenContract = new web3.eth.Contract(tokenJsons[i].abi, tokenAddrs[i]);
    //     const actualAmountOut = await tokenContract.methods.balanceOf(allAddrs.indexFund).call();
    //     assert.strictEqual(actualAmountOut, expectedAmountsOut[i]);
    // }

    // const investorIndexBalance = await indexContract.methods.balanceOf(investor).call();
    // assert.strictEqual(investorIndexBalance,ethAmount, `Expected ${ethAmount} itokens but got ${investorIndexBalance}`)
    // });
});