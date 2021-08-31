import UNISWAP_PAIR_JSON from '@uniswap/v2-core/build/UniswapV2Pair.json'
import ERC20_JSON from '../abis/ERC20.json'
import allAddrs from "../data/contractAddresses.json";
import {CONTRACTS, getInstance} from "./getContract";
import {BN, web3} from "../getWeb3";


export const _getSwapPath = (tokenSymbol, eth2Token = true) => {
    return eth2Token ? [allAddrs.WETH, allAddrs[tokenSymbol]] : [allAddrs[tokenSymbol], allAddrs.WETH]
};



