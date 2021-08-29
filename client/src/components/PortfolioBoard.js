import React, {Fragment, useContext, useEffect, useState} from 'react';
import AppContext from "../context";
import {Image, List} from "semantic-ui-react";

import {getContract, CONTRACTS} from '../utils/getContract'
import allAddrs from "../data/contractAddresses.json";

const PortfolioBoard = () => {
    const {web3} = useContext(AppContext);

    const [portfolioSymbols, setPortfolioSymbols] = useState([]);
    const [portfolioAddrs, setPortfolioAddrs] = useState([]);

    useEffect(() => {
        const fetchPortfolio = async () => {
            const indexFundContract = getContract(CONTRACTS.INDEX_FUND, web3);
            const symbols = await indexFundContract.methods.getComponentSymbols().call();
            const addrs = await indexFundContract.methods.getAddressesInPortfolio().call();
            if (symbols) {
                setPortfolioSymbols(symbols);
            }
            if (addrs) {
                setPortfolioAddrs(addrs)
            }
        }
        fetchPortfolio();
    }, [web3])

    const displayPortfolio = () => {
        const items = []
        for (let i = 0; i < portfolioSymbols.length; i++) {
            const item = (
                <List.Item>
                    <Image avatar src='https://react.semantic-ui.com/images/avatar/small/rachel.png'/>
                    <List.Content>
                        <List.Header as='a'>{portfolioSymbols[i]}</List.Header>
                        <List.Description content={portfolioAddrs[i]}/>
                    </List.Content>
                </List.Item>
            )
            items.push(item);
        }
        console.log("symbols", portfolioSymbols)
        return items;
    }

    return (
        <List>
            {displayPortfolio()}
        </List>
    )
}

export default PortfolioBoard;