const Web3 = require('web3');
// const { oracleContractAddress } = require('./deploy');

// Ref.: https://hanezu.net/posts/Enable-WebSocket-support-of-Ganache-CLI-and-Subscribe-to-Events.html
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));

const ORACLE_CONTRACT_JSON = require('../build/contracts/Oracle.json');

const oracleContractAddress = "0x67B5656d60a809915323Bf2C40A8bEF15A152e3e";
const oracleContractInstance = new web3.eth.Contract(ORACLE_CONTRACT_JSON.abi, oracleContractAddress);


(async () => {
    const accounts = await web3.eth.getAccounts();
    const trustedOracleServer = accounts[1];

    /**
     * Subscribe to events
     * Resources:
     *      https://web3js.readthedocs.io/en/v1.2.0/web3-eth-contract.html#id36
     *      https://hanezu.net/posts/Enable-WebSocket-support-of-Ganache-CLI-and-Subscribe-to-Events.html
     *      https://ethereum.stackexchange.com/questions/35997/how-to-listen-to-events-using-web3-v1-0
     *      https://betterprogramming.pub/ethereum-dapps-how-to-listen-for-events-c4fa1a67cf81
     */
    console.log(`\nListening for PriceRequest events from Oracle Contract (${oracleContractAddress})...`)
    oracleContractInstance.events.PriceRequest({})
        .on('data', async function (event) {
            console.log("GOT ", event);

            console.log("returnValues ", event.returnValues);

            const reqId = event.returnValues._reqId;
            const dummyPrice = web3.utils.toWei('20000', 'wei');

            await oracleContractInstance.methods.respond(reqId, dummyPrice).send({
                from: trustedOracleServer,
                gas: '3000000'
            })
        })
        .on('changed', function (event) {
            console.log(event, " removed");
        })
        .on('error', console.error);

})();



// let web3Provider = new Web3.providers.WebsocketProvider("wss://ropsten.infura.io/ws");
// var web3Obj = new Web3(web3Provider);
// var subscription = web3Obj.eth.subscribe('logs', {
//     address: '0x123456..', //Smart contract address
//     topics: ['0x12345...'] //topics for events
// }, function(error, result){
//     if (error) console.log(error);
// }).on("data", function(trxData){
// console.log("Event received", trxData);
// //Code from here would be run immediately when event appeared
// }))