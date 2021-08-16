const fs = require('fs');
const assert = require('assert');
const web3 = require('../../src/getWeb3');

const {
    DAI_JSON,
    INDEX_TOKEN_JSON,
    PATH_ADDRESS_FILE,
} = require('../fixtures/constants');

const {
    deploy,
    setUpIndexFund,
    setDeployGlobalVars,
    mintTokens,
    provisionLiquidity,
    initialSupply,
} = require('../../src/deploy');


const {
    queryReserves,
    float2TokenUnits,
} = require('../../src/utils');

let accounts;
let allAddrs;
let tokenSet;
let admin;
let indexContract;


// beforeEach(async () => {
//     console.log('Contract Deployment test cases');

//     if (fs.existsSync(PATH_ADDRESS_FILE))
//         fs.unlinkSync(PATH_ADDRESS_FILE);

//     await deploy();
//     [allAddrs, tokenSet] = setDeployGlobalVars();
//     indexContract = new web3.eth.Contract(INDEX_TOKEN_JSON.abi, allAddrs.indexToken);

//     accounts = await web3.eth.getAccounts();
//     admin = accounts[0];

// });


// describe('Deploy and setup smart contracts', () => {

//     it('checks Index Token and Index Fund has been deployed', () => {
//         assert.ok(allAddrs.indexToken);
//         assert.ok(allAddrs.indexFund);
//     });

//     it(`checks Index Fund receives ${initialSupply} Index Tokens`, async () => {
//         await setUpIndexFund();
//         const indexFundIndexBalance = await indexContract.methods.balanceOf(allAddrs.indexFund).call();
//         assert.strictEqual(float2TokenUnits(initialSupply), indexFundIndexBalance);
//     });

//     it(`checks if ${initialSupply} DAI are minted correctly to admin`, async () => {
//         await mintTokens({ tokenSymbol: 'dai', value: initialSupply, receiver: admin });
//         const daiContract = new web3.eth.Contract(DAI_JSON.abi, allAddrs.dai);
//         const adminDaiBalance = await daiContract.methods.balanceOf(admin).call();
//         assert.strictEqual(float2TokenUnits(initialSupply), adminDaiBalance);
//     });

// });

// describe('Uniswap lidquidity provision', () => {
//     it('checks if all Uniswap ERC20/WETH pools are provisioned with the expected liquidity', async () => {
//         const ethAmount = 5;
//         await provisionLiquidity(ethAmount);

//         for (const [symbol, token] of Object.entries(tokenSet)) {
//             const [actualWeth, actualToken] = await queryReserves(symbol);
//             const expectedWethAmount = float2TokenUnits(ethAmount);
//             assert.strictEqual(expectedWethAmount, actualWeth, `expected ${ethAmount}ETH but got ${actualWeth}`);
//             const expectedTokenAmount = float2TokenUnits(ethAmount * token.price);
//             assert.strictEqual(actualToken, expectedTokenAmount, `expected ${expectedTokenAmount} token units but got ${actualToken}`);
//         }

//     });
// });
