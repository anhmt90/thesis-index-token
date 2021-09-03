import {useState} from "react";
import {
    Button,
    ButtonGroup,
    Container,
    Form,
    FormButton,
    FormField,
    Header,
    Icon, Image,
    Item, List,
    Segment
} from "semantic-ui-react";
import AmountInput from "../investor/AmountInput";
import AnnouncementBox from "./AnnouncementBox";


const AdminPanel = () => {

    const [isUpdatePanel, setIsUpdatePanel] = useState(true);
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
                        <Button
                            content='Auto-select new portfolio'
                        />
                    </Form.Field>
                    <Form.Field>
                        <label>To be replaced components:</label>
                        <List>
                            <List.Header>

                            </List.Header>
                        </List>
                    </Form.Field>

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

