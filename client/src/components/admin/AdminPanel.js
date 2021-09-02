import {useState} from "react";
import {Button, ButtonGroup, Container, Header, Segment} from "semantic-ui-react";


const AdminPanel = () => {

    const [isUpdatePanel, setIsUpdatePanel] = useState(true);


    return (
        <Container style={{boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'}}>
            <ButtonGroup fluid attached='top'>
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
            </ButtonGroup>
            <Segment padded attached raised color='teal'>
                <Header as='h1' content='This is Admin Panel' />
            </Segment>
        </Container>
    )
}

export default AdminPanel;

