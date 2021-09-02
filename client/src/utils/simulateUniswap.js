import {BN, web3} from "../getWeb3";
import {CONTRACTS, getInstance} from "./getContract";
import ERC20_JSON from "../abis/ERC20.json";
import {_getSwapPath} from "./common";

// UniswapV2Router02._swap()
const _swap = async (amounts, path) => {
    const amount1Out = amounts[1];
    const pair = await getInstance(CONTRACTS.UNISWAP_FACTORY).methods.getPair(path[0], path[1]).call();

    // UniswapV2Pair.swap()
    let balance0 = await (new web3.eth.Contract(ERC20_JSON.abi, path[0])).methods.balanceOf(pair).call();
    let balance1 = await (new web3.eth.Contract(ERC20_JSON.abi, path[1])).methods.balanceOf(pair).call();
    if (BN(amount1Out).gt(BN(0)))
        balance1 = BN(balance1).sub(BN(amount1Out)).toString()

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
