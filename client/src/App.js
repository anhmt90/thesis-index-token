import React, { useEffect, useState, useRef } from 'react';
import _ from 'lodash';

import AppContext from './context';
import NavBar from "./components/NavBar";

import addresses from "./data/contractAddresses.json";
import InvestorPage from "./components/investor/InvestorPage";
import {CONTRACTS, getInstance} from "./utils/getContract";



const App = ({ web3 }) => {
    const [account, setAccount] = useState('');
    const [isAccountChanged, setIsAccountChanged] = useState(false);
    const [isWalletDetected, setIsWalletDetected] = useState(false);

    const [networkId, setNetworkId] = useState('');
    const [indexBalance, setIndexBalance] = useState('');

    const [portfolio, setPortfolio] = useState([]);
    const [portfolioAddrs, setPortfolioAddrs] = useState([]);


    useEffect(() => {
        const detectAccount = async () => {
            const _account = (await web3.eth.getAccounts())[0];
            setAccount(web3.utils.toChecksumAddress(_account));
            window.ethereum.on('accountsChanged', function (accounts) {
                setIsAccountChanged(true);
                if (!accounts[0]) {
                    setIsWalletDetected(false);
                } else {
                    setIsWalletDetected(true);
                    setAccount(accounts[0]);
                }
            });
            window.ethereum.on('chainChanged', (_chainId) => window.location.reload());
        }

        detectAccount();
    },[web3.utils, web3.eth])

    useEffect(() => {
        const detectNetwork = async () => {
            if (window.ethereum) {
                const networkId = await web3.eth.net.getId();
                setNetworkId(networkId);
            }
        };
        detectNetwork();
    }, [networkId, web3.eth.net]);

    useEffect(() => {
        const queryDFAMBalance = async () => {
            if(account){
                const balance = await getInstance(CONTRACTS.INDEX_TOKEN).methods.balanceOf(account).call();
                setIndexBalance(balance)
            }
        };
        queryDFAMBalance();
    }, [account]);

    useEffect(() => {
        const fetchPortfolio = async () => {
            const indexFundContract = getInstance(CONTRACTS.INDEX_FUND);
            const symbols = await indexFundContract.methods.getComponentSymbols().call();
            const addrs = await indexFundContract.methods.getAddressesInPortfolio().call();
            if (symbols) {
                setPortfolio(symbols);
            }
            if (addrs) {
                setPortfolioAddrs(addrs)
            }
        }
        fetchPortfolio();
    }, [setPortfolio, web3])

    return (
        <AppContext.Provider value={{
            web3,
            account,
            isWalletDetected,

            portfolio,
            portfolioAddrs,

            networkId,
            indexBalance,
        }}>
            <div style={{ width: '100vw', height: '100vh' }}>
                <NavBar />
                <InvestorPage />
            </div>

        </AppContext.Provider>
    );
}

export default App;
