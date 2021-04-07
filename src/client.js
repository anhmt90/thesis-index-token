const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));

const TOKEN_CONTRACT_JSON = require('../build/contracts/IndexToken.json');
const INVESTMENT_CONTRACT_JSON = require('../build/contracts/PassiveInvestment.json');

const tokenContractAddress = "0x9b1f7F645351AF3631a656421eD2e40f2802E6c0";
const tokenContractInstance = new web3.eth.Contract(TOKEN_CONTRACT_JSON.abi, tokenContractAddress);

const investmentContractAddress = "0x2612Af3A521c2df9EAF28422Ca335b04AdF3ac66";
const investmentContractInstance = new web3.eth.Contract(INVESTMENT_CONTRACT_JSON.abi, investmentContractAddress);

let investor;
const tokenAmount = 19;

const printBalance = async (address, name) => {
    console.log(`Balance of ${name}: `, web3.utils.fromWei(
        await web3.eth.getBalance(address),
        'ether'
    ));
};

const orderTokens = async () => {
    console.log(`Ordering ${tokenAmount} tokens...`);
    await investmentContractInstance.methods.orderTokens(tokenAmount).send({
        from: investor,
        gas: '3000000'
    });
};


(async () => {
    const accounts = await web3.eth.getAccounts();
    investor = accounts[2];

    printBalance(investor, 'Investor');
    printBalance(investmentContractAddress, 'Investment Contract');

    let tokenBalanceIC = await tokenContractInstance.methods.balanceOf(investmentContractAddress).call();
    console.log('Token balance of Investment Contract: ', tokenBalanceIC);

    await orderTokens();

    console.log("\nListening for PurchaseReady events from Investment Contract...");
    investmentContractInstance.events.PurchaseReady({
        // filter: {_buyer: investor}
    })
        .on('data', async function (event) {
            console.log("GOT ", event);
            const toPay = tokenAmount * event.returnValues._price;
            console.log("Amount to pay for the purchase (in wei): ", toPay);

            await investmentContractInstance.methods.finalize(event.returnValues._reqId).send({
                from: investor,
                value: web3.utils.toWei(`${toPay}`, 'wei'),
                gas: '3000000'

            }).on('receipt', async function (txReceipt) {
                console.log('txReceipt', txReceipt);

                printBalance(investor, 'Investor');
                printBalance(investmentContractAddress, 'Investment Contract');

                let tokenBalanceIC = await tokenContractInstance.methods.balanceOf(investmentContractAddress).call();
                console.log('Token balance of Investment contract: ', tokenBalanceIC);

            });

        })
        .on('changed', function (event) {
            console.log(event, " removed");
        })
        .on('error', console.error);

})();