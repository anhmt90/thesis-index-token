const {increaseGanacheBlockTime} = require('./utils')
const web3 = require('./getWeb3');

let blockTimeBefore;

web3.eth.getBlock('latest').then(async (block) => {
    blockTimeBefore = new Date(parseInt(block.timestamp) * 1000);

    await increaseGanacheBlockTime()
    console.log('Done increasing block time!')
    console.log('BlockTime before:', blockTimeBefore.toString())
    const _block = await web3.eth.getBlock('latest')
    const blockTimeAfter = new Date(parseInt(_block.timestamp) * 1000)
    console.log('BlockTime after:', blockTimeAfter.toString())

}).finally(() => {
    web3.currentProvider.disconnect();
});



