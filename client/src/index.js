import React from 'react';
import ReactDOM from 'react-dom';

import reportWebVitals from "./reportWebVitals";
import App from './App';
import getWeb3 from './getWeb3';
import 'semantic-ui-css/semantic.min.css'

import { BrowserRouter } from 'react-router-dom';


getWeb3().then(web3 => {
    ReactDOM.render(
        <React.StrictMode>
            <BrowserRouter>
                <App web3={web3} />
            </BrowserRouter>
        </React.StrictMode>,
        document.getElementById('root')
    );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
