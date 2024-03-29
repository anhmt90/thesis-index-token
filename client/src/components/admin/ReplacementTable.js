import {Header, Input, Table} from "semantic-ui-react";
import {useContext, useEffect, useRef, useState} from "react";
import {deriveSubbedOutAndSubbedInComponents, selectNewPortfolio} from "../../utils/oracle";
import {CONTRACTS, getAddress} from "../../utils/getContract";
import ITC_ERC20_TOKENS from "../../data/itc_erc20_tokens.json";
import AppContext, {PageContext, AdminPanelContext} from "../../context";


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

    const {
        symbolInputs, setSymbolInputs,
        addressInputs, setAddressInputs,
        itinInputs, setItinInputs
    } = useContext(AdminPanelContext)


    const portfolioSet = useRef(portfolio)
    const componentsOutHashSet = useRef(new Set([]))

    useEffect(() => {
        portfolioSet.current = new Set(portfolio);
    }, [portfolio])

    useEffect(() => {
        const deriveComponentsOutIn = async () => {
            const newPortfolio = await selectNewPortfolio();
            const [_componentsOut, _componentsIn] = await deriveSubbedOutAndSubbedInComponents(newPortfolio);
            componentsOutHashSet.current = new Set(_componentsOut);

            // extract ITINs
            const _componentsInSet = new Set(_componentsIn);
            const _itins = {}
            ITC_ERC20_TOKENS.filter(itcObj => _componentsInSet.has(itcObj.symbol)).map(itcObj => {
              _itins[itcObj.symbol] = itcObj.itin
            })

            // Symbol/Address/ITIN inputs
            const _symbolInputs = []
            const _addressInputs = []
            const _itinInputs = []
            portfolio.map((symbol, i) => {
                const _symbolIn = componentsOutHashSet.current.has(symbol) ? _componentsIn[_componentsOut.indexOf(symbol)] : '';
                _symbolInputs.push(_symbolIn)
                _addressInputs.push(_symbolIn ? getAddress(CONTRACTS[_symbolIn]) : '')
                _itinInputs.push(_symbolIn ? _itins[_symbolIn] : '')
            })
            setSymbolInputs(_symbolInputs)
            setAddressInputs(_addressInputs)
            setItinInputs(_itinInputs)


        }
        if ((portfolio || portfolio.length > 0) && setAddressInputs && setItinInputs && setSymbolInputs)
            deriveComponentsOutIn()

    }, [portfolio, setAddressInputs, setItinInputs, setSymbolInputs])

    function handleChangeSymbol(symbol, i, _symbolInputs) {
        _symbolInputs[i] = symbol;
        setSymbolInputs(_symbolInputs);
    }

    function handleChangeAddress(address, i, _addressInputs) {
        _addressInputs[i] = address;
        setAddressInputs(_addressInputs)
    }

    function handleChangeITIN(itin, i, _itinInputs) {
        _itinInputs[i] = itin;
        setItinInputs(_itinInputs)
    }

    const renderRows = () => {
        const _symbolInputs = [...symbolInputs]
        const _addressInputs = [...addressInputs]
        const _itinInputs = [...itinInputs]

        return portfolio.map((symbol, i) => {

            return (
                <Table.Row color='green' key={i}>
                    <Table.Cell collapsing>
                        <Header as='h4' content={symbol}/>
                    </Table.Cell>
                    <Table.Cell>
                        <Input
                            value={_symbolInputs[i]}
                            placeholder='e.g., DAI'
                            onChange={e => handleChangeSymbol(e.target.value, i, _symbolInputs)}
                        />
                    </Table.Cell>
                    <Table.Cell>
                        <Input
                            value={_addressInputs[i]}
                            placeholder='e.g., 0x1234567890aAbBcCdDfF'
                            onChange={e => handleChangeAddress(e.target.value, i, _addressInputs)}
                        />
                    </Table.Cell>
                    <Table.Cell>
                        <Input
                            value={_itinInputs[i]}
                            placeholder='e.g., QVYPTT104'
                            onChange={e => handleChangeITIN(e.target.value, i, _itinInputs)}
                        />
                    </Table.Cell>
                </Table.Row>
            )

        })

    }

    return (
        <Table structured>
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell rowSpan='2' width={2}>To Be Replaced</Table.HeaderCell>
                    <Table.HeaderCell colSpan='3' textAlign='center'>New Component</Table.HeaderCell>
                </Table.Row>
                <Table.Row>
                    <Table.HeaderCell width={1}>Symbol</Table.HeaderCell>
                    <Table.HeaderCell width={14}>Address</Table.HeaderCell>
                    <Table.HeaderCell width={1}>ITIN</Table.HeaderCell>
                </Table.Row>
            </Table.Header>

            <Table.Body>
                {renderRows()}
            </Table.Body>
        </Table>
    )
}

export default ReplacementTable;