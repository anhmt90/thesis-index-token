const fs = require('fs');
const assert = require('assert');
const web3 = require('../src/getWeb3');
const BN = web3.utils.toBN;

const {
    INDEX_TOKEN_JSON,
    ETF_JSON,
    PATH_ADDRESS_FILE,
    UNISWAP_ROUTER_JSON,
    DAI_JSON
} = require('./fixtures/constants');

const {
    deploy,
    setUpETF,
    setDeployGlobalVars,
    mintTokens,
    provisionLiquidity,
    initialSupply
} = require('../src/deploy');

const {
    setEtfClientGlobalVars,
    setPortfolio,
} = require('../src/test');


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
let etfContract;
let routerContract;
let path;
let tokenAddrs;
let tokenJsons;

const calcAmountsOutForOneETH = async () => {
    const expectedAmountsOut = [];
    for (i = 0; i < tokenAddrs.length; i++) {
        const tokenContract = new web3.eth.Contract(tokenJsons[i].abi, tokenAddrs[i]);
        const decimals = await tokenContract.methods.decimals().call();
        const balance = await tokenContract.methods.balanceOf(allAddrs.etf).call();

        path[1] = tokenAddrs[i];
        const amounts = await routerContract.methods.getAmountsOut(float2TokenUnits(1, decimals), path).call();
        expectedAmountsOut.push(amounts[1]);
    }
    return expectedAmountsOut;
};

before(async () => {
    console.log('ETF Test Cases');

    if (fs.existsSync(PATH_ADDRESS_FILE))
        fs.unlinkSync(PATH_ADDRESS_FILE);

    await deploy();
    [allAddrs, tokenSet] = setDeployGlobalVars();
    indexContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddrs.indexToken);
    etfContract = new web3.eth.Contract(ETF_JSON.abi, allAddrs.etf);
    routerContract = new web3.eth.Contract(UNISWAP_ROUTER_JSON.abi, allAddrs.uniswapRouter);
    setEtfClientGlobalVars();

    accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    investor = accounts[2];

    await setPortfolio();
    // await setUpETF();
    // await mintTokens({ tokenSymbol: 'dai', value: 1000000, receiver: admin });
    // await provisionLiquidity(ethProvisioned);

    path = [allAddrs.weth, ''];
    tokenAddrs = Object.values(tokenSet).map(token => token.address);
    tokenJsons = Object.values(tokenSet).map(token => token.json);
});


describe('Deploy and setup smart contracts', () => {

    it('should deploy Index Token and ETF Contracts', () => {
        assert.ok(allAddrs.indexToken);
        assert.ok(allAddrs.etf);
    });

    it(`should mint 1 Index Token unit (10^-18) for ETF Contract`, async () => {
        // await setUpETF();
        const etfIndexBalance = await indexContract.methods.balanceOf(allAddrs.etf).call();
        assert.strictEqual('1', etfIndexBalance);
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
        const ethAmount = 5;
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



describe('ETF functionalities', () => {
    it('checks if portfolio is properly set in ETF smart contract', async () => {
        const expectedTokenNames = Object.keys(tokenSet).map(name => name.toLowerCase());
        const actualTokenNames = (await etfContract.methods.getNamesInPortfolio().call()).map(name => name.toLowerCase());

        assert.deepStrictEqual(actualTokenNames, expectedTokenNames, 'Token names not match');

        const expectedTokenAddrs = Object.values(tokenSet).map(token => token.address);
        const actualTokenAddrs = await etfContract.methods.getAddressesInPortfolio().call();
        assert.deepStrictEqual(actualTokenAddrs, expectedTokenAddrs, 'Token addresses not match');
    });

    it('should purchase Index Tokens properly', async () => {
        const expectedAmountsOut = await calcAmountsOutForOneETH();

        const ethAmount = web3.utils.toWei(String(tokenAddrs.length), "ether");
        await etfContract.methods.orderWithExactETH().send({
            from: investor,
            value: ethAmount,
            gas: '5000000'
        });

        const etfEthBalance = await web3.eth.getBalance(allAddrs.etf);
        assert.strictEqual(etfEthBalance, '0');

        for (i = 0; i < tokenAddrs.length; i++) {
            const tokenContract = new web3.eth.Contract(tokenJsons[i].abi, tokenAddrs[i]);
            const actualAmountOut = await tokenContract.methods.balanceOf(allAddrs.etf).call();
            assert.strictEqual(actualAmountOut, expectedAmountsOut[i]);
        }

        const investorIndexBalance = await indexContract.methods.balanceOf(investor).call();
        assert.strictEqual(investorIndexBalance,ethAmount, `Expected ${ethAmount} itokens but got ${investorIndexBalance}`)
    });

    it('should check Index price', async () => {
        const expectedAmountsOut = await calcAmountsOutForOneETH();

        let expectedIndexPrice = BN(0);
        for (let i = 0; i < expectedAmountsOut.length; i++) {
            const tokenContract = new web3.eth.Contract(tokenJsons[i].abi, tokenAddrs[i]);
            const tokenPrice = BN(expectedAmountsOut[i]);
            // console.log('tokenPrice', tokenPrice);
            const tokenBalanceOfETF = BN(await tokenContract.methods.balanceOf(allAddrs.etf).call());
            expectedIndexPrice = expectedIndexPrice.add(tokenPrice.mul(tokenBalanceOfETF));
        }

        const circulation = BN(await etfContract.methods.circulation().call());
        expectedIndexPrice = expectedIndexPrice.div(circulation);

        const actualIndexPrice = await etfContract.methods.getIndexPrice().call();

        assert.deepStrictEqual(actualIndexPrice, expectedIndexPrice.toString(), `Incorrect Index Price expected ${expectedIndexPrice}, but got ${actualIndexPrice}`);
    });

});