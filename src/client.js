const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
const INVESTMENT_CONTRACT_JSON = require('../build/contracts/PassiveInvestment.json');

const investmentContractInstance = new web3.eth.Contract(INVESTMENT_CONTRACT_JSON.abi, "0x6eD79Aa1c71FD7BdBC515EfdA3Bd4e26394435cC");

let investor;

const orderTokens = async () => {
    console.log("Ordering 19 tokens...")
    await investmentContractInstance.methods.orderTokens(19).send({
        from: investor,
        gas: '3000000'
    });
};


(async () => {
    const accounts = await web3.eth.getAccounts();
    investor = accounts[2];

    await orderTokens();

    console.log("\nListening for PurchaseReady events from InvestMent Contract...")
    // investmentContractInstance.events.PurchaseReady({
    //     // filter: {_buyer: investor}
    // })
    //     .on('data', function (event) {
    //         console.log("GOT ", event);
    //     })
    //     .on('changed', function (event) {
    //         console.log(event, " removed");
    //     })
    //     .on('error', console.error);

})();