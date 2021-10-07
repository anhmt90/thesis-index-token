import {useContext} from "react";
import {FormField, Header, Icon, Image, TextArea} from "semantic-ui-react";
import {PageContext, AdminPanelContext} from "../../context";


const AnnouncementBox = ({isUpdatePanel}) => {

    const {
        announcement, setAnnouncement
    } = useContext(AdminPanelContext)

    const innerLabel = {
        basic: true,
        image: <Image size='mini' src={`../images/${isUpdatePanel ? 'Ethereum.png' : 'DFAM.jpg'}`}/>,
        style: {
            borderRight: 'none',
        }
    }

    return (
        <FormField>
            <Header as='h4'>
                <Icon name='announcement'/>
                Announcement
            </Header>
            <TextArea
                value={announcement}
                placeholder='Write a message to announce to the stakeholders about the changes to the portfolio...'
                onChange={e => {
                    setAnnouncement(e.target.value);
                }}
                rows={3}
            />
        </FormField>
    )
}

export default AnnouncementBox;