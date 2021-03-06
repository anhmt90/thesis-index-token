import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';

const getWeb3 = async () => {
    let web3;
    if (typeof window !== 'undefined' && window.ethereum !== 'undefined') {
        /**
         * We are in the browser and metasmask is running
         */
        console.log("METAMASK RUNNING");
        // try {
        //     window.ethereum.enable().then(async () => {
        //         const provider = await detectEthereumProvider();
        //         web3 = new Web3(provider);
        //     });
        // } catch (err) {
        //     console.log(err);
        // }
        const provider = await detectEthereumProvider();
        web3 = new Web3(provider);

    } else {
        /**
         * We are not running Metamask
         * --> create our own provider and wire it up with web3
         */
        console.log("Select HTTP Provider");
        const provider = new Web3.providers.HttpProvider(
            // 'https://rinkeby.infura.io/v3/ad6c5b3aa2854ff2845f842c4e308077'
            'http://localhost:8545'
        );

        web3 = new Web3(provider);
    }
    return web3;
};

export let BN;
export let web3;
export let toWei;
export let fromWei;

getWeb3().then(_web3 => {
    BN = _web3.utils.toBN
    web3 = _web3
    toWei = web3.utils.toWei;
    fromWei = web3.utils.fromWei;
    window.BN = BN
});

export default getWeb3;