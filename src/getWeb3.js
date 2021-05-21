// const ganache = require('ganache-cli');
// const web3 = new Web3(ganache.provider());

// const web3 = new Web3("http://localhost:8545");

// Ref.: https://hanezu.net/posts/Enable-WebSocket-support-of-Ganache-CLI-and-Subscribe-to-Events.html

const ganache = require('ganache-cli');
const Web3 = require('web3');

let web3;

if(process.argv[1].includes('mocha') && process.env.NODE_ENV === 'TEST') {
    // && process.env.npm_lifecycle_event === 'test'
    web3 = new Web3(ganache.provider());
} else {
    web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
}

const closeWeb3 = () => {
    web3.currentProvider.disconnect();
};

module.exports = web3;
module.exports.closeWeb3 = closeWeb3;