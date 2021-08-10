const fs = require('fs');
const assert = require('assert');
const web3 = require('../src/getWeb3');

const log = require('../config/logger');

const {
    INDEX_TOKEN_JSON,
    INDEX_FUND_JSON,
    PATH_ADDRESS_FILE,
    UNISWAP_ROUTER_JSON,
    ORACLE_JSON,
    DAI_JSON
} = require('./fixtures/constants');

const {
    deployAuxContracts,
    deployCoreContracts,
    setDeployGlobalVars,
    mintTokens,
    provisionLiquidity,
    initialSupply
} = require('../src/deploy');

const {
    setIndexFundGlobalVars,
} = require('../src/indexFund');

const {
    setOracleGlobalVars,
    selectNewPortfolio,
    announce,
    commit
} = require('../src/oracle/oracle');

const {
    ITC_EIN_V100,
    EIN_FININS_DEFI__LENDINGSAVING
} = require('../src/oracle/itc');

const {
    queryReserves,
    float2TokenUnits,
    queryTokenBalance,
    queryUniswapEthOut,
    queryUniswapTokenOut,
    queryUniswapEthOutForTokensOut,
    queryPortfolioEthOutSum,
    queryAllComponentBalancesOfIndexFund,
    queryAllComponentEthsOutOfIndexFund,
    queryAllComponentAmountsOut,
    assembleUniswapTokenSet,
    filterTokenSet,
    loadITINsFromSymbolsAndITC,
    getContract,
    CONTRACTS,
    increaseGanacheBlockTime,
} = require('../src/utils');

const BN = web3.utils.toBN;
const Ether = web3.utils.toWei;
const ETHER = web3.utils.toWei(BN(1));

let accounts;
let allAddrs;
let tokenSet;
let uniswapTokenSet;
let tokenSymbolsNotOnUniswap;
let initialComponentSymbols;

let admin;
let investor;
let indexContract;
let fundContract;
let oracleContract;
let routerContract;
let initialComponentAddrs;
let initialComponentJsons;

/**
 * --------------------------------------------------------------------------------
 * Helper Functions
 */

const getDateAhead = (daysAhead = 2) => {
    return new Date((new Date()).setDate((new Date()).getDate() + daysAhead));
}

const expectTotalEthAmountsOutSum = async (with1EtherEach = false) => {
    return await queryPortfolioEthOutSum(with1EtherEach);
};

const expectComponentAmountsOut = async (ethTotal) => {
    return await queryAllComponentAmountsOut(ethTotal)
};

const expectEthAmountsOut = async (componentInForEach) => {
    const currentPortfolio = (await fundContract.methods.getComponentSymbols().call()).map(symbol => symbol.toLowerCase());
    const ethAmountsOut = [];
    for (const componentSymbol of currentPortfolio) {
        const amountOut = await queryUniswapEthOut(componentSymbol, componentInForEach);
        ethAmountsOut.push(amountOut);
    }
    return ethAmountsOut;
};


const getComponentBalancesOfIndexFund = async () => {
    const componentBalanceOfIndexFund = [];
    for (i = 0; i < initialComponentAddrs.length; i++) {
        const componentContract = new web3.eth.Contract(initialComponentJsons[i].abi, initialComponentAddrs[i]);
        componentBalanceOfIndexFund[i] = BN(await componentContract.methods.balanceOf(allAddrs.indexFund).call());
    }
    return componentBalanceOfIndexFund;
};

const assertCorrectDiffsTwoBNArrays = ({ arrBefore, arrCurrent, expectedDiffs }) => {
    if (expectedDiffs === undefined) return;
    assert.strictEqual(arrBefore.length, arrCurrent.length,
        `Two array do not have equal length, arrBefore.length=${arrBefore.length}, arrCurrent.length=${arrCurrent.length}`
    );
    for (i = 0; i < arrBefore.length; i++) {
        const actualDiff = arrCurrent[i].sub(arrBefore[i]);
        assert.deepStrictEqual(actualDiff.toString(), expectedDiffs[i].toString(),
            `Wrong resulted at component ${i}, expected ${expectedDiffs[i]}, but got ${actualDiff}`
        );
    }
};

