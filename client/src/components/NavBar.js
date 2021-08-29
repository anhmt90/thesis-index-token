import React, {useState, useEffect, useContext} from 'react';
import {Menu, Icon, Label, Image, Button} from 'semantic-ui-react';
import AppContext from "../context";

const NavBar = () => {
    const {web3, account, isWalletDetected} = useContext(AppContext);
    const [networkId, setNetworkId] = useState('');

    useEffect(() => {
        (async () => {
            if (window.ethereum) {
                const networkId = await web3.eth.net.getId();
                setNetworkId(networkId);
            }
        })();
    }, [networkId, web3.eth.net]);

    //if metamask is installed but not connected
    const handleConnect = () => {
        window.ethereum.enable();
    };

    const renderMetaMaskLabel = () => {
        if (window.ethereum) {
            return !isWalletDetected && !account ?
                <Button className='connect-metamask' onClick={handleConnect}>No wallet detected</Button>
                : account;
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
        console.log(networkId);
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
            <Menu size='massive'  style={{borderRadius: '0px', alignItems: 'center'}}>


                <Menu.Header style={{ padding: '10px 30px'}}>
                    <Image src='../images/DFAM.jpg' wrapped size={'tiny'} style={{height: '35px'}}  />
                </Menu.Header>


                <Menu.Item name='Investor'/>

                <Menu.Item name='Admin'/>

                <Menu.Menu position='right'>
                    <Menu.Item>
                        <span>Network: {renderNetworkLabel()}</span>
                    </Menu.Item>

                    <Menu.Item>
                        <span>Wallet: {renderMetaMaskLabel()}</span>
                    </Menu.Item>

                </Menu.Menu>
            </Menu>
        </div>
    );
};

export default NavBar;