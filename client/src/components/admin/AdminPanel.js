import {useContext, useEffect, useState} from "react";
import {Button, Container, Form, Header, Icon, Image, List, Segment} from "semantic-ui-react";
import AnnouncementBox from "./AnnouncementBox";
import ReplacementTable from "./ReplacementTable";
import {CONTRACTS, getAddress, getInstance} from "../../utils/getContract";
import AppContext, {PageContext, AdminPanelContext} from "../../context";
import {updateReserves} from "../../utils/simulateUniswap";
import Web3 from "web3";
import {toWei} from "../../getWeb3";


const AdminPanel = () => {

    const {account, portfolio} = useContext(AppContext)

    // const {
    //     newPortfolio, setNewPortfolio,
    //     componentsOut, setComponentsOut,
    //     componentsIn, setComponentsIn,
    //     itins, setItins,
    //     announcement, setAnnouncement
    // } = useContext(PageContext)


    const [symbolInputs, setSymbolInputs] = useState([])
    const [addressInputs, setAddressInputs] = useState([])
    const [itinInputs, setItinInputs] = useState([])
    const [announcement, setAnnouncement] = useState([])

    const [isUpdatePanel, setIsUpdatePanel] = useState(true);


    const validateInputs = () => {
        if (symbolInputs.length !== addressInputs.length) {
            console.log(`symbolInputs.length = ${symbolInputs.length}, while addressInputs.length = ${addressInputs.length}`);
            return false;
        }

        if (symbolInputs.length !== itinInputs.length) {
            console.log(`symbolInputs.length = ${symbolInputs.length}, while itinInputs.length = ${itinInputs.length}`);
            return false;
        }

        for (let i = 0; i < symbolInputs.length; i++) {
            if ((symbolInputs[i] && addressInputs[i] && itinInputs[i]) || (!symbolInputs[i] && !addressInputs[i] && !itinInputs[i])) {
                continue;
            } else {
                console.log("Invalid inputs!");
                return false;
            }
        }
        return true;
    }

    const handleAnnounceUpdate = async () => {
        try {
            if (validateInputs()) {
                let _componentsOut = []
                let _componentAddrsIn = []
                let _newPortfolio = []
                let _itins = []

                for (let i = 0; i < symbolInputs.length; i++) {
                    const symbol = symbolInputs[i];
                    if (symbol) {
                        _componentsOut.push(portfolio[i]);
                        _componentAddrsIn.push(addressInputs[i]);
                        _itins.push(itinInputs[i]);
                        _newPortfolio.push(symbol);
                    } else {
                        _newPortfolio.push(portfolio[i])
                    }
                }

                const isUpdateReady = () => {
                    return _componentsOut && _componentAddrsIn && _itins && _newPortfolio
                        && _componentsOut.length > 0
                        && _componentsOut.length === _componentAddrsIn.length
                        && _componentsOut.length === _itins.length
                        && _newPortfolio.length === portfolio.length
                }

                if (isUpdateReady()) {
                    console.log('componentsOut', _componentsOut)
                    console.log('_componentAddrsIn', _componentAddrsIn)
                    console.log('newPortfolio', _newPortfolio)
                    console.log('itins', _itins)
                    console.log('announcement', announcement)

                    await getInstance(CONTRACTS.ORACLE).methods.announceUpdate(
                        _componentsOut, _componentAddrsIn, _newPortfolio, _itins, announcement).send({
                        from: account,
                        gas: '3000000'
                    })

                } else {
                    throw new Error('Update not ready yet')
                }
            }
        } catch (e) {
            console.log(e)
        }
    }

    const handleAnnounceRebalancing = async () => {
        await getInstance(CONTRACTS.ORACLE).methods.announceRebalancing(announcement).send({
            from: account,
            gas: '3000000'
        })
    }

    function handleClickUpdateTab() {
        if (!isUpdatePanel) {
            setIsUpdatePanel(true)
        }
    }

    function handleClickRedeemTab() {
        if (isUpdatePanel) {
            setIsUpdatePanel(false)
        }
    }

    return (
        <AdminPanelContext.Provider value={{
            symbolInputs, setSymbolInputs,
            addressInputs, setAddressInputs,
            itinInputs, setItinInputs,
            announcement, setAnnouncement
        }}>
            <Container style={{boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'}}>
                <Button.Group fluid attached='top'>
                    <Button
                        color={isUpdatePanel && 'teal'}
                        content='Update'
                        onClick={handleClickUpdateTab}
                    />
                    <Button
                        color={!isUpdatePanel && 'teal'}
                        content='Rebalance'
                        onClick={handleClickRedeemTab}
                    />
                </Button.Group>
                <Segment padded attached raised color='teal'>
                    <Form>
                        {isUpdatePanel &&
                            <Form.Field>
                                <Header as='h4' content='Suggested Replacements'/>
                                <ReplacementTable/>
                            </Form.Field>
                        }
                        <AnnouncementBox
                            isUpdatePanel={isUpdatePanel}
                        />
                        <Form.Field style={{textAlign: 'center'}}>
                            <Form.Button
                                onClick={isUpdatePanel ? handleAnnounceUpdate : handleAnnounceRebalancing}
                                // disabled={!announcement}
                                color='teal'
                                style={{width: '50%', margin: '1% auto'}}
                            >
                                Announce
                                <Icon name='arrow circle right'/>
                            </Form.Button>
                        </Form.Field>
                    </Form>
                </Segment>
            </Container>
        </AdminPanelContext.Provider>
    )
}

export default AdminPanel;

