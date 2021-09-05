import {Container, Header, Icon, Segment, Table} from "semantic-ui-react";
import {useEffect, useState} from "react";

import PREV_PRICES from "../../data/tokenPrices-0.json";
import {fromWei} from "../../getWeb3";
import {computePriceDiffPercents, queryCurrentPrices} from "../../utils/oracle";


const PerformanceTable = () => {

    const [currentPrices, setCurrentPrices] = useState(null);
    const [priceDiffPercents, setPriceDiffPercents] = useState(null);

    useEffect(() => {
            const fetchCurrentPrices = async () => {
                return await queryCurrentPrices();
            }
            fetchCurrentPrices().then(async (_currentPrices) => {
                setCurrentPrices(_currentPrices);
                const _priceDiffPercents = await computePriceDiffPercents(PREV_PRICES, _currentPrices)
                setPriceDiffPercents(_priceDiffPercents);
            });
    }, [])

    const renderRows = () => {
        if (!priceDiffPercents || Object.keys(priceDiffPercents).length === 0)
            return undefined;

        return Object.entries(priceDiffPercents).map(([symbol, diffPercent]) => {
            let isNeg = false
            isNeg = diffPercent.isNeg();
            if (isNeg)
                diffPercent = diffPercent.abs()

            return (
                <Table.Row key={symbol}>
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
        <Segment padded>
            <Header as='h3'>
                <Icon name='chart line' />
                Price Performance
            </Header>
            <Container style={{width: '100%'}}>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Token</Table.HeaderCell>
                            <Table.HeaderCell singleLine>Previous Price <Icon name='ethereum' /></Table.HeaderCell>
                            <Table.HeaderCell singleLine>Current Price <Icon name='ethereum' /></Table.HeaderCell>
                            <Table.HeaderCell>Difference</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>

                    <Table.Body>
                        {renderRows()}
                    </Table.Body>
                </Table>
            </Container>
        </Segment>
    )
}

export default PerformanceTable;
