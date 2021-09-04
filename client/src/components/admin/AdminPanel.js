import {useState} from "react";
import {Button, Container, Form, Header, Icon, Rating, Segment, Table} from "semantic-ui-react";
import AnnouncementBox from "./AnnouncementBox";
import PerformanceTable from "./PerformanceTable";
import ReplacementTable from "./ReplacementTable";


const AdminPanel = () => {

    const [isUpdatePanel, setIsUpdatePanel] = useState(true);

    const [newPortfolio, setNewPortfolio] = useState([])
    const [announcement, setAnnouncement] = useState('')

    const handleChangeAnnouncement = (_announcement) => {
        setAnnouncement(_announcement);
    }

    const handleSubmit = () => {

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
                        <ReplacementTable
                            setNewPortfolio={setNewPortfolio}
                        />
                    </Form.Field>
                    {newPortfolio.length > 0 &&
                        <Form.Group inline>
                            <Header as='h4' content='New Portfolio:&nbsp;'/>
                            {newPortfolio.join(', ')}
                        </Form.Group>
                    }
                    <AnnouncementBox
                        isUpdatePanel={isUpdatePanel}
                        announcement={announcement}
                        handleChangeAnnouncement={handleChangeAnnouncement}
                    />
                    <Form.Button
                        onClick={handleSubmit}
                        disabled={!announcement}
                        color='teal'
                        style={{width: '50%', margin: '1% auto'}}
                    >
                        Announce
                        <Icon name='arrow circle right'/>
                    </Form.Button>
                </Form>
            </Segment>
        </Container>
    )
}

export default AdminPanel;

