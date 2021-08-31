import React, {useContext, useEffect} from 'react';
import AppContext from "../context";
import {Header, Icon, Segment} from "semantic-ui-react";

import {CONTRACTS, getInstance} from '../utils/getContract'
import {fromWei} from "../getWeb3";

const PriceBoard = () => {
    const {
        indexPrice, setIndexPrice,
        supply, setSupply,
    } = useContext(AppContext);


    useEffect(() => {
        const fetchPrice = async () => {
            const _supply = await getInstance(CONTRACTS.INDEX_TOKEN).methods.totalSupply().call();
            const _price = await getInstance(CONTRACTS.INDEX_FUND).methods.getIndexPrice().call();
            setSupply(_supply);
            setIndexPrice(_price);
        }
        fetchPrice();
    }, [supply, indexPrice, setSupply, setIndexPrice])


    return (
        <Segment padded>
            <Header as='h3'>
                <Icon name='dollar' />
                Price
            </Header>
            <p> {supply === '0' && 'Nominal'} Price: 1 DFAM = {fromWei(indexPrice)} ETH </p>
            <p>Total Supply: {supply}</p>

        </Segment>
    )
}

export default PriceBoard;