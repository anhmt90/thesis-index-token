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
    const [ethBalance, setEthBalance] = useState('');

    const [portfolio, setPortfolio] = useState([]);
    const [portfolioAddrs, setPortfolioAddrs] = useState([]);

    const [supply, setSupply] = useState('');
    const [indexPrice, setIndexPrice] = useState('');



    return (
        <AppContext.Provider value={{
            web3,
            account, setAccount,
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
            <div style={{ width: '100vw', height: '100vh' }}>
                <NavBar />
                <InvestorPage />
            </div>

        </AppContext.Provider>
    );
}

export default App;
