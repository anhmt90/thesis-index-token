import {useContext, useEffect, useRef, useState} from "react";
import {
    Button,
    ButtonGroup,
    Container,
    Form, FormButton,
    FormCheckbox,
    FormField, Header, Icon,
    Image,
    Input,
    Label, List, ListIcon,
    Segment
} from "semantic-ui-react";
import AppContext from "../../context";
import {CONTRACTS, getInstance} from "../../utils/getContract";
import {queryAllComponentAmountsOut} from "../../utils/queryAmountsOut";


const InvestorPanel = () => {
    const {web3, account, isWalletDetected} = useContext(AppContext);

    const [isBuy, setIsBuy] = useState(true);
    const [capital, setCapital] = useState(null);
    const [isValidInput, setIsValidInput] = useState(true);
    const [minAmountsOut, setMinAmountsOut] = useState([]);

    const indexFundContract = useRef(getInstance(CONTRACTS.INDEX_FUND));
    const dfamContract = useRef(getInstance(CONTRACTS.INDEX_TOKEN));

    const [portfolioSymbols, setPortfolioSymbols] = useState([]);

    useEffect(() => {
        const fetchPortfolio = async () => {
            const symbols = await indexFundContract.current.methods.getComponentSymbols().call();
            if (symbols) {
                setPortfolioSymbols(symbols);
            }
        }
        fetchPortfolio();
    }, [])


    const handleSubmit = () => {
        indexFundContract.current.methods.buy([]).send({
            from: account,
            value: capital,
            gas: '3000000'
        })
    }

    const handleChange = (_capital) => {
        setCapital(_capital)
    }

    function displayMinAmountsOut() {

        return portfolioSymbols.map(symbol => (
            <List.Item>
                <Image avatar src='https://react.semantic-ui.com/images/avatar/small/daniel.jpg'/>
                <List.Content>
                    <List.Header as='a'>{symbol}</List.Header>
                </List.Content>
            </List.Item>

        ))

    }

    return (
        <Segment>
            <Container style={{width: '50%', marginBottom: '20px'}}>
                <ButtonGroup fluid>
                    <Button color={isBuy && 'purple'}>Buy</Button>
                    <Button color={!isBuy && 'purple'}>Redeem</Button>
                </ButtonGroup>
            </Container>
            <Container>
                <Form onSubmit={handleSubmit}>
                    <FormField>
                        <Input
                            value={capital}
                            // label={{ content: label, color: 'purple', basic: 'true' }}
                            placeholder='Investment Capital'
                            onChange={e => {
                                handleChange(e.target.value);
                            }}
                            size='large'
                            type='number'
                            iconPosition='left'
                            icon='ethereum'

                            // actionPosition='right'
                            // action={{
                            //     color: 'purple',
                            //     icon: 'arrow right',
                            //     size: 'big'
                            // }}
                        />
                    </FormField>
                    <FormField>
                        <FormCheckbox toggle label='Activate Front-running Prevention'/>
                        <List horizontal relaxed>
                            {displayMinAmountsOut()}
                        </List>
                    </FormField>
                    <FormField>
                        <Segment padded style={{width: '50%', margin: '0 auto'}}>
                            <Header as='h3'>
                                {/*<Icon name='calculator' />*/}
                                Estimation
                            </Header>
                            <List relaxed>
                                <List.Item>
                                    {/*<Image avatar src='../images/DFAM.jpg' size='mini'/>*/}
                                    <Image avatar src='../images/DFAM.jpg'/>
                                    <List.Content verticalAlign='middle'>
                                        <Label basic circular color='green' size='large'>
                                            {999} DFAM
                                        </Label>
                                    </List.Content>
                                </List.Item>
                                <List.Item>
                                    {/*<Image avatar src='https://react.semantic-ui.com/images/avatar/small/stevie.jpg' />*/}
                                    <ListIcon name='gripfire' size='big' color='blue' />
                                    <List.Content verticalAlign='middle'>
                                        <Label basic circular color='blue' size='large'>
                                            {3000000} Gas used
                                        </Label>
                                    </List.Content>
                                </List.Item>
                            </List>
                        </Segment>
                    </FormField>

                    <FormField style={{width: '75%', margin: '0 auto'}}>
                        <FormButton primary style={{width: '100%', margin: '0 auto'}}>
                            Buy
                            <Icon name='right arrow' />
                        </FormButton>
                    </FormField>
                </Form>
            </Container>
        </Segment>
    )
}

export default InvestorPanel;