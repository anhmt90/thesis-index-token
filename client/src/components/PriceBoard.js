import React, {useContext, useEffect, useRef, useState} from 'react';
import AppContext from "../context";
import {Header, Icon, Image, List, Segment} from "semantic-ui-react";

import {CONTRACTS, getInstance} from '../utils/getContract'

const PriceBoard = () => {
    const {web3} = useContext(AppContext);

    const [supply, setSupply] = useState('');
    const [indexPrice, setIndexPrice] = useState('');


    useEffect(() => {
        const indexFundContract = getInstance(CONTRACTS.INDEX_FUND);
        const dfamContract = getInstance(CONTRACTS.INDEX_TOKEN);
        console.log("supply (before): ", supply)
        const fetchPrice = async () => {
            const supply = await dfamContract.methods.totalSupply().call();
            const price = await indexFundContract.methods.getIndexPrice().call();
            setSupply(supply);
            setIndexPrice(price);
        }
        fetchPrice().then(r => console.log("r: ", r));
    }, [supply])


    return (
        <Segment raised>
            <Header as='h3'>
                <Icon name='dollar' />
                Price
            </Header>
            <p> {supply === '0' && 'Nominal'} Price: 1 DFAM = {web3.utils.fromWei(indexPrice)} ETH </p>
            <p>Total Supply: {supply}</p>

        </Segment>
    )
}

export default PriceBoard;