const assertCorrectReplacementsTwoStringArrays = ({ arrBefore, arrCurrent, expectedDiffs }) => {
    if (expectedDiffs === undefined) return;
    assert.strictEqual(arrBefore.length, arrCurrent.length,
        `Two array do not have equal length, arrBefore.length=${arrBefore.length}, arrCurrent.length=${arrCurrent.length}`
    );
    const setBefore = new Set(arrBefore);
    const setCurrent = new Set(arrCurrent);
    const setDiffs = new Set(arrBefore.filter(e => !(new Set(setCurrent)).has(e)).concat(arrCurrent.filter(e => !(new Set(setBefore)).has(e))));
    assert.deepStrictEqual(setDiffs, new Set(expectedDiffs),
        `Expected ${expectedDiffs.sort()}, but got ${[...setDiffs].sort()}`
    );
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
    const componentBalances = Object.values(await queryAllComponentBalancesOfIndexFund()).map(bal => BN(bal));
    const componentSymbols = await fundContract.methods.getComponentSymbols().call();
    return {
        ethBalance,
        indexBalance,
        componentBalances,
        componentSymbols
    };
};

const snapshotIndexToken = async () => {
    const totalSupply = BN(await indexContract.methods.totalSupply().call());
    return { totalSupply };
};

const assertAmountDiff = (before, current, expectedDiff) => {
    if (expectedDiff === undefined) return;
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

    assertCorrectDiffsTwoBNArrays({
        arrBefore: stateBefore.componentBalances,
        arrCurrent: await getComponentBalancesOfIndexFund(),
        expectedDiffs: expectedDiffs.componentBalances
    });

    assertCorrectReplacementsTwoStringArrays({
        arrBefore: stateBefore.componentSymbols,
        arrCurrent: await fundContract.methods.getComponentSymbols().call(),
        expectedDiffs: expectedDiffs.componentSymbols
    });
};

const assertIndexTokenState = async (stateBefore, expectedDiffs) => {
    const stateCurrent = await snapshotIndexToken();
    assertAmountDiff(stateBefore.totalSupply, stateCurrent.totalSupply, expectedDiffs.totalSupply);
};


/**
 * --------------------------------------------------------------------------------
 * Helper Functions for catching errors
 * Adapted from https://ethereum.stackexchange.com/a/48629/68643
 */

const assertRevert = (error, expectedErrorMessage) => {
    assert(error, "Expected an error but did not get one");
    const actualErrorMessage = error.message;
    log.debug("actualErrorMessage ===> ", actualErrorMessage);
    log.debug("expectedErrorMessage ===> ", expectedErrorMessage);
    assert.strictEqual(actualErrorMessage.includes('revert ' + expectedErrorMessage), true, `Expected error message "${expectedErrorMessage}", but got "${actualErrorMessage}".`);
};


/**
 * --------------------------------------------------------------------------------
 * BEGIN
 */

before(async () => {
    log.debug('Index Fund Test Cases');

    if (fs.existsSync(PATH_ADDRESS_FILE))
        fs.unlinkSync(PATH_ADDRESS_FILE);

    initialComponentSymbols = ["aave", "comp", "bzrx", "cel", "yfii"];
    await deployAuxContracts();
    await deployCoreContracts(initialComponentSymbols);

    tokenSymbolsNotOnUniswap = ['dai', 'bnb', 'zrx', 'enzf'];
    [allAddrs, tokenSet, uniswapTokenSet] = setDeployGlobalVars(tokenSymbolsNotOnUniswap);
    await setOracleGlobalVars();

    fundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    oracleContract = new web3.eth.Contract(ORACLE_JSON.abi, allAddrs.oracle);
    indexContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddrs.indexToken);
    routerContract = new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, allAddrs.uniswapRouter);
    await setIndexFundGlobalVars();

    accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    investor = accounts[2];
    investor2 = accounts[3];

    const tokensNotInInitialPortfolio = Object.keys(tokenSet).filter(symbol => !initialComponentSymbols.includes(symbol));
    const initialPortfolioTokenSet = filterTokenSet(tokenSet, tokensNotInInitialPortfolio);
    initialComponentAddrs = Object.values(initialPortfolioTokenSet).map(token => token.address);
    initialComponentJsons = Object.values(initialPortfolioTokenSet).map(token => token.json);
});


