import React, {useState, useEffect, useContext, useRef} from 'react';
import {Menu, Image, Button, List, ListItem, ListContent, Label} from 'semantic-ui-react';
import AppContext from "../context";
import {CONTRACTS, getInstance} from "../utils/getContract";

const NavBar = () => {
    const {
        web3,
        account, setAccount,
        isAccountChanged, setIsAccountChanged,
        isWalletDetected, setIsWalletDetected,
        networkId, setNetworkId,
        indexBalance, setIndexBalance,
    } = useContext(AppContext);

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
    },[web3.utils, web3.eth, setAccount, setIsAccountChanged, setIsWalletDetected])

    useEffect(() => {
        const detectNetwork = async () => {
            if (window.ethereum) {
                const networkId = await web3.eth.net.getId();
                setNetworkId(networkId);
            }
        };
        detectNetwork();
    }, [networkId, setNetworkId, web3.eth.net]);

    useEffect(() => {
        const queryDFAMBalance = async () => {
            if(account){
                const balance = await getInstance(CONTRACTS.INDEX_TOKEN).methods.balanceOf(account).call();
                setIndexBalance(balance)
            }
        };
        queryDFAMBalance();
    }, [account, setIndexBalance]);


    //if metamask is installed but not connected
    const handleConnect = () => {
        window.ethereum.enable();
    };

    const renderMetaMaskLabel = () => {
        if (window.ethereum) {
            return !isWalletDetected && !account ?
                <Button className='connect-metamask' onClick={handleConnect}>No wallet detected</Button>
                : account.substring(0, 8) + '...' + account.substring(36);
        } else {
            return <Button className='connect-metamask' onClick={handleInstall}>Install MetaMask</Button>;
        }
    };

    //if metamask is not installed at all
    const handleInstall = () => {
        window.open(
            'https://metamask.io/download.html',
            '_blank'
        );
    };

    const renderNetworkLabel = () => {
        let network = '';
        switch (networkId) {
            case 1:
                network = 'Ethereum Mainnet';
                break;
            case 2:
                network = 'Deprecated Modern Testnet';
                break;
            case 3:
                network = 'Ropsten Testnet';
                break;
            case 4:
                network = 'Rinkeby Testnet';
                break;
            case 5:
                network = 'Goerli Testnet';
                break;
            case 42:
                network = 'Kovan Testnet';
                break;
            // case 1608336296668:
            //     network = 'TeSC Testnet';
            //     break;
            default:
                // network = blockChainUrl ? blockChainUrl : 'Ganache';
                network = 'Ganache';
        }
        if (window.ethereum) {
            return network;
        } else {
            return <Button className='connect-metamask' onClick={handleInstall}>Install MetaMask</Button>;
        }
    }

    return (
        <div className='navbar'>
            <Menu size='massive' style={{borderRadius: '0px', alignItems: 'center'}}>


                <Menu.Header style={{padding: '10px 30px'}}>
                    <Image src='../images/DFAM.jpg' wrapped size={'tiny'} style={{height: '35px'}}/>
                </Menu.Header>


                <Menu.Item name='Investor'/>

                <Menu.Item name='Admin'/>

                <Menu.Menu position='right'>
                    <Menu.Item>
                        <span>{renderNetworkLabel()}</span>
                    </Menu.Item>

                    <Menu.Item>
                        <span>{renderMetaMaskLabel()}</span>
                    </Menu.Item>

                    <Menu.Item>
                        <b>{web3.utils.fromWei(indexBalance)}</b>
                        &nbsp;
                        <Image avatar src='../images/DFAM.jpg' style={{width: '25px', height: '25px'}}/>
                    </Menu.Item>

                </Menu.Menu>
            </Menu>
        </div>
    );
};

export default NavBar;