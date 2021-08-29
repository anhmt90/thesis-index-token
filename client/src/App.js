import React, { useEffect, useState, useRef } from 'react';


const App = ({ web3 }) => {
    const indexFundAddress = ''
    const [networkId, setNetworkId] = useState('');
    const [account, setAccount] = useState('');
    const portfolio = useRef([]);

    useEffect(() => {

    },[])

    return (
        <div>
            <h1>This is a shown text</h1>
        </div>
    );
}

export default App;
