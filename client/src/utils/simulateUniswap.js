import {BN, web3} from "../getWeb3";
import {CONTRACTS, getAddress, getInstance} from "./getContract";
import ERC20_JSON from "../abis/ERC20.json";
import {_getSwapPath} from "./common";
import tokenPrices from '../data/tokenPrices-0.json'

const reserves = {}

export const updateReserves = () => {
    const weth = getAddress(CONTRACTS.WETH)
    const path = [weth, '']
    Object.entries(tokenPrices).map(async ([symbol, _]) => {
        path[1] = getAddress(CONTRACTS[symbol])
        const pair = await getInstance(CONTRACTS.UNISWAP_FACTORY).methods.getPair(path[0], path[1]).call();
        let balanceWETH = await (new web3.eth.Contract(ERC20_JSON.abi, weth)).methods.balanceOf(pair).call();
        let balanceToken = await (new web3.eth.Contract(ERC20_JSON.abi, path[1])).methods.balanceOf(pair).call();
        reserves[pair] = {}
        reserves[pair][path[0]] = balanceWETH
        reserves[pair][path[1]] = balanceToken
    })
}

// UniswapV2Router02._swap()
const _swap = async (amounts, path) => {
    const amount1Out = amounts[1];
    const pair = await getInstance(CONTRACTS.UNISWAP_FACTORY).methods.getPair(path[0], path[1]).call();

    let balance0;
    let balance1;
    // UniswapV2Pair.swap()
    if(true) {
        balance0 = await (new web3.eth.Contract(ERC20_JSON.abi, path[0])).methods.balanceOf(pair).call();
        balance1 = await (new web3.eth.Contract(ERC20_JSON.abi, path[1])).methods.balanceOf(pair).call();
    } else {
        const isPath0WETH = path[0] === getAddress(CONTRACTS.WETH)
        if (isPath0WETH) {
            balance0 = reserves[pair][path[0]]
            balance1 = reserves[pair][path[1]]
        } else {
            balance0 = reserves[pair][path[1]]
            balance1 = reserves[pair][path[0]]
        }
    }
    console.log('amount1Out', amount1Out)
    if (BN(amount1Out).gt(BN(0))) {
        console.log('reserves', reserves)
        console.log('reserves[pair]', reserves[pair])
        console.log('path[0]', path[0])
        console.log('path[1]', path[1])

        balance1 = BN(balance1).sub(BN(amount1Out)).toString()
    }

    return [balance0, balance1]
}

// UniswapV2Library.getAmountOut()
export const getAmountOut = (amountIn, reserveIn, reserveOut) => {
    const amountInWithFee = BN(amountIn).mul(BN(997));
    const numerator = amountInWithFee.mul(BN(reserveOut));
    const denominator = BN(reserveIn).mul(BN(1000)).add(amountInWithFee);
    const amountOut = numerator.div(denominator);
    return amountOut.toString();
}

// UniswapV2Router02.swapExactETHForTokens()
export const swapExactETHForTokens = async (componentSymbol, ethAmount) => {
    const path = _getSwapPath(componentSymbol)
    const amounts = await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.getAmountsOut(ethAmount, path).call();
    console.log('amounts ===>', amounts)
    const [reserveWETH, reserveTokenUpdated] = await _swap(amounts, path)
    const reserveWETHUpdated = BN(reserveWETH).add(BN(ethAmount)).toString()
    return [reserveWETHUpdated, reserveTokenUpdated]
}

// UniswapV2Router02.swapExactTokensForETH()
export const swapExactTokensForETH = async (componentSymbol, tokenAmount) => {
    const path = _getSwapPath(componentSymbol)
    const amounts = await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.getAmountsOut(tokenAmount, path).call();
    const [reserveToken, reserveWETHUpdated] = await _swap(amounts, path)
    const reserveTokenUpdated = BN(reserveToken).add(BN(tokenAmount)).toString()
    return [reserveTokenUpdated, reserveWETHUpdated]
}
