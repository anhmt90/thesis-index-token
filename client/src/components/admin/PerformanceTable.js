import {Header, Rating, Table} from "semantic-ui-react";
import {useContext, useEffect, useState} from "react";
import AppContext from "../../context";

import PREV_PRICES from "../../data/tokenPrices-0.json";
import {fromWei, BN} from "../../getWeb3";
import {computePriceDiffPercents, queryCurrentPrices} from "../../utils/oracle";


const PerformanceTable = () => {

    const {
        web3,
        account,
        portfolio,
        setIndexBalance,
        ethBalance, setEthBalance,
        supply, setSupply,
        indexBalance, setIndexPrice,
    } = useContext(AppContext);

    const [currentPrices, setCurrentPrices] = useState(null);
    const [priceDiffPercents, setPriceDiffPercents] = useState(null);

    useEffect(() => {
        const fetchCurrentPrices = async () => {
            return await queryCurrentPrices();
        }
        fetchCurrentPrices().then(async (_currentPrices) => {
            setCurrentPrices(_currentPrices);
            const priceDiffPercents = await computePriceDiffPercents(PREV_PRICES, _currentPrices)
            setPriceDiffPercents(priceDiffPercents);
        });
    }, [])

    const renderRows = () => {
        if (!priceDiffPercents)
            return undefined;

        const _priceDiffPercents = Object.entries(priceDiffPercents).map(([symbol, diffPercent]) => ({symbol, diffPercent}))


        return Object.entries(priceDiffPercents).map(([symbol, diffPercent]) => {
            let isNeg = false
            isNeg = diffPercent.isNeg();
            if (isNeg)
                diffPercent = diffPercent.abs()

            return (
                <Table.Row>
                    <Table.Cell>
                        <Header as='h4'>
                            {symbol}
                        </Header>
                    </Table.Cell>
                    <Table.Cell singleLine>{fromWei(PREV_PRICES[symbol])}</Table.Cell>
                    <Table.Cell>
                        {currentPrices && fromWei(currentPrices[symbol])}
                    </Table.Cell>
                    <Table.Cell>
                        <Header as='h5' color={isNeg ? 'red' : 'green'}>
                            {priceDiffPercents && `${isNeg ? '-' : '+'} ${fromWei(diffPercent.toString())}`} %
                        </Header>
                    </Table.Cell>
                </Table.Row>
            )
        })
    }

    return (
        <Table padded>
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell>Component</Table.HeaderCell>
                    <Table.HeaderCell singleLine>Previous Price</Table.HeaderCell>
                    <Table.HeaderCell singleLine>Current Price</Table.HeaderCell>
                    <Table.HeaderCell>Difference</Table.HeaderCell>
                </Table.Row>
            </Table.Header>

            <Table.Body>
                {renderRows()}
            </Table.Body>
        </Table>
    )
}

export default PerformanceTable;
