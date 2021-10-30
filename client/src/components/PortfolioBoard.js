import React, {useContext, useEffect, useState} from 'react';
import AppContext from '../context';
import {Header, Icon, Image, List, Segment} from 'semantic-ui-react';

import {CONTRACTS, getAddress, getInstance} from '../utils/getContract';
import {BN, fromWei, toWei} from '../getWeb3';

const PortfolioBoard = () => {
    const {
        portfolio, setPortfolio,
        portfolioAddrs, setPortfolioAddrs,
    } = useContext(AppContext);

    const [NAVs, setNAVs] = useState([]);
    const [NAVPercents, setNAVPercents] = useState([]);
    const [totalNAV, setTotalNAV] = useState('0');

    useEffect(() => {
        const fetchPortfolio = async () => {
            const indexFundContract = getInstance(CONTRACTS.INDEX_FUND);
            const symbols = await indexFundContract.methods.getComponentSymbols().call();
            const addrs = await indexFundContract.methods.getAddressesInPortfolio().call();
            if (symbols) {
                setPortfolio(symbols);
            }
            if (addrs) {
                setPortfolioAddrs(addrs);
            }
        };
        fetchPortfolio();
    }, [setPortfolio, setPortfolioAddrs]);

    useEffect(() => {
        const calcIndividualNAV = async () => {
            let _totalNAV = BN(0);
            let _NAVs = [];
            const path = ['', getAddress(CONTRACTS.WETH)];
            for (const token of portfolio) {
                console.log('token:', token);
                const balanceOfIndexFund = await getInstance(CONTRACTS[token]).methods.balanceOf(getAddress(CONTRACTS.INDEX_FUND)).call();
                path[0] = getAddress(CONTRACTS[token]);
                const amounts = await getInstance(CONTRACTS.UNISWAP_ROUTER).methods.getAmountsOut(balanceOfIndexFund, path).call();
                console.log('amounts:', amounts[1]);
                _NAVs.push(amounts[1]);
                _totalNAV = _totalNAV.add(BN(amounts[1]));
            }
            setNAVs(_NAVs.map(nav => fromWei(nav)));
            setTotalNAV(_totalNAV.toString());
            setNAVPercents(_NAVs.map(nav => parseInt(BN(nav).mul(BN(10000000)).div(BN(_totalNAV)).toString()) / 100000));
        };
        calcIndividualNAV();

    }, [portfolio]);

    const displayPortfolio = () => {
        const items = [];
        for (let i = 0; i < portfolio.length; i++) {
            const item = (
                <List.Item key={i}>
                    <Image avatar src={`../images/${portfolio[i]}.png`}/>
                    <List.Content>
                        <List.Header as="a">{portfolio[i]}</List.Header>
                        <List.Description>
                            <Header as="h5">{portfolioAddrs[i]}</Header>
                        </List.Description>
                    </List.Content>
                    <List.Content floated="right">
                        <Image avatar src="../images/ethereum.png" style={{width: '20px', height: '20px'}}/>
                        <b>{NAVs[i]}</b> ({NAVPercents[i]}%)
                    </List.Content>
                </List.Item>
            );
            items.push(item);
        }
        console.log('symbols', portfolio);
        return items;
    };

    return (
        <Segment padded>
            <Header as="h3">
                <Icon name="briefcase"/>
                Portfolio
            </Header>
            <List>
                {displayPortfolio()}
            </List>
            <br/>
            <List>
                <List.Item>
                    <b style={{fontSize: 'medium'}}>Total Net Asset Value (NAV):</b>
                    <List.Content floated="right">
                        <Image avatar src="../images/ethereum.png" style={{width: '22px', height: '22px'}}/>
                        <b style={{fontSize: 'medium', color: 'green'}}>{fromWei(totalNAV)}</b>
                    </List.Content>
                </List.Item>
            </List>
        </Segment>
    );
};

export default PortfolioBoard;