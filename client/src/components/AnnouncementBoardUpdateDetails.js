import {forwardRef, Fragment, useContext, useEffect, useImperativeHandle, useState} from "react";
import {Form, Header, Image, List, ListDescription} from "semantic-ui-react";
import {CONTRACTS, getInstance} from "../utils/getContract";
import allAddrs from "../data/contractAddresses.json";
import AppContext, {AnnouncementBoardContext} from "../context";


const AnnouncementBoardUpdateDetails = forwardRef((props, ref) => {
    const {account} = useContext(AppContext)
    const {
        queryTime,
        updateTime,
        latestBlockTime,
    } = useContext(AnnouncementBoardContext)

    const [newPortfolio, setNewPortfolio] = useState([])
    const [componentsOut, setComponentsOut] = useState([])
    const [componentsIn, setComponentsIn] = useState([])
    const [componentAddrsIn, setComponentAddrsIn] = useState([])
    const [itins, setItins] = useState([])

    useImperativeHandle(ref, () => ({
        async handleCommitUpdate (e) {
            console.log("INSIDE handleCommitUpdate")
            e.preventDefault();
            if (latestBlockTime >= updateTime.getTime()) {
                const _amountsOutMinOut = Array(componentsOut.length).fill('0')
                const _amountsOutMinIn = Array(componentsIn.length).fill('0')
                await getInstance(CONTRACTS.ORACLE).methods.commitUpdate(_amountsOutMinOut, _amountsOutMinIn).send({
                    from: account,
                    gas: '3000000'
                }).on('receipt', async (txReceipt) => {
                    await queryTime();
                });
            }
        },
    }));

    useEffect(() => {
        const queryOracleData = async () => {
            const _componentsOut = await getInstance(CONTRACTS.ORACLE).methods.getComponentSymbolsOut().call()
            const _componentAddrsIn = await getInstance(CONTRACTS.ORACLE).methods.getComponentAddrsIn().call()
            const _componentAddrsInSet = new Set(_componentAddrsIn)
            const _componentsIn = Object.entries(allAddrs).filter(([symbol, address]) => _componentAddrsInSet.has(address)).map(([symbol, _]) => symbol);
            const _newPortfolio = await getInstance(CONTRACTS.ORACLE).methods.getAllNextComponentSymbols().call()
            const _itins = await getInstance(CONTRACTS.ORACLE).methods.getComponentITINs().call()

            setComponentsOut(_componentsOut);
            setComponentsIn(_componentsIn);
            setComponentAddrsIn(_componentAddrsIn);
            setNewPortfolio(_newPortfolio);
            setItins(_itins);
        }
        if (updateTime.getTime() > 0)
            queryOracleData()
    }, [updateTime])



    function renderComponentsOut() {
        return componentsOut && componentsOut.map((symbol, i) => (
                <List.Item key={i}>
                    <Image avatar src={`../images/${symbol}.png`}/>
                    <List.Content>
                        <List.Header as='a'>{symbol}</List.Header>
                    </List.Content>
                </List.Item>
            )
        )
    }

    function renderComponentsIn() {
        return componentsIn && componentsIn.map((symbol, i) => (
                <List.Item key={i}>
                    <Image avatar src={`../images/${symbol}.png`} />
                    <List.Content>
                        <List.Header as='a'>{symbol}</List.Header>
                        {componentAddrsIn.length > 0 &&
                        <ListDescription>
                            <Header as='h5'>{componentAddrsIn[i]}</Header>
                        </ListDescription>}
                        {itins.length > 0 &&
                        <ListDescription>
                            ITIN: <b as='h5'>{itins[i]}</b>
                        </ListDescription>}
                    </List.Content>
                </List.Item>
            )
        )
    }

    function renderNewPortfolio() {
        return newPortfolio && newPortfolio.map((symbol, i) => (
                <List.Item key={i}>
                    <Image avatar src={`../images/${symbol}.png`}/>
                    <List.Content>
                        <List.Header as='a'>{newPortfolio[i]}</List.Header>
                    </List.Content>
                </List.Item>
            )
        )
    }

    return (
        <Fragment>
            <Form.Field inline>
                <label>To be Replaced:</label>
                <List horizontal>
                    {renderComponentsOut()}
                </List>
            </Form.Field>

            <Form.Field>
                <label>New:</label>
                <List>
                    {renderComponentsIn()}
                </List>
            </Form.Field>

            <Form.Field inline>
                <label>Upcoming Portfolio:</label>
                <List horizontal>
                    {renderNewPortfolio()}
                </List>
            </Form.Field>
        </Fragment>
    )
})

export default AnnouncementBoardUpdateDetails;
