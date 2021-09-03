import {Fragment} from "react";
import {FormField, Header, Icon, Image, Input, TextArea} from "semantic-ui-react";
import {tokenUnits2Float} from "../../utils/conversions";
import AppContext from "../../context";
import {useContext} from "react";


const AmountInput = ({isUpdatePanel, announcement, handleChangeAnnouncement}) => {

    const {
        ethBalance, setEthBalance,
        supply, setSupply,
        indexBalance, setIndexPrice,
    } = useContext(AppContext);

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
                value={announcement === '0' ? '' : announcement}
                placeholder='Write a message to announce to the stakeholders about the changes to the portfolio...'
                onChange={e => {
                    handleChangeAnnouncement(e.target.value);
                }}
                rows={10}
            />
        </FormField>
    )
}

export default AmountInput;