import React, {useState} from 'react';

import AppContext from './context';
import NavBar from "./components/NavBar";
import {Route, useLocation} from "react-router-dom";
import Page from "./components/Page";


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

    const location = useLocation();

    return (
        <AppContext.Provider value={{
            web3,
            location,
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
                <Page />
            </div>

        </AppContext.Provider>
    );
}

export default App;
