import React from 'react';
import ReactDOM from 'react-dom';

import reportWebVitals from "./reportWebVitals";
import App from './components/App';
import getWeb3 from './getWeb3';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);


getWeb3().then(web3 => {
    ReactDOM.render(
        <React.StrictMode>
                <App web3={web3} />
        </React.StrictMode>,
        document.getElementById('root')
    );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
