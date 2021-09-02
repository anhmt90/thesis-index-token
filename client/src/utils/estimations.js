import allAddrs from "../data/contractAddresses.json";
import {BN, fromWei, toWei, web3} from "../getWeb3";
import {_getSwapPath} from "./common";
import {CONTRACTS, getInstance} from "./getContract";
import {getAmountOut, swapExactETHForTokens} from "./simulateUniswap";
import ERC20_JSON from "../abis/ERC20.json";


const queryUniswapEthOut = async (tokenSymbol, amountToken) => {
    const path = _getSwapPath(tokenSymbol, false);
    const amounts = await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.getAmountsOut(amountToken, path).call();
    return amounts[1];
};

export const queryPortfolioNAV = async () => {
    const fundContract = getInstance(CONTRACTS.INDEX_FUND);
    const currentPortfolio = (await fundContract.methods.getComponentSymbols().call());
    let sum = BN(0);
    let ethOut;
    for (const componentSymbol of currentPortfolio) {
        const componentBalance = await getInstance(CONTRACTS[componentSymbol]).methods.balanceOf(allAddrs.indexFund).call();
        ethOut = await queryUniswapEthOut(componentSymbol, componentBalance);
        sum = sum.add(BN(ethOut));
    }
    return sum.toString();
};

export const queryIndexPrice = async () => {
    return await getInstance(CONTRACTS.INDEX_FUND).methods.getIndexPrice().call();
}

const queryNAVsOfSpecificComponentAmounts = async (componentAmounts) => {
    const componentSymbols = await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call();
    const ethNAVs = {}
    for (let i = 0; i < componentSymbols.length; i++) {
        const symbol = componentSymbols[i];
        const amount = componentAmounts[i];
        ethNAVs[symbol] = await queryUniswapEthOut(symbol, amount);
    }
    return ethNAVs;
}

const queryTotalNAVsOfSpecificComponentAmounts = async (componentAmounts) => {
    const ethNAVs = await queryNAVsOfSpecificComponentAmounts(componentAmounts)
    return Object.values(ethNAVs).reduce((accum, ethAmount) => accum.add(BN(ethAmount)), BN(0)).toString()
}

const estimateTotalNAVOfCapital = async (totalETH) => {
    const componentSymbols = await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call();
    const ethEach = BN(totalETH).div(BN(componentSymbols.length));
    let totalNAV = BN(0);
    for (const symbol of componentSymbols) {
        const [reserveWETHUpdated, reserveTokenUpdated] = await swapExactETHForTokens(symbol, ethEach);

        const path = _getSwapPath(symbol, true)
        const amounts = await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.getAmountsOut(ethEach, path).call();
        const componentNAV = getAmountOut(amounts[1], reserveTokenUpdated, reserveWETHUpdated)
        totalNAV = totalNAV.add(BN(componentNAV))
    }
    return totalNAV.toString();
}

export const estimateMintedDFAM = async (totalETH) => {
    const indexPrice = await queryIndexPrice();
    const totalNAV = await estimateTotalNAVOfCapital(totalETH);
    return BN(totalNAV).mul(BN(toWei('1'))).div(BN(indexPrice)).toString()
}

export const estimateReceivedNAV = async (amountDFAM) => {
    const indexPrice = await queryIndexPrice();
    const componentSymbols = await getInstance(CONTRACTS.INDEX_FUND).methods.getComponentSymbols().call();
    const navOutForEach = BN(amountDFAM).mul(BN(indexPrice)).div(BN(toWei('1'))).div(BN(componentSymbols.length)).toString();

    const routerInstance = getInstance(CONTRACTS.UNISWAP_ROUTER);
    const path = ['', allAddrs.WETH]
    let totalNAVOut = BN(0);
    for (const symbol of componentSymbols) {
        path[0] = allAddrs[symbol];
        const amounts = await routerInstance.methods.getAmountsIn(navOutForEach, path).call();
        let amountToSell = amounts[0];
        const componentBalanceOfIndexFund = await getInstance(CONTRACTS[symbol]).methods.balanceOf(allAddrs.indexFund).call();
        if (BN(amountToSell).gt(BN(componentBalanceOfIndexFund)))
            amountToSell = componentBalanceOfIndexFund;

        // const [reserveTokenUpdated, reserveWETHUpdated]= await swapExactTokensForETH(symbol, amountToSell)
        const pair = await getInstance(CONTRACTS.UNISWAP_FACTORY).methods.getPair(path[0], path[1]).call();
        let reserveComponent = await (new web3.eth.Contract(ERC20_JSON.abi, path[0])).methods.balanceOf(pair).call();
        let reserveWETH = await (new web3.eth.Contract(ERC20_JSON.abi, path[1])).methods.balanceOf(pair).call();
        const componentNAV = getAmountOut(amountToSell, reserveComponent, reserveWETH);
        totalNAVOut = totalNAVOut.add(BN(componentNAV))
    }
    return totalNAVOut.toString();
}

export const estimateTxCost = async (tx, sender, value) => {
    console.log('valueInEther', value);

    const gasUsed = await tx.estimateGas({
        from: sender,
        gas: '3000000',
        value: value ? toWei(value.toString()) : ''
    });
    const estimation = BN(gasUsed).mul(BN(await web3.eth.getGasPrice())).toString();
    console.log('estimation', BN(gasUsed).mul(BN(await web3.eth.getGasPrice())).toString());
    return estimation;
};