import {useContext, useState} from "react";
import {Button, Container, Form, Header, Icon, Segment} from "semantic-ui-react";
import AnnouncementBox from "./AnnouncementBox";
import ReplacementTable from "./ReplacementTable";
import {CONTRACTS, getAddress, getInstance} from "../../utils/getContract";
import AppContext, {PageContext} from "../../context";


const AdminPanel = () => {

    const { account, portfolio } = useContext(AppContext)

    const {
        newPortfolio, setNewPortfolio,
        componentsOut, setComponentsOut,
        componentsIn, setComponentsIn,
        itins, setItins,
        announcement, setAnnouncement
    } = useContext(PageContext)

    const [isUpdatePanel, setIsUpdatePanel] = useState(true);


    const isUpdateReady = () => {
        return componentsOut && componentsIn && itins && newPortfolio
            && componentsOut.length > 0
            && componentsOut.length === componentsIn.length
            && componentsOut.length === itins.length
            && newPortfolio.length === portfolio.length
    }

    const handleSubmit = async () => {

        if(isUpdateReady()) {
            const _componentAddrsIn = componentsIn.map(symbol => getAddress(CONTRACTS[symbol]))
            console.log('componentsOut', componentsOut)
            console.log('_componentAddrsIn', _componentAddrsIn)
            console.log('newPortfolio', newPortfolio)
            console.log('itins', itins)
            console.log('announcement', announcement)

            await getInstance(CONTRACTS.ORACLE).methods.announceUpdate(
                componentsOut, _componentAddrsIn, newPortfolio, itins, announcement).send({
                from: account,
                gas: '3000000'
            })

        } else {
            throw new Error('Update not ready yet')
        }


    }

    return (
        <Container style={{boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'}}>
            <Button.Group fluid attached='top'>
                <Button
                    color={isUpdatePanel && 'teal'}
                    content='Update'
                    // onClick={handleClickInvestTab}
                />
                <Button
                    color={!isUpdatePanel && 'teal'}
                    content='Rebalance'
                    // onClick={handleClickRedeemTab}
                />
            </Button.Group>
            <Segment padded attached raised color='teal'>
                <Form>
                    <Form.Field>
                        <Header as='h4' content='Suggested Replacements'/>
                        <ReplacementTable />
                    </Form.Field>
                    {newPortfolio && newPortfolio.length > 0 &&
                        <Form.Group inline>
                            <Header as='h4' content='New Portfolio:&nbsp;'/>
                            {newPortfolio.join(', ')}
                        </Form.Group>
                    }
                    <AnnouncementBox
                        isUpdatePanel={isUpdatePanel}
                    />
                    <Form.Field  style={{ textAlign: 'center'}}>
                        <Form.Button
                            onClick={handleSubmit}
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
    )
}

export default AdminPanel;

