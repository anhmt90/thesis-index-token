const fs = require('fs');
const assert = require('assert');
const web3 = require('../src/getWeb3');

const {
    DAI_JSON,
    INDEX_TOKEN_JSON,
    ETF_JSON,
    PATH_ADDRESS_FILE,
} = require('./fixtures/constants');

const {
    deploy,
    setUpETF,
    setDeployGlobalVars,
    mintTokens,
    provisionLiquidity,
    initialSupply,
} = require('../src/deploy');

const {
    setEtfDemoGlobalVars,
    setPortfolio,
    queryIndexPrice,
    swap
} = require('../src/test');


const {
    queryReserves,
    float2TokenUnits,
} = require('../src/utils');

let accounts;
let allAddrs;
let tokenSet;
let admin;
let indexContract;
let etfContract;


before(async () => {
    console.log('LOG_LEVEL:', process.env.LOG_LEVEL);

    if (fs.existsSync(PATH_ADDRESS_FILE))
        fs.unlinkSync(PATH_ADDRESS_FILE);

    await deploy();
    [allAddrs, tokenSet] = setDeployGlobalVars();
    indexContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddrs.indexToken);
    etfContract = new web3.eth.Contract(ETF_JSON.abi, allAddrs.etf);
    setEtfDemoGlobalVars();

    accounts = await web3.eth.getAccounts();
    admin = accounts[0];
});


describe('Deploy and setup smart contracts', () => {

    it('checks Index Token and ETF has been deployed', () => {
        assert.ok(allAddrs.indexToken);
        assert.ok(allAddrs.etf);
    });

    it(`checks ETF receives ${initialSupply} Index Tokens`, async () => {
        await setUpETF();
        const etfIndexBalance = await indexContract.methods.balanceOf(allAddrs.etf).call();
        assert.strictEqual(float2TokenUnits(initialSupply), etfIndexBalance);
    });

    it(`checks if ${initialSupply} DAI are minted correctly to admin`, async () => {
        await mintTokens({ tokenSymbol: 'dai', value: initialSupply, receiver: admin });
        const daiContract = new web3.eth.Contract(DAI_JSON.abi, allAddrs.dai);
        const adminDaiBalance = await daiContract.methods.balanceOf(admin).call();
        assert.strictEqual(float2TokenUnits(initialSupply), adminDaiBalance);
    });

});

describe('Uniswap lidquidity provision', () => {
    it('checks if all Uniswap ERC20/WETH pools are provisioned with the expected liquidity', async () => {
        const ethAmount = 5;
        await provisionLiquidity(ethAmount);

        for (const [symbol, token] of Object.entries(tokenSet)) {
            const [actualWeth, actualToken] = await queryReserves(symbol);
            const expectedWethAmount = float2TokenUnits(ethAmount);
            assert.strictEqual(expectedWethAmount, actualWeth, `expected ${ethAmount}ETH but got ${actualWeth}`);
            const expectedTokenAmount = float2TokenUnits(ethAmount * token.price);
            assert.strictEqual(actualToken, expectedTokenAmount, `expected ${expectedTokenAmount} token units but got ${actualToken}`);
        }

    });
});

describe('ETF functionalities', () => {
    it('checks if portfolio is properly set in ETF smart contract', async () => {
        await setPortfolio();
        const expectedTokenNames = Object.keys(tokenSet).map(name => name.toLowerCase());
        const actualTokenNames = (await etfContract.methods.getNamesInPortfolio().call()).map(name => name.toLowerCase());

        assert.deepStrictEqual(actualTokenNames, expectedTokenNames, 'Token names not match');

        const expectedTokenAddrs = Object.values(tokenSet).map(token => token.address);
        const actualTokenAddrs = await etfContract.methods.getAddressesInPortfolio().call();
        assert.deepStrictEqual(actualTokenAddrs, expectedTokenAddrs, 'Token addresses not match');
    });


});
