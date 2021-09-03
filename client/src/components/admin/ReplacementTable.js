import {Input, Table} from "semantic-ui-react";
import {useContext, useEffect, useRef, useState} from "react";
import AppContext from "../../context";
import {deriveSubbedOutAndSubbedInComponents, selectNewPortfolio} from "../../utils/oracle";
import {CONTRACTS, getAddress} from "../../utils/getContract";


const ReplacementTable = () => {

    const {
        web3,
        account,
        portfolio,
        setIndexBalance,
        ethBalance, setEthBalance,
        supply, setSupply,
        indexBalance, setIndexPrice,
    } = useContext(AppContext);

    const [componentsOut, setComponentsOut] = useState([])
    const [componentsIn, setComponentsIn] = useState([])

    const [symbolInputs, setSymbolInputs] = useState([])
    const [addressInputs, setAddressInputs] = useState([])

    const portfolioSet = useRef(portfolio)
    const componentsOutHashSet = useRef(new Set(componentsOut))

    useEffect(() => {
        portfolioSet.current = new Set(portfolio);
    },[portfolio])

    useEffect(() => {
        const deriveComponentsOutIn = async () => {
            const newPortfolio = await selectNewPortfolio();
            const [_componentsOut, _componentsIn] = await deriveSubbedOutAndSubbedInComponents(newPortfolio);
            console.log('_componentsOut', _componentsOut)
            console.log('_componentsIn', _componentsIn)
            setComponentsOut(_componentsOut);
            setComponentsIn(_componentsIn);
            componentsOutHashSet.current = new Set(_componentsOut);

            const _symbolInputs = []
            const _addressInputs = []
            portfolio.map((symbol, i) => {
                const _symbolIn = componentsOutHashSet.current.has(symbol) ? _componentsIn[_componentsOut.indexOf(symbol)] : '';
                _symbolInputs.push(_symbolIn)
                _addressInputs.push(_symbolIn ? getAddress(CONTRACTS[_symbolIn]) : '')
            })
            setSymbolInputs(_symbolInputs)
            setAddressInputs(_addressInputs)
        }
        if(portfolio || portfolio.length > 0)
            deriveComponentsOutIn()

    }, [portfolio])

    function handleChangeSymbol(_symbolInputs) {
        setSymbolInputs(_symbolInputs);
    }

    function handleChangeAddress(i, val) {
        return undefined;
    }

    const renderRows = () => {
        const _symbolInputs = [...symbolInputs]
        const _addressInputs = [...addressInputs]

        return portfolio.map((symbol, i) => {
            
            return (
                <Table.Row>
                    <Table.Cell>{symbol}</Table.Cell>
                    <Table.Cell>
                        <Input
                            value={_symbolInputs[i]}
                            placeholder='e.g., DAI'
                            onChange={() => handleChangeSymbol(_symbolInputs)}
                        />
                    </Table.Cell>
                    <Table.Cell>
                        <Input
                            value={_addressInputs[i]}
                            placeholder='e.g., 0x1234567890aAbBcCdDfF'
                            onChange={() => handleChangeAddress(i, _addressInputs[i])}
                        />
                    </Table.Cell>
                    <Table.Cell>
                        <Input
                            value={_addressInputs[i]}
                            placeholder='e.g., QVYPTT104'
                            onChange={() => handleChangeAddress(i, _addressInputs[i])}
                        />
                    </Table.Cell>
                </Table.Row>
            )

        })

    }

    return (
        <Table structured celled>
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell rowSpan='2'>To Be Replaced</Table.HeaderCell>
                    <Table.HeaderCell colSpan='3' textAlign='center'>New Component</Table.HeaderCell>
                </Table.Row>
                <Table.Row>
                    <Table.HeaderCell>Symbol</Table.HeaderCell>
                    <Table.HeaderCell>Address</Table.HeaderCell>
                    <Table.HeaderCell>ITIN</Table.HeaderCell>
                </Table.Row>
            </Table.Header>

            <Table.Body>
                {renderRows()}
            </Table.Body>
        </Table>
    )
}

export default ReplacementTable;