import {Form, FormField, Header, Icon, Image, Label, List, ListDescription, Segment} from "semantic-ui-react";
import {Fragment, useCallback, useContext, useEffect, useRef, useState} from "react";
import AppContext, {PageContext, AnnouncementBoardContext} from "../context";
import {CONTRACTS, getInstance} from "../utils/getContract";
import {isAnnounceAvailable} from "../utils/validate";

import allAddrs from '../data/contractAddresses.json'
import AnnouncementBoardUpdateDetails from "./AnnouncementBoardUpdateDetails";


const AnnouncementBoard = ({isPortfolioUpdate}) => {

    const {web3, account} = useContext(AppContext)


    const [announcement, setAnnouncement] = useState('')
    const [updateTime, setUpdateTime] = useState(new Date(0))
    const [rebalancingTime, setRebalancingTime] = useState(new Date(0))
    const [latestBlockTime, setLatestBlockTime] = useState(0)

    const updateBoardRef = useRef(null);
    const rebalancingBoardRef = useRef(null);

    const queryTime = useCallback(async () => {
        const _time = await getInstance(CONTRACTS.INDEX_FUND).methods.timelock(isPortfolioUpdate ? '0' : '1').call();
        isPortfolioUpdate ? setUpdateTime(new Date(parseInt(_time) * 1000)) : setRebalancingTime(new Date(parseInt(_time) * 1000))
        console.log('_time', _time)
        console.log('isPortfolioUpdate', isPortfolioUpdate)
    }, [isPortfolioUpdate])

    useEffect(() => {
        queryTime()
    }, [queryTime])

    useEffect(() => {
        const queryLatestBlockTime = async () => {
            const _latestBlockTime = (await web3.eth.getBlock('latest')).timestamp
            console.log('_latestBlockTime', _latestBlockTime)
            setLatestBlockTime(parseInt(_latestBlockTime) * 1000)
        }
        queryLatestBlockTime()
    }, [web3.eth])

    useEffect(() => {
        const queryOracleData = async () => {
            const _announcement = isPortfolioUpdate ?
                await getInstance(CONTRACTS.ORACLE).methods.updateAnnouncement().call()
                : await getInstance(CONTRACTS.ORACLE).methods.rebalancingAnnouncement().call()

            setAnnouncement(_announcement);
        }
        if (isAnnounceAvailable(isPortfolioUpdate, updateTime, rebalancingTime))
            queryOracleData()
    }, [isPortfolioUpdate, rebalancingTime, updateTime])

    const handleCommitRebalancing = () => {
        console.log("INSIDE handleCommitRebalancing")
    }

    const handleCommit = (e) => {
        if (isPortfolioUpdate) {
            updateBoardRef.current.handleCommitUpdate(e);
        } else {
            handleCommitRebalancing();
        }

    }

    return (
        <AnnouncementBoardContext.Provider value={{
            queryTime,
            updateTime, latestBlockTime,
        }}>
            {
                isAnnounceAvailable(isPortfolioUpdate, updateTime, rebalancingTime) &&
                <Segment padded color={isPortfolioUpdate ? 'blue' : 'orange'} style={{paddingBottom: '60px'}}>
                    <Header as='h3'>
                        <Icon name='announcement'/>
                        {isPortfolioUpdate ? 'Update' : 'Rebalancing'} Announcement
                    </Header>
                    <Form>
                        <Form.Field>
                            <Segment textAlign='center'
                                     style={{boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1), 0 1px 10px 0 rgba(0, 0, 0, 0.1)'}}>
                                <Header as='h3'>
                                    {announcement}
                                </Header>
                                <br/>
                                <Header as={'h5'}>
                                    Next portfolio
                                    {isPortfolioUpdate ? ' update: ' : ' rebalancing: '}
                                    <span style={{color: '#F5B041'}}>
                                        {isPortfolioUpdate ? updateTime.toString() : rebalancingTime.toString()}
                                    </span>
                                </Header>
                            </Segment>
                        </Form.Field>
                        {isPortfolioUpdate && <AnnouncementBoardUpdateDetails ref={updateBoardRef}/>}

                        {latestBlockTime > 0 &&
                        <Form.Field inline>
                            <Form.Button
                                compact
                                disabled={isPortfolioUpdate ? latestBlockTime < updateTime.getTime() : latestBlockTime < rebalancingTime.getTime()}
                                color='teal'
                                floated='right'
                                onClick={handleCommit}
                            >
                                Commit {isPortfolioUpdate ? 'Update' : 'Rebalancing'}
                            </Form.Button>
                        </Form.Field>
                        }

                    </Form>

                </Segment>
            }
        </AnnouncementBoardContext.Provider>
    )
}

export default AnnouncementBoard;