import {Fragment} from "react";
import {FormField, Header, Icon, Image, Input} from "semantic-ui-react";
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
        image: <Image size='mini' src={`../images/${isUpdatePanel? 'Ethereum.png' : 'DFAM.jpg'}`}/>,
        style: {
            borderRight: 'none',
        }
    }

    const renderAmountInputLabel = () => {
        return (
            <Header as='h4'>
                {isUpdatePanel ?
                    <Fragment>
                        <Icon name='money bill alternate outline'/>
                        Investment Capital
                    </Fragment>
                    :
                    <Fragment>
                        {/*<Image size='mini' src='../images/DFAM.jpg'/>*/}
                        {/*<span style={{verticalAlign: 'sub'}}>*/}
                        {/*    &nbsp; DFAM Amount*/}
                        {/*</span>*/}
                        <Icon name='money bill alternate outline'/>
                        DFAM Amount
                    </Fragment>
                }
            </Header>
        )
    }

    return (
        <FormField>
            {renderAmountInputLabel()}
            {isUpdatePanel ?
                <Input
                    value={announcement === '0' ? '' : announcement}
                    placeholder='0.00'
                    onChange={e => {
                        handleChangeAnnouncement(e.target.value);
                    }}
                    type='number'
                    step={parseInt(supply) === 0 ? '0.001' : 'any'}
                    min={0}
                    max={parseInt(supply) === 0 ? 0.01 : parseFloat(tokenUnits2Float(ethBalance))}
                    size='huge'

                    labelPosition='left'
                    label={innerLabel}

                />
                :
                <Input
                    value={announcement === '0' ? '' : announcement}
                    placeholder='0.00'
                    onChange={e => {
                        handleChangeAnnouncement(e.target.value);
                    }}
                    type='number'
                    step='any'
                    min={0}
                    max={parseFloat(tokenUnits2Float(indexBalance))}
                    size='huge'
                    labelPosition='left'
                    label={innerLabel}

                />
            }
        </FormField>
    )
}

export default AmountInput;