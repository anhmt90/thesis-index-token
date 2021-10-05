import React, {useEffect, useState} from 'react';

import AppContext from './context';
import NavBar from "./components/NavBar";
import {Route, useLocation} from "react-router-dom";
import Page from "./components/Page";
import {CONTRACTS, getAddress, getInstance} from "./utils/getContract";
import {toWei} from "./getWeb3";
import Web3 from "web3";
import {updateReserves} from "./utils/simulateUniswap";


const App = ({_web3}) => {
    const [account, setAccount] = useState('');
    const [isAccountChanged, setIsAccountChanged] = useState(false);
    const [isWalletDetected, setIsWalletDetected] = useState(false);

    const [networkId, setNetworkId] = useState('');
    const [indexBalance, setIndexBalance] = useState('');
    const [ethBalance, setEthBalance] = useState('');

    const [portfolio, setPortfolio] = useState([]);
    const [portfolioAddrs, setPortfolioAddrs] = useState([]);

    const [supply, setSupply] = useState('');
    const [indexPrice, setIndexPrice] = useState('');
    const [isAdmin, setIsAdmin] = useState('');

    const location = useLocation();

    useEffect(() => {
        const setUpPresentation = async () => {

        }

    }, [])

    useEffect(() => {
        const setUpPresentation = async () => {
            const owner = await getInstance(CONTRACTS.ORACLE).methods.owner().call()
            setIsAdmin(account === owner)

            updateReserves()
            const totalSupply = await getInstance(CONTRACTS.INDEX_TOKEN).methods.totalSupply().call()

            const _web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
            const _accounts = await _web3.eth.getAccounts()
            console.log('_accounts', _accounts)
            const investor = _accounts[1]
            const LP = _accounts[2]

            if (totalSupply === '0') {
                await getInstance(CONTRACTS.INDEX_FUND).methods.buy([]).send({
                    from: investor,
                    value: toWei('0.01'),
                    gas: '5000000'
                });
            }

            await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
                0,
                [getAddress(CONTRACTS.WETH), getAddress(CONTRACTS.YFI)],
                investor,
                ((await _web3.eth.getBlock(await _web3.eth.getBlockNumber())).timestamp + 10000).toString()
            ).send({
                from: LP,
                value: toWei('200'),
                gas: '5000000'
            });

            await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.swapExactETHForTokens(
                0,
                [getAddress(CONTRACTS.WETH), getAddress(CONTRACTS.MKR)],
                investor,
                ((await _web3.eth.getBlock(await _web3.eth.getBlockNumber())).timestamp + 10000).toString()
            ).send({
                from: LP,
                value: toWei('200'),
                gas: '5000000'
            });
        }

        if (account) {
            setUpPresentation()
        }

    }, [account])

    return (
        <AppContext.Provider value={{
            web3: _web3,
            location,
            account, setAccount,
            isAdmin,
            isAccountChanged, setIsAccountChanged,
            isWalletDetected, setIsWalletDetected,

            portfolio, setPortfolio,
            portfolioAddrs, setPortfolioAddrs,

            networkId, setNetworkId,
            indexBalance, setIndexBalance,
            ethBalance, setEthBalance,

            indexPrice, setIndexPrice,
            supply, setSupply,

        }}>
            <div style={{width: '100vw', height: '100vh'}}>
                <NavBar/>
                <Page/>
            </div>

        </AppContext.Provider>
    );
}

export default App;
