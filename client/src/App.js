import React, { useEffect, useState, useRef } from 'react';

import AppContext from './context';
import NavBar from "./components/NavBar";

import addresses from "./data/contractAddresses.json";



const App = ({ web3 }) => {
    const indexFundAddress = ''

    const [account, setAccount] = useState('');
    const [isAccountChanged, setIsAccountChanged] = useState(false);
    const [isWalletDetected, setIsWalletDetected] = useState(false);

    const portfolio = useRef([]);

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

        detectAccount().then(r => null);
    },[web3.utils, web3.eth])

    return (
        <AppContext.Provider value={{
            web3,
            account,
            isWalletDetected,
        }}>
            <div style={{ width: '100vw', height: '100vh' }}>
                <NavBar />
                <h1>{Object.entries(addresses).map(([k, v]) => v + ', \n')}</h1>
            </div>

        </AppContext.Provider>
    );
}

export default App;