describe('Deploy and setup smart contracts', () => {

    it('should deploy Index Token and Index Fund Contracts', () => {
        assert.ok(allAddrs.indexToken);
        assert.ok(allAddrs.indexFund);
    });

    it(`should have 0 totalSupply in IndexToken after deployment`, async () => {
        const totalSupply = await indexContract.methods.totalSupply().call();
        assert.strictEqual('0', totalSupply);

        const indexFundIdxBalance = await indexContract.methods.balanceOf(allAddrs.indexFund).call();
        assert.strictEqual('0', indexFundIdxBalance);
    });

    // it(`should mint ${initialSupply} DAI to admin`, async () => {
    //     await mintTokens({ tokenSymbol: 'dai', value: initialSupply, receiver: admin });
    //     const daiContract = new web3.eth.Contract(DAI_JSON.abi, allAddrs.dai);
    //     const adminDaiBalance = await daiContract.methods.balanceOf(admin).call();
    //     assert.strictEqual(float2TokenUnits(initialSupply), adminDaiBalance);
    // });

});

describe('Uniswap lidquidity provision', () => {
    it(' should provision all Uniswap ERC20/WETH pools with the expected liquidity', async () => {
        const ethAmount = 150;
        await provisionLiquidity(ethAmount);

        for (const [symbol, token] of Object.entries(uniswapTokenSet)) {
            const [actualWeth, actualToken] = await queryReserves(symbol);
            const expectedWeth = float2TokenUnits(ethAmount);
            assert.strictEqual(expectedWeth, actualWeth, `expected ${expectedWeth} wei but got ${actualWeth}`);
            const expectedTokenAmount = float2TokenUnits(ethAmount * token.price);
            assert.strictEqual(actualToken, expectedTokenAmount, `Token ${symbol}: expected ${expectedTokenAmount} token units but got ${actualToken}`);
        }
    });
});



