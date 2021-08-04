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
    deployAuxContracts,
    deployIndexContract,
    setDeployGlobalVars,
    mintTokens,
    provisionLiquidity,
    initialSupply
} = require('../src/deploy');

const {
    setIndexFundGlobalVars,
} = require('../src/indexFund');


const {
    queryReserves,
    float2TokenUnits,
    queryTokenBalance,
    queryUniswapEthOut,
    queryUniswapTokenOut,
    getContract,
    CONTRACTS,
    filterTokenSet
} = require('../src/utils');

let accounts;
let allAddrs;
let tokenSet;
let uniswapTokenSet;
let tokensNotOnUniswap;
let initialPortfolio;

let admin;
let investor;
let indexContract;
let fundContract;
let routerContract;
let initialComponentAddrs;
let initialComponentJsons;

const Ether = web3.utils.toWei;
const ETHER = web3.utils.toWei(BN(1));

/**
 * --------------------------------------------------------------------------------
 * Helper Functions
 */

const expectTotalEthAmountsOut = async (withFixed1Token = false) => {
    const currentPortfolio = (await fundContract.methods.getNamesInPortfolio().call()).map(symbol => symbol.toLowerCase());
    let sum = BN(0);
    let ethOut;
    for (const componentSymbol of currentPortfolio) {
        if (withFixed1Token) {
            ethOut = await queryUniswapEthOut(componentSymbol, Ether('1'));
        } else {
            const componentBalanceOfFund = await getContract(componentSymbol).methods.balanceOf(allAddrs.indexFund).call();
            ethOut = await queryUniswapEthOut(componentSymbol, componentBalanceOfFund);
        }
        sum = sum.add(BN(ethOut));
    }
    return sum.toString();
};

const expectComponentAmountsOut = async (ethInForEach) => {
    const currentPortfolio = (await fundContract.methods.getNamesInPortfolio().call()).map(symbol => symbol.toLowerCase());
    const componentAmountsOut = [];
    for (const componentSymbol of currentPortfolio) {
        const amountOut = await queryUniswapTokenOut(componentSymbol, ethInForEach);
        componentAmountsOut.push(amountOut);
    }
    return componentAmountsOut;
};

const expectEthAmountsOut = async (componentInForEach) => {
    const currentPortfolio = (await fundContract.methods.getNamesInPortfolio().call()).map(symbol => symbol.toLowerCase());
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
 * Helper Functions for catching errors
 * Adapted from https://ethereum.stackexchange.com/a/48629/68643
 */

const assertRevert = async (actualErrorMessage, expectedErrorMessage) => {
    assert.strictEqual(actualErrorMessage.includes('revert ' + expectedErrorMessage), `Expected error message "${expectedErrorMessage}", but got "${actualErrorMessage}".`);
};


/**
 * --------------------------------------------------------------------------------
 * BEGIN
 */

before(async () => {
    console.log('Index Fund Test Cases');

    if (fs.existsSync(PATH_ADDRESS_FILE))
        fs.unlinkSync(PATH_ADDRESS_FILE);

    initialPortfolio = ["aave", "comp", "bzrx", "cel", "yfii"];
    await deployAuxContracts();
    await deployIndexContract(initialPortfolio);

    tokensNotOnUniswap = ['dai', 'bnb', 'zrx', 'enzf'];
    [allAddrs, tokenSet, uniswapTokenSet] = setDeployGlobalVars(tokensNotOnUniswap);

    indexContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddrs.indexToken);
    fundContract = new web3.eth.Contract(INDEX_FUND_JSON.abi, allAddrs.indexFund);
    routerContract = new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, allAddrs.uniswapRouter);
    await setIndexFundGlobalVars();

    accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    investor = accounts[2];

    const tokensNotInInitialPortfolio = Object.keys(tokenSet).filter(symbol => !initialPortfolio.includes(symbol));
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


describe('IndexFund functionalities', () => {
    it('checks if portfolio is properly set in Index Fund smart contract', async () => {
        const expectedComponentNames = initialPortfolio;
        const actualComponentNames = (await fundContract.methods.getNamesInPortfolio().call()).map(name => name.toLowerCase());

        assert.deepStrictEqual(actualComponentNames, expectedComponentNames, 'Token names not match');

        const expectedComponentAddrs = initialComponentAddrs;
        const actualComponentAddrs = await fundContract.methods.getAddressesInPortfolio().call();
        assert.deepStrictEqual(actualComponentAddrs, expectedComponentAddrs, 'Token addresses not match');
    });






    it('should return correct *nominal* Index price when totalSupply = 0', async () => {
        const curIndexTokenState = await snapshotIndexToken();
        assert.strictEqual(curIndexTokenState.totalSupply.eq(BN(0)), true, 'Total supply > 0');

        const expectedIndexPrice = BN(await expectTotalEthAmountsOut(true)).div(BN(initialPortfolio.length));
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(), `Incorrect Index Price expected ${expectedIndexPrice}, but got ${actualIndexPrice}`);
    });


    it('should properly buy Index Tokens (nominal price calculation + no frontrunning prevention)', async () => {
        const expectedIndexPrice = BN(await expectTotalEthAmountsOut(true)).div(BN(initialPortfolio.length));
        console.log("NOMINAL INDEX PRICE:", expectedIndexPrice.toString());

        const ethAmount = BN(Ether(String(initialPortfolio.length * 10)));
        const expectedIndexTokenAmount = BN(ethAmount).mul(ETHER).div(expectedIndexPrice);
        console.log("AMOUNT OF NEW INDEX TOKENS:", expectedIndexTokenAmount.toString());

        const ethInForEach = ethAmount.div(BN(initialPortfolio.length)).toString();
        const expectedComponentAmountsOut = await expectComponentAmountsOut(ethInForEach);
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


        const expectedIndexPrice = BN(await expectTotalEthAmountsOut()).mul(ETHER).div(curIndexTokenState.totalSupply);
        const actualIndexPrice = await fundContract.methods.getIndexPrice().call();

        console.log("REGULAR INDEX PRICE:", expectedIndexPrice.toString());

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
        const expectedIndexPrice = BN(await expectTotalEthAmountsOut()).mul(ETHER).div(indexTokenStateBefore.totalSupply);

        const ethAmount = BN(Ether(String(initialPortfolio.length * 10)));
        const expectedAmountToMint = ethAmount.mul(ETHER).div(expectedIndexPrice);

        /**
         * -----------------------------------------------------------------
         * calculated expected output amounts of component tokens
         */
        const ethInForEach = ethAmount.div(BN(initialPortfolio.length)).toString();
        const expectedComponentAmountsOut = await expectComponentAmountsOut(ethInForEach);

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

    it('should be rejected by the on-chain sell function due to not enough allowance', async () => {
        // selling 9 index tokens
        const saleIndexAmount = BN(5).mul(ETHER);

        const allowance = saleIndexAmount.sub(BN(1));
        await indexContract.methods.approve(allAddrs.indexFund, allowance).send({
            from: investor,
            gas: '5000000'
        });

        const expectedErrorReason = 'IndexFund: allowance not enough';
        try {
            await fundContract.methods.sell(saleIndexAmount, []).send({
                from: investor,
                gas: '5000000'
            });
            throw null;
        }
        catch (error) {
            assert(error, "Expected an error but did not get one");
            assertRevert(error.message, expectedErrorReason);
        }
    });
});