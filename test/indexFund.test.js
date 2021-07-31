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
let componentAddrs;
let componentJsons;

const expectAmountsOut = async (eth2Component = true, amountEthInEach = '1') => {
    const path = eth2Component ? [allAddrs.weth, ''] : ['', allAddrs.weth];
    const expectedAmountsOut = [];
    for (i = 0; i < componentAddrs.length; i++) {
        const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
        const decimals = await componentContract.methods.decimals().call();

        path[eth2Component ? 1 : 0] = componentAddrs[i];
        const amountIn = (amountEthInEach.length <= 10) ?  float2TokenUnits(amountEthInEach, decimals) : amountEthInEach;
        // const amountIn = float2TokenUnits(amountEthInEach, decimals);
        const amountsOut = await routerContract.methods.getAmountsOut(amountIn, path).call();
        expectedAmountsOut.push(amountsOut[1]);
    }
    return expectedAmountsOut;
};


const expectPrices = async (amountEthInEach = '1') => {
    const expectedAmountsOut = await expectAmountsOut(true, amountEthInEach);
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

        const componentPrices = await expectPrices();
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

        const expectedComponentAmountsOut = await expectAmountsOut();
        const componentPrices = await expectPrices();
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


        const expectedAmountsOut = await expectPrices();
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

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(),
            `Incorrect Index Price: expected ${expectedIndexPrice}, but got ${actualIndexPrice}`
        );
    });



    it('should purchase Index Tokens properly (regular price calc + with frontrunning prevention)', async () => {
        const indexTokenTotalSupplyBefore = BN(await indexContract.methods.totalSupply().call());
        assert.strictEqual(indexTokenTotalSupplyBefore.gt(BN(0)), true, 'Total supply is 0');

        const expectedComponentAmountsOut = await expectAmountsOut();

        /**
         * -----------------------------------------------------------------
         * compute the expected tokens to mint
         */
        const componentPricesBefore = await expectPrices();
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

        /**
         * -----------------------------------------------------------------
         * Execute the purchasing process on-chain
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





    it('should sell back Index Tokens properly', async () => {

        let indexBalanceOfInvestorBefore = await indexContract.methods.balanceOf(investor).call();
        console.log('INVESTOR BALANCE: ', indexBalanceOfInvestorBefore);

        // selling 10% of index tokens
        const saleAmount = BN(indexBalanceOfInvestorBefore).mul(BN(10)).div(BN(100)).toString();
        console.log('SALE AMOUNT: ', saleAmount);

        const expectedEthOut = await expectAmountsOut(false, BN(saleAmount).div(BN(componentAddrs.length)).toString());
        console.log('EXPECTED AMOUNTS OUT: ', expectedEthOut);

        await indexContract.methods.approve(allAddrs.indexFund, saleAmount).send({
            from: investor,
            gas: '5000000'
        });

        const allowanceOfIndexFund = await indexContract.methods.allowance(investor, allAddrs.indexFund).call();
        assert(allowanceOfIndexFund, saleAmount, 'saleAmount does not match allowance');

        const ethOfInvestorBefore = await web3.eth.getBalance(investor);
        console.log("ethOfInvestorBefore", ethOfInvestorBefore);

        /**
         * -----------------------------------------------------------------
         * Execute the selling process on-chain
         */
        const tx = await fundContract.methods.sell(expectedEthOut).send({
            from: investor,
            gas: '5000000'
        });

        // console.log("TX", tx);

        const gasUsed = tx.gasUsed;
        const gasPrice = (await web3.eth.getTransaction(tx.transactionHash)).gasPrice;
        const txFees = BN(gasUsed).mul(BN(gasPrice));
        console.log("txFees", txFees.toString());

        let expectedTotalEthOut = BN(0);
        expectedEthOut.map(amountOut => expectedTotalEthOut = expectedTotalEthOut.add(BN(amountOut)));
        console.log("expectedTotalEthOut", expectedTotalEthOut.toString());

        const expectedEthIncreaseOfInvestor = expectedTotalEthOut.sub(txFees);
        const expectedCurrentEthOfInvestor = BN(ethOfInvestorBefore).add(expectedEthIncreaseOfInvestor).toString();

        const actualEthOfInvestor = await web3.eth.getBalance(investor);
        console.log("actualEthOfInvestor", actualEthOfInvestor);

        assert.deepStrictEqual(actualEthOfInvestor, expectedCurrentEthOfInvestor,
            `Incorrect investor's ETH balance: expected ${expectedCurrentEthOfInvestor}, but got ${actualEthOfInvestor}`
        );

        const actualIndexBalanceOfInvestor = await indexContract.methods.balanceOf(investor).call();
        const expectedIndexBalanceOfInvestor = BN(indexBalanceOfInvestorBefore).sub(BN(saleAmount)).toString();
        assert.deepStrictEqual(actualIndexBalanceOfInvestor, expectedIndexBalanceOfInvestor,
            `Incorrect investor's Index balance: expected ${expectedIndexBalanceOfInvestor}, but got ${actualIndexBalanceOfInvestor}`
        );

        // Test component balance of index fund
    });
});