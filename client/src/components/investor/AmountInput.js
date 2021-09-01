import {Fragment} from "react";
import {FormField, Header, Icon, Image, Input} from "semantic-ui-react";
import {tokenUnits2Float} from "../../utils/conversions";
import AppContext from "../../context";
import {useContext} from "react";


const AmountInput = ({isInvestPanel, capital, handleChangeCapital}) => {

    const {
        ethBalance, setEthBalance,
        supply, setSupply,
        indexBalance, setIndexPrice,
    } = useContext(AppContext);

    const innerLabel = {
        basic: true,
        image: <Image size='mini' src={`../images/${isInvestPanel? 'Ethereum.png' : 'DFAM.jpg'}`}/>,
        style: {
            borderRight: 'none',
            paddingRight: '0'
        }
    }

    const renderAmountInputLabel = () => {
        return (
            <Header as='h4'>
                {isInvestPanel ?
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
            {isInvestPanel ?
                <Input
                    value={capital === '0' ? null : capital}
                    placeholder='0.00'
                    onChange={e => {
                        handleChangeCapital(e.target.value);
                    }}
                    type='number'
                    step={parseInt(supply) === 0 ? '0.001' : 'any'}
                    min={0}
                    max={parseInt(supply) === 0 ? 0.01 : parseFloat(tokenUnits2Float(ethBalance))}
                    size='large'

                    labelPosition='left'
                    label={innerLabel}

                />
                :
                <Input
                    value={capital === '0' ? null : capital}
                    placeholder='0.00'
                    onChange={e => {
                        handleChangeCapital(e.target.value);
                    }}
                    type='number'
                    step={parseInt(supply) === 0 ? '0.001' : 'any'}
                    min={0}
                    max={parseInt(supply) === 0 ? 0.01 : parseFloat(tokenUnits2Float(ethBalance))}
                    size='large'

                    labelPosition='left'
                    label={innerLabel}

                />
            }
        </FormField>
    )
}

export default AmountInput;