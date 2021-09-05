import {Form, FormField, Header, Icon, Image, Label, List, ListDescription, Segment} from "semantic-ui-react";
import {useContext, useEffect, useState} from "react";
import AppContext, {PageContext} from "../context";
import {CONTRACTS, getInstance} from "../utils/getContract";

import allAddrs from '../data/contractAddresses.json'


const AnnouncementBoard = () => {

    const [newPortfolio, setNewPortfolio] = useState([])
    const [componentsOut, setComponentsOut] = useState([])
    const [componentsIn, setComponentsIn] = useState([])
    const [componentAddrsIn, setComponentAddrsIn] = useState([])
    const [itins, setItins] = useState([])
    const [announcement, setAnnouncement] = useState('')

    useEffect(() => {
        const queryOracleData = async () => {
            const _componentsOut = await getInstance(CONTRACTS.ORACLE).methods.getComponentSymbolsOut().call()
            const _componentAddrsIn = await getInstance(CONTRACTS.ORACLE).methods.getComponentAddrsIn().call()
            const _componentAddrsInSet = new Set(_componentAddrsIn)
            const _componentsIn = Object.entries(allAddrs).filter(([symbol, address]) => _componentAddrsInSet.has(address)).map(([symbol, _]) => symbol);
            const _newPortfolio = await getInstance(CONTRACTS.ORACLE).methods.getAllNextComponentSymbols().call()
            const _itins = await getInstance(CONTRACTS.ORACLE).methods.getComponentITINs().call()
            const _announcement = await getInstance(CONTRACTS.ORACLE).methods.announcementMessage().call()
            console.log('_announcement', _announcement)

            setComponentsOut(_componentsOut);
            setComponentsIn(_componentsIn);
            setComponentAddrsIn(_componentAddrsIn);
            setNewPortfolio(_newPortfolio);
            setItins(_itins);
            setAnnouncement(_announcement);
        }
        queryOracleData()
    }, [])


    function renderComponentsOut() {
        return componentsOut && componentsOut.map((symbol, i) => (
                <List.Item key={i}>
                    <Image avatar src='../images/Ethereum.png'/>
                    <List.Content>
                        <List.Header>{symbol}</List.Header>
                        {componentsOut.length > 0 && <ListDescription>{componentsOut[i]}</ListDescription>}
                    </List.Content>
                </List.Item>
            )
        )
    }

    function renderComponentsIn() {
        return componentsIn && componentsIn.map((symbol, i) => (
                <List.Item key={i}>
                    <Image avatar src='../images/Ethereum.png'/>
                    <List.Content>
                        <List.Header>{symbol}</List.Header>
                        {componentAddrsIn.length > 0 && <ListDescription>{componentAddrsIn[i]}</ListDescription>}
                        {itins.length > 0 && <ListDescription>{itins[i]}</ListDescription>}
                    </List.Content>
                </List.Item>
            )
        )
    }

    function renderNewPortfolio() {
        return newPortfolio && newPortfolio.map((symbol, i) => (
                <List.Item key={i}>
                    <Image avatar src='../images/Ethereum.png'/>
                    <List.Content>
                        <List.Header>{newPortfolio[i]}</List.Header>
                    </List.Content>
                </List.Item>
            )
        )
    }

    return (
        <Segment padded>
            <Header as='h3'>
                <Icon name='announcement'/>
                Announcement
            </Header>
            <Form>
                <Form.Field>
                    <label>Message:</label>
                    <Segment textAlign='center' color='green'>
                        <Header as='h5'>
                            {announcement}
                        </Header>
                    </Segment>
                </Form.Field>
                <Form.Field inline>
                    <label>Replaced:</label>
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

            </Form>
        </Segment>
    )
}

export default AnnouncementBoard;