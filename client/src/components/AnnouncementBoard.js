import {Form, FormField, Header, Icon, Image, Label, List, ListDescription, Segment} from "semantic-ui-react";
import {useContext, useEffect, useState} from "react";
import AppContext, {PageContext} from "../context";
import {CONTRACTS, getInstance} from "../utils/getContract";

import allAddrs from '../data/contractAddresses.json'


const AnnouncementBoard = () => {

    const {web3} = useContext(AppContext)

    const [newPortfolio, setNewPortfolio] = useState([])
    const [componentsOut, setComponentsOut] = useState([])
    const [componentsIn, setComponentsIn] = useState([])
    const [componentAddrsIn, setComponentAddrsIn] = useState([])
    const [itins, setItins] = useState([])
    const [announcement, setAnnouncement] = useState('')
    const [updateTime, setUpdateTime] = useState(new Date(0))
    const [rebalancingTime, setRebalancingTime] = useState('')
    const [latestBlockTime, setLatestBlockTime] = useState(0)

    useEffect(() => {
        const queryOracleData = async () => {
            const _updateTime = await getInstance(CONTRACTS.INDEX_FUND).methods.timelock('0').call();
            setUpdateTime(new Date(parseInt(_updateTime) * 1000))
            console.log('_updateTime', _updateTime)


            const _componentsOut = await getInstance(CONTRACTS.ORACLE).methods.getComponentSymbolsOut().call()
            const _componentAddrsIn = await getInstance(CONTRACTS.ORACLE).methods.getComponentAddrsIn().call()
            const _componentAddrsInSet = new Set(_componentAddrsIn)
            const _componentsIn = Object.entries(allAddrs).filter(([symbol, address]) => _componentAddrsInSet.has(address)).map(([symbol, _]) => symbol);
            const _newPortfolio = await getInstance(CONTRACTS.ORACLE).methods.getAllNextComponentSymbols().call()
            const _itins = await getInstance(CONTRACTS.ORACLE).methods.getComponentITINs().call()
            const _announcement = await getInstance(CONTRACTS.ORACLE).methods.updateAnnouncement().call()
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
    
    useEffect(() => {
        const queryLatestBlockTime = async () => {
            const _latestBlockTime = (await web3.eth.getBlock('latest')).timestamp
            console.log('_latestBlockTime', _latestBlockTime)
            setLatestBlockTime(parseInt(_latestBlockTime) * 1000)
        }
        queryLatestBlockTime()
    }, [web3.eth])



    const handleCommitUpdate = () => {

    }

    function renderComponentsOut() {
        return componentsOut && componentsOut.map((symbol, i) => (
                <List.Item key={i}>
                    <Image avatar src='../images/Ethereum.png'/>
                    <List.Content>
                        <List.Header>{symbol}</List.Header>
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
                        {componentAddrsIn.length > 0 &&
                        <ListDescription>
                            <Header as='h5'>{componentAddrsIn[i]}</Header>
                        </ListDescription>}
                        {itins.length > 0 &&
                        <ListDescription>
                            <Header as='h5'>{itins[i]}</Header>
                        </ListDescription>}
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
        <Segment padded style={{paddingBottom: '60px'}}>
            <Header as='h3'>
                <Icon name='announcement'/>
                Announcement
            </Header>
            {
                updateTime && updateTime.getTime() > 0 &&
                <Form>
                    <Form.Field>
                        <label>Message:</label>
                        <Segment textAlign='center' color='green'>
                            <Header as='h5'>
                                {announcement}
                            </Header>
                            <Header as='h5'>
                                Next portfolio update: {updateTime.toString()}
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

                    { latestBlockTime > 0 && latestBlockTime > updateTime.getTime() &&
                        <Form.Field inline>
                            <Form.Button
                                compact
                                color='teal'
                                floated='right'
                                onClick={handleCommitUpdate}
                            >
                                Commit Update
                            </Form.Button>
                        </Form.Field>
                    }

                </Form>
            }

        </Segment>
    )
}

export default AnnouncementBoard;