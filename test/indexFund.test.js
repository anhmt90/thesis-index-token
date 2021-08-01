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

/**
 * --------------------------------------------------------------------------------
 * Helper Functions
 */

const expectAmountsOut = async (eth2Component = true, amountEthInEach = '1') => {
    const path = eth2Component ? [allAddrs.weth, ''] : ['', allAddrs.weth];
    const expectedAmountsOut = [];
    for (i = 0; i < componentAddrs.length; i++) {
        const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
        const decimals = await componentContract.methods.decimals().call();

        path[eth2Component ? 1 : 0] = componentAddrs[i];
        const amountIn = (amountEthInEach.length <= 10) ? float2TokenUnits(amountEthInEach, decimals) : amountEthInEach;
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


const getComponentBalancesOfIndexFund = async () => {
    const componentBalanceOfIndexFund = [];
    for (i = 0; i < componentAddrs.length; i++) {
        const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
        componentBalanceOfIndexFund[i] = BN(await componentContract.methods.balanceOf(allAddrs.indexFund).call());
    }
    return componentBalanceOfIndexFund;
};

const assertCorrectDiffTwoArrays = ({ arrBefore, arrCurrent, expectedDiffs }) => {
    assert.strictEqual(arrBefore.length, arrCurrent.length,
        `Two array do not have equal length, greaterArray.length=${arrBefore.length}, smallerArr.length=${arrCurrent.length}`
    );
    for (i = 0; i < arrBefore.length; i++) {
        const actualDiff = arrCurrent[i].sub(arrBefore[i]);
        assert.deepStrictEqual(actualDiff.toString(), expectedDiffs[i].toString(),
            `Wrong resulted at component ${i}, expected ${expectedDiffs[i]}, but got ${actualDiff}`
        );
    }
};

const negateBNArray = (arr) => {
    return arr.map(el => el.neg());
};

const getTxFees = async (tx) => {
    const gasUsed = tx.gasUsed;
    const gasPrice = (await web3.eth.getTransaction(tx.transactionHash)).gasPrice;
    const txFees = BN(gasUsed).mul(BN(gasPrice));
    return txFees;
};

const snapshotInvestor = async () => {
    const ethBalance = BN(await web3.eth.getBalance(investor));
    const indexBalance = BN(await indexContract.methods.balanceOf(investor).call());
    return {
        ethBalance,
        indexBalance
    };
};

const snapshotIndexFund = async () => {
    const ethBalance = BN(await web3.eth.getBalance(allAddrs.indexFund));
    const indexBalance = BN(await indexContract.methods.balanceOf(allAddrs.indexFund).call());
    const componentBalances = await getComponentBalancesOfIndexFund();
    return {
        ethBalance,
        indexBalance,
        componentBalances
    };
};

const snapshotIndexToken = async () => {
    const totalSupply = BN(await indexContract.methods.totalSupply().call());
    return { totalSupply };
};

const assertAmountDiff = (before, current, expectedDiff) => {
    const actualDiff = current.sub(before).toString();
    assert.deepStrictEqual(actualDiff, expectedDiff.toString(),
        `Expected ${expectedDiff}, but got ${actualDiff}`
    );
};

const assertEthAndIndexDiffs = (stateBefore, stateCurrent, expectedDiffs) => {
    assertAmountDiff(stateBefore.ethBalance, stateCurrent.ethBalance, expectedDiffs.ethBalance);
    assertAmountDiff(stateBefore.indexBalance, stateCurrent.indexBalance, expectedDiffs.indexBalance);
};

const assertInvestorState = async (stateBefore, expectedDiffs) => {
    const stateCurrent = await snapshotInvestor();
    assertEthAndIndexDiffs(stateBefore, stateCurrent, expectedDiffs);
};

const assertIndexFundState = async (stateBefore, expectedDiffs) => {
    const stateCurrent = await snapshotIndexFund();
    assertEthAndIndexDiffs(stateBefore, stateCurrent, expectedDiffs);

    assertCorrectDiffTwoArrays({
        arrBefore: stateBefore.componentBalances,
        arrCurrent: await getComponentBalancesOfIndexFund(),
        expectedDiffs: expectedDiffs.componentBalances
    });
};

const assertIndexTokenState = async (stateBefore, expectedDiffs) => {
    const stateCurrent = await snapshotIndexToken();
    assertAmountDiff(stateBefore.totalSupply, stateCurrent.totalSupply, expectedDiffs.totalSupply);
};


/**
 * --------------------------------------------------------------------------------
 * Helper Functions
 */

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
        snapshotIndexToken();
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


    it('should properly buy Index Tokens (nominal price calculation + no frontrunning prevention)', async () => {
        const expectedComponentAmountsOut = await expectAmountsOut();
        const componentPrices = await expectPrices();
        let componentPriceSum = BN(0);
        for (i = 0; i < componentPrices.length; i++) {
            componentPriceSum = componentPriceSum.add(BN(componentPrices[i]));
        }
        const indexPrice = componentPriceSum.div(BN(componentPrices.length));

        const ethAmount = BN(web3.utils.toWei(String(componentAddrs.length), "ether"));
        const expectedIndexTokenAmount = BN(ethAmount + '0'.repeat(18)).div(indexPrice);

        // ---------------------------------------------------
        const indexFundStateBefore = await snapshotIndexFund();
        const investorStateBefore = await snapshotInvestor();
        const indexTokenStateBefore = await snapshotIndexToken();
        assert.strictEqual(indexTokenStateBefore.totalSupply.eq(BN(0)), true, 'Total supply > 0');


        // ---------------------------------------------------
        const tx = await fundContract.methods.buy([]).send({
            from: investor,
            value: ethAmount,
            gas: '5000000'
        });

        const txFees = await getTxFees(tx);

        const expectedIndexFundDiffs = {
            ethBalance: BN(0),
            indexBalance: BN(0),
            componentBalances: expectedComponentAmountsOut
        };

        const expectedInvestorDiffs = {
            ethBalance: ethAmount.add(txFees).neg(),
            indexBalance: expectedIndexTokenAmount,
        };

        const expectedIndexTokenDiffs = {
            totalSupply: expectedIndexTokenAmount
        };

        await assertIndexFundState(indexFundStateBefore, expectedIndexFundDiffs);
        await assertInvestorState(investorStateBefore, expectedInvestorDiffs);
        await assertIndexTokenState(indexTokenStateBefore, expectedIndexTokenDiffs);

    });


    it('should return correct Index price when totalSupply > 0', async () => {
        const totalSupply = BN(await indexContract.methods.totalSupply().call());
        assert.strictEqual(totalSupply.gt(BN(0)), true, 'Total supply is 0');


        const expectedComponentPrices = await expectPrices();
        let expectedIndexPrice = BN(0);
        for (let i = 0; i < expectedComponentPrices.length; i++) {
            const componentContract = new web3.eth.Contract(componentJsons[i].abi, componentAddrs[i]);
            const componentPrice = BN(expectedComponentPrices[i]);
            // console.log('tokenPrice', tokenPrice);
            const componentBalanceOfIndexFund = BN(await componentContract.methods.balanceOf(allAddrs.indexFund).call());
            expectedIndexPrice = expectedIndexPrice.add(componentPrice.mul(componentBalanceOfIndexFund));
        }

        expectedIndexPrice = expectedIndexPrice.div(totalSupply);
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(),
            `Incorrect Index Price: expected ${expectedIndexPrice}, but got ${actualIndexPrice}`
        );
    });



    it('should purchase Index Tokens properly (regular price calcualtion + with frontrunning prevention)', async () => {
        const indexTokenStateBefore = await snapshotIndexToken();
        assert.strictEqual(indexTokenStateBefore.totalSupply.gt(BN(0)), true, 'Total supply is 0');
        /**
         * -----------------------------------------------------------------
         * compute the expected tokens to mint
         */
        const componentPricesBefore = await expectPrices();
        const componentBalancesOfIndexFundBefore = await getComponentBalancesOfIndexFund();
        let indexPrice = BN(0);
        for (i = 0; i < componentPricesBefore.length; i++) {
            indexPrice = indexPrice.add(componentBalancesOfIndexFundBefore[i].mul(BN(componentPricesBefore[i])));
        }
        indexPrice = indexPrice.div(indexTokenStateBefore.totalSupply);

        const ethAmount = BN(web3.utils.toWei(String(componentAddrs.length), "ether"));
        const expectedAmountToMint = BN(ethAmount.toString() + '0'.repeat(18)).div(indexPrice);

        /**
         * -----------------------------------------------------------------
         * calculated expected output amounts of component tokens
         */
        const expectedComponentAmountsOut = await expectAmountsOut();

        /**
         * -----------------------------------------------------------------
         * snapshots and calculate expected differences after the state transition
         */
        // const balanceOfInvestorBefore = await indexContract.methods.balanceOf(investor).call();
        const indexFundStateBefore = await snapshotIndexFund();
        const investorStateBefore = await snapshotInvestor();

        /**
         * -----------------------------------------------------------------
         * Execute the purchasing process on-chain
         */
        const tx = await fundContract.methods.buy(expectedComponentAmountsOut).send({
            from: investor,
            value: ethAmount,
            gas: '5000000'
        });

        const txFees = await getTxFees(tx);

        const expectedIndexFundDiffs = {
            ethBalance: BN(0),
            indexBalance: BN(0),
            componentBalances: expectedComponentAmountsOut
        };

        const expectedInvestorDiffs = {
            ethBalance: ethAmount.add(txFees).neg(),
            indexBalance: expectedAmountToMint,
        };

        const expectedIndexTokenDiffs = {
            totalSupply: expectedAmountToMint
        };

        await assertIndexFundState(indexFundStateBefore, expectedIndexFundDiffs);
        await assertInvestorState(investorStateBefore, expectedInvestorDiffs);
        await assertIndexTokenState(indexTokenStateBefore, expectedIndexTokenDiffs);

    });


    it('should sell back Index Tokens properly', async () => {
        // selling 9 index tokens
        const saleIndexAmount = BN('9' + '0'.repeat(18));
        console.log('SALE AMOUNT: ', saleIndexAmount.toString());

        const expectedEachComponentAmountIn = saleIndexAmount.div(BN(componentAddrs.length));
        const expectedEthAmountsOut = await expectAmountsOut(false, expectedEachComponentAmountIn.toString());
        console.log('EXPECTED ETH AMOUNTS OUT: ', expectedEthAmountsOut);

        await indexContract.methods.approve(allAddrs.indexFund, saleIndexAmount.toString()).send({
            from: investor,
            gas: '5000000'
        });

        const allowanceOfIndexFund = await indexContract.methods.allowance(investor, allAddrs.indexFund).call();
        assert(allowanceOfIndexFund, saleIndexAmount.toString(), 'saleAmount does not match allowance');

        /**
         * -----------------------------------------------------------------
         * Get values before execution for later comparison
         */

        const indexFundStateBefore = await snapshotIndexFund();
        const investorStateBefore = await snapshotInvestor();
        console.log("INVESTOR ETH BALANCE", investorStateBefore.ethBalance.toString());
        console.log('INVESTOR INDEX BALANCE: ', investorStateBefore.indexBalance.toString());
        const indexTokenStateBefore = await snapshotIndexToken();

        /**
         * -----------------------------------------------------------------
         * Execute the selling process on-chain
         */
        const tx = await fundContract.methods.sell(expectedEthAmountsOut).send({
            from: investor,
            gas: '5000000'
        });

        const txFees = await getTxFees(tx);
        console.log("txFees", txFees.toString());

        const expectedIndexFundDiffs = {
            ethBalance: BN(0),
            indexBalance: BN(0),
            componentBalances: Array(componentAddrs.length).fill(expectedEachComponentAmountIn.neg())
        };

        const expectedInvestorDiffs = {
            ethBalance: expectedEthAmountsOut.reduce((accum, ethAmount) => accum.add(BN(ethAmount)), BN(0)).sub(txFees),
            indexBalance: saleIndexAmount.neg(),
        };

        const expectedIndexTokenDiffs = {
            totalSupply: saleIndexAmount.neg()
        };

        await assertIndexFundState(indexFundStateBefore, expectedIndexFundDiffs);
        await assertInvestorState(investorStateBefore, expectedInvestorDiffs);
        await assertIndexTokenState(indexTokenStateBefore, expectedIndexTokenDiffs);

    });
});