describe('BUY and SELL index tokens', () => {
    it('should set the portfolio properly in the Index Fund smart contract', async () => {
        const expectedComponentSymbols = initialComponentSymbols;
        const actualComponentSymbols = (await fundContract.methods.getComponentSymbols().call()).map(symbol => symbol.toLowerCase());

        assert.deepStrictEqual(actualComponentSymbols, expectedComponentSymbols, 'Token symbols not match');

        const expectedComponentAddrs = initialComponentAddrs;
        const actualComponentAddrs = await fundContract.methods.getAddressesInPortfolio().call();
        assert.deepStrictEqual(actualComponentAddrs, expectedComponentAddrs, 'Token addresses not match');
    });


    it('should return correct *nominal* Index price when totalSupply = 0', async () => {
        const curIndexTokenState = await snapshotIndexToken();
        assert.strictEqual(curIndexTokenState.totalSupply.eq(BN(0)), true, 'Total supply > 0');

        const expectedIndexPrice = BN(await expectTotalEthAmountsOutSum(true)).div(BN(initialComponentSymbols.length));
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(), `Incorrect Index Price expected ${expectedIndexPrice}, but got ${actualIndexPrice}`);
    });

    it('should fail when buying Index Tokens with nominal price since msg.value > 0.01 ETH', async () => {

        const ethAmount = Ether('0.02');
        const expectedReason = "IndexFund: totalSupply must > 0 or msg.value must <= 0.01 ETH";
        try {
            await fundContract.methods.buy([]).send({
                from: investor,
                value: ethAmount,
                gas: '5000000'
            });
            throw null;
        }
        catch (error) {
            assertRevert(error, expectedReason);
        }
    });


    it('should properly buy Index Tokens with 0.01 ETH at nominal price without frontrunning prevention', async () => {
        const expectedIndexPrice = BN(await expectTotalEthAmountsOutSum(true)).div(BN(initialComponentSymbols.length));
        log.debug("NOMINAL INDEX PRICE:", expectedIndexPrice.toString());

        const ethAmount = BN(Ether('0.01'));
        const expectedIndexTokenAmount = BN(ethAmount).mul(ETHER).div(expectedIndexPrice);
        log.debug("AMOUNT OF NEW INDEX TOKENS:", expectedIndexTokenAmount.toString());

        const expectedComponentAmountsOut = await expectComponentAmountsOut(ethAmount.toString());
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
        const curIndexTokenState = await snapshotIndexToken();
        assert.strictEqual(curIndexTokenState.totalSupply.gt(BN(0)), true, 'Total supply is 0');


        const expectedIndexPrice = BN(await expectTotalEthAmountsOutSum()).mul(ETHER).div(curIndexTokenState.totalSupply);
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        log.debug("REGULAR INDEX PRICE:", expectedIndexPrice.toString());

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(),
            `Incorrect Index Price: expected ${expectedIndexPrice}, but got ${actualIndexPrice}`
        );
    });


    it('should purchase Index Tokens properly at regular price calcualtion with frontrunning prevention)', async () => {
        const indexTokenStateBefore = await snapshotIndexToken();
        assert.strictEqual(indexTokenStateBefore.totalSupply.gt(BN(0)), true, 'Total supply is 0');
        /**
         * -----------------------------------------------------------------
         * compute the expected tokens to mint
         */
        const expectedIndexPrice = BN(await expectTotalEthAmountsOutSum()).mul(ETHER).div(indexTokenStateBefore.totalSupply);

        const ethAmount = BN(Ether(String(initialComponentSymbols.length * 10)));
        const expectedAmountToMint = ethAmount.mul(ETHER).div(expectedIndexPrice);

        /**
         * -----------------------------------------------------------------
         * calculated expected output amounts of component tokens
         */
        const expectedComponentAmountsOut = await expectComponentAmountsOut(ethAmount.toString());

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
        // selling 5 index tokens
        const saleIndexAmount = BN(5).mul(ETHER);

        const expectedEachComponentAmountIn = saleIndexAmount.div(BN(initialComponentAddrs.length));
        const expectedEthAmountsOut = await expectEthAmountsOut(expectedEachComponentAmountIn.toString());

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
        const indexTokenStateBefore = await snapshotIndexToken();

        /**
         * -----------------------------------------------------------------
         * Execute the selling process on-chain
         */
        const tx = await fundContract.methods.sell(saleIndexAmount, expectedEthAmountsOut).send({
            from: investor,
            gas: '5000000'
        });

        const txFees = await getTxFees(tx);

        const expectedIndexFundDiffs = {
            ethBalance: BN(0),
            indexBalance: BN(0),
            componentBalances: Array(initialComponentAddrs.length).fill(expectedEachComponentAmountIn.neg())
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

    it('should fail when selling Index Tokens due to not approving enough allowance', async () => {
        // selling 9 index tokens
        const saleIndexAmount = BN(5).mul(ETHER);

        const allowance = saleIndexAmount.sub(BN(1));
        await indexContract.methods.approve(allAddrs.indexFund, allowance).send({
            from: investor,
            gas: '5000000'
        });

        const expectedReason = 'IndexFund: allowance not enough';
        try {
            await fundContract.methods.sell(saleIndexAmount, []).send({
                from: investor,
                gas: '5000000'
            });
            throw null;
        }
        catch (error) {
            assertRevert(error, expectedReason);
        }
    });
});
















describe('REBALANCE PORTFOLIO from admin and from update', () => {
    const ENUM_REBLANCE_FUNC = 1;
    before(async () => {
        await fundContract.methods.buy([]).send({
            from: investor,
            value: Ether('0.01'),
            gas: '5000000'
        });

        await fundContract.methods.buy([]).send({
            from: investor,
            value: Ether('250'),
            gas: '5000000'
        });

        const saleAmount = Ether('20');

        await indexContract.methods.approve(allAddrs.indexFund, saleAmount).send({
            from: investor,
            gas: '5000000'
        });

        await fundContract.methods.sell(saleAmount, []).send({
            from: investor,
            gas: '5000000'
        });

    });

    it('should activate and validate the lock time of function `IndexFund.rebalance()`', async () => {
        let currentLockTime = await fundContract.methods.timelock(ENUM_REBLANCE_FUNC).call();
        assert.deepStrictEqual(currentLockTime, '0', `Epected 0 (unlimited) locktime, but got ${currentLockTime}`);

        const announcementMessage = "Rebalancing will happen after 2 days"
        await fundContract.methods.announcePortfolioRebalancing(announcementMessage).send({
            from: admin,
            gas: '5000000'
        });

        // check update date
        const tolerance = 1000 * 60 * 15; // 15 mins in miliseconds
        const after2Days = getDateAhead(2);
        const expectedRebalancingInterval = [after2Days.getTime() - tolerance, after2Days.getTime() + tolerance];
        const actualRebalancingTime = parseInt(await fundContract.methods.timelock(ENUM_REBLANCE_FUNC).call()) * 1000;

        assert.ok(expectedRebalancingInterval[0] <= actualRebalancingTime && actualRebalancingTime <= expectedRebalancingInterval[1],
            `Expected time in interval [${new Date(expectedRebalancingInterval[0]).toUTCString()}, ${new Date(expectedRebalancingInterval[1]).toUTCString()}],
            but got ${new Date(actualRebalancingTime).toUTCString()}`);
    });

    it('should fail when the 2-day lock time for function `IndexFund.rebalance()` not yet due', async () => {
        // try to commit and get reverted since update time is not due yet
        const expectedReason = "TimeLock: function is timelocked";
        try {
            await fundContract.methods.rebalance().send({
                from: admin,
                gas: '5000000'
            });
            throw null;
        }
        catch (error) {
            assertRevert(error, expectedReason);
        }
    });

    it('should rebalance the portfolio correctly ', async () => {
        // snapshot the state of IndexFund before rebalancing
        const indexFundStateBefore = await snapshotIndexFund();

        // derive the expected changes in each component balance
        const portfolioSize = BN(initialComponentAddrs.length);
        const ethOutSum = BN(await queryPortfolioEthOutSum());
        const ethAverage = (ethOutSum.add(indexFundStateBefore.ethBalance)).div(portfolioSize);

        const expectedComponentBalanceDiffs = [];
        for (let i = 0; i < indexFundStateBefore.componentBalances.length; i++) {
            const symbol = indexFundStateBefore.componentSymbols[i].toLowerCase();
            const balance = indexFundStateBefore.componentBalances[i];
            const ethOut = BN(await queryUniswapEthOut(symbol ,balance));

            if (ethAverage.lt(ethOut)) {
                const path = [allAddrs[symbol], allAddrs.weth];
                const amountToSell = (await routerContract.methods.getAmountsIn(ethOut.sub(ethAverage), path).call())[0];
                expectedComponentBalanceDiffs.push(BN(amountToSell).neg())
            } else if(ethAverage.gt(ethOut)) {
                const path = [allAddrs.weth, allAddrs[symbol]];
                const amountToBuy = (await routerContract.methods.getAmountsOut(ethAverage.sub(ethOut), path).call())[1];
                expectedComponentBalanceDiffs.push(BN(amountToBuy))
            } else {
                expectedComponentBalanceDiffs.push(BN(0))
            }
        }

        // advance the block time in ganache by 2 days
        await increaseGanacheBlockTime();

        // execute the rebalancing
        await fundContract.methods.rebalance().send({
            from: admin,
            gas: '5000000'
        });

        // assert the changes of component balances
        expectedIndexFundDiffs = {
            indexBalance: BN(0),
            componentBalances: expectedComponentBalanceDiffs
        }
        await assertIndexFundState(indexFundStateBefore, expectedIndexFundDiffs);

        // assert the remaining eth in IndexFund < the portfolio size due to even division among components
        const fundEthBalanceAfter = BN(await web3.eth.getBalance(allAddrs.indexFund));
        assert.ok(fundEthBalanceAfter.lt(portfolioSize),
            `Expected IndexFund's ETH balance after rebalancing < portfolio size (${portfolioSize}), but got ${fundEthBalanceAfter}`);

        // assert that the absolute diff between component's value in eth and eth average is below a threshold epsilon
        const componentsEthOutAfter = Object.values(await queryAllComponentEthsOutOfIndexFund());
        const ethOutSumAfter = componentsEthOutAfter.reduce((accum, ethAmount) => accum.add(BN(ethAmount)), BN(0));
        const ethAverageAfter = ethOutSumAfter.div(portfolioSize);

        const EPSILON = BN(Ether('0.05'))
        log.debug("EPSILON:", EPSILON.toString());
        log.debug("DIFFERENCE TO AVERAGE:");
        for(const eth of componentsEthOutAfter) {
            const diffFromAvg = BN(eth).sub(ethAverageAfter).abs();
            log.debug(diffFromAvg.toString());
            assert.ok(diffFromAvg.lte(EPSILON), `Expected the diff is <= 10000000000000000, but got ${diffFromAvg}`)
        }
    });
});





describe('UPDATE PORTFOLIO through the oracle infrastructure', () => {
    let componentSymbolsOut = [];
    let componentSymbolsIn = [];

    before(async () => {
        await fundContract.methods.buy([]).send({
            from: investor,
            value: Ether('60'),
            gas: '5000000'
        });
    });


    it('should set all state variables of Oracle contract correctly ', async () => {
        // use eth to swap for candidate tokens on Uniswap to increase the their prices so that they get selected for update
        const initialComponentSymbolSet = new Set(initialComponentSymbols);
        const candidatesSubbedIn = Object.keys(uniswapTokenSet).filter(symbol => !initialComponentSymbolSet.has(symbol));
        log.debug("candidatesSubbedIn ==> ", candidatesSubbedIn);
        for (const symbol of candidatesSubbedIn) {
            await getContract(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
                '0',
                [allAddrs.weth, allAddrs[symbol]],
                investor,
                ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp + 10000).toString()
            ).send({
                from: investor2,
                value: Ether('400'),
                gas: '5000000'
            });
        }

        // call oracle function to select the new portfolio
        const newPortfolio = await selectNewPortfolio();

        // call oracle function to announce the update
        [componentSymbolsOut, componentSymbolsIn] = await announce(newPortfolio);
        assert.deepStrictEqual(new Set(componentSymbolsIn), new Set(candidatesSubbedIn), `Expected ${candidatesSubbedIn}, but got ${componentSymbolsIn}`);

        // check the time to be next 2 days and all the data on oracle are correctly set
        const expectedCSOs = componentSymbolsOut.map(symbol => symbol.toUpperCase());
        const actualCSOs = await oracleContract.methods.getComponentSymbolsOut().call();
        assert.deepStrictEqual(new Set(actualCSOs), new Set(expectedCSOs), `ComponentSymbolsOut: Expected ${expectedCSOs}, but got ${actualCSOs}`);
        log.debug("componentSymbolsOut ===> ", actualCSOs);

        const expectedCAIs = componentSymbolsIn.map(symbol => allAddrs[symbol]);
        const actualCAIs = await oracleContract.methods.getComponentAddrsIn().call();
        assert.deepStrictEqual(new Set(actualCAIs), new Set(expectedCAIs), `ComponentAddrsIn: Expected ${expectedCAIs}, but got ${actualCAIs}`);
        log.debug("ComponentAddrsIn ===> ", actualCAIs);

        const expectedANCSs = newPortfolio.map(symbol => symbol.toUpperCase());
        const actualANCSs = await oracleContract.methods.getAllNextComponentSymbols().call();
        assert.deepStrictEqual(new Set(actualANCSs), new Set(expectedANCSs), `AllNextComponentSymbols: Expected ${expectedANCSs}, but got ${actualANCSs}`);
        log.debug("AllNextComponentSymbols ===> ", actualANCSs);

        const expectedITINs = loadITINsFromSymbolsAndITC(newPortfolio, ITC_EIN_V100, EIN_FININS_DEFI__LENDINGSAVING);
        const actualITINs = await oracleContract.methods.getComponentITINs().call();
        assert.deepStrictEqual(new Set(actualITINs), new Set(expectedITINs), `ComponentITINs: Expected ${expectedITINs}, but got ${actualITINs}`);
        log.debug("ComponentITINs ===> ", actualITINs);

    });

    it('should validate the lock time of function `IndexFund.updatePortfolio()`', async () => {
        // check update date
        const tolerance = 1000 * 60 * 15; // 15 mins in miliseconds
        const after4days = getDateAhead(4);
        const expectedUpdateInterval = [after4days.getTime() - tolerance, after4days.getTime() + tolerance];
        const actualUpdateTime = parseInt(await oracleContract.methods.getNextUpdateTime().call()) * 1000;

        assert.ok(expectedUpdateInterval[0] <= actualUpdateTime && actualUpdateTime <= expectedUpdateInterval[1],
            `Expected time in interval [${new Date(expectedUpdateInterval[0]).toUTCString()}, ${new Date(expectedUpdateInterval[1]).toUTCString()}], 
            but got ${new Date(actualUpdateTime).toUTCString()}`);
    });

    it('should fail when the 2-day lock time for function `IndexFund.updatePortfolio()` is not yet due', async () => {
        // try to commit and get reverted since update time is not due yet
        const expectedReason = "TimeLock: function is timelocked";
        try {
            await commit(componentSymbolsOut, componentSymbolsIn);
            throw null;
        }
        catch (error) {
            assertRevert(error, expectedReason);
        }
    });

    it('should update the portfolio in IndexFund contract after 2 days', async () => {
        // take snapshot of the current onchain portfolio
        const indexFundStateBefore = await snapshotIndexFund();

        const [_, expectedAmountsOutNewComponents] = await queryUniswapEthOutForTokensOut(componentSymbolsOut, componentSymbolsIn);
        const componentBalanceSetBefore = await queryAllComponentBalancesOfIndexFund();
        log.debug("componentBalanceSetBefore ===> ", componentBalanceSetBefore);

        const componentSymbolsOutSet = new Set(componentSymbolsOut);
        const balancesRetainedComponents = Object.entries(componentBalanceSetBefore)
            .filter(([symbol, _]) => !componentSymbolsOutSet.has(symbol))
            .map(([_, balance]) => balance);

        log.debug("balancesRetainedComponents ===> ", balancesRetainedComponents);

        const expectedComponentBalances = (balancesRetainedComponents.concat(expectedAmountsOutNewComponents)).sort();


        // increase ganache block time by 2 days (+2 days increased in the test of rebalancing -> 4 days ahead now)
        await increaseGanacheBlockTime()

        // execute the portfolio update process using the commit() function
        await commit(componentSymbolsOut, componentSymbolsIn);

        // validate the portfolio onchain in IndexFund contract

        const expectedIndexFundDiffs = {
            componentSymbols: componentSymbolsOut.concat(componentSymbolsIn).map(symbol => symbol.toUpperCase())
        };

        await assertIndexFundState(indexFundStateBefore, expectedIndexFundDiffs);

        const componentBalanceSetAfter = await queryAllComponentBalancesOfIndexFund();
        const actualComponentBalances = Object.values(componentBalanceSetAfter).sort();
        assert.deepStrictEqual(actualComponentBalances, expectedComponentBalances,
            `Expected: ${expectedComponentBalances},but got ${actualComponentBalances}`);
    });
});
