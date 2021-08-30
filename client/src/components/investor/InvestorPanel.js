import {useContext, useEffect, useRef, useState} from "react";
import {
    Button,
    ButtonGroup, Checkbox,
    Container, Divider,
    Form, FormButton,
    FormCheckbox,
    FormField, FormInput, Grid, GridColumn, GridRow, Header, Icon,
    Image,
    Input,
    Label, List, ListIcon, ListItem,
    Segment, SegmentGroup
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
        if(capital) {
            indexFundContract.current.methods.buy([]).send({
                from: account,
                value: web3.utils.toWei(capital),
                gas: '3000000'
            })
        }
    }

    const handleChange = (_capital) => {
        setCapital(_capital)
    }

    function displayMinAmountsOut() {

        return portfolioSymbols.map(symbol => (
            <List.Item key={symbol}>
                <Image avatar src='https://react.semantic-ui.com/images/avatar/small/daniel.jpg'/>
                <List.Content>
                    <List.Header as='a'>{symbol}</List.Header>
                </List.Content>
            </List.Item>

        ))
    }

    return (
        <Segment raised padded>
            <Container style={{width: '50%', marginBottom: '20px'}}>
                <ButtonGroup fluid>
                    <Button color={isBuy && 'purple'}>Purchase</Button>
                    <Button color={!isBuy && 'purple'}>Redeem</Button>
                </ButtonGroup>
            </Container>

            <Form style={{marginTop: '5%'}}>
                <FormField>
                    <Header as='h4'>
                        <Icon name='money bill alternate outline' />
                        Investment Capital
                    </Header>
                    <Input
                        value={capital}
                        placeholder='0.00'
                        onChange={e => {handleChange(e.target.value);}}
                        type='number'
                        step='any'
                        size='large'
                        iconPosition='left'
                        icon='ethereum'

                        // labelPosition='left'
                        // label={{
                        //     basic: true,
                        //     icon: 'ethereum',
                        //     iconPosition: 'right',
                        //     content: 'Investment Capital',
                        // }}
                    />
                </FormField>

                <Grid divided style={{marginTop: '5%'}}>
                    <GridRow>
                        <GridColumn width={11}>
                            <Header as='h4'>
                                <List horizontal>
                                    <ListItem>
                                        <Header as='h4'>
                                            <Icon name='shield' />
                                            Front-running Prevention
                                        </Header>
                                    </ListItem>
                                    <ListItem>
                                        <Checkbox toggle label='&nbsp;' />
                                    </ListItem>
                                </List>
                            </Header>
                            <FormField>
                                <Input
                                    type='number'
                                    label={{ basic: true, content: '%' }}
                                    labelPosition='right'
                                    placeholder='Enter percentage...'
                                    style={{width: '35%'}}
                                />
                            </FormField>

                            <List horizontal relaxed>
                                {displayMinAmountsOut()}
                            </List>
                        </GridColumn>
                        <GridColumn width={5}>
                            <FormField>
                                <Header as='h4'>
                                    <Icon name='calculator' />
                                    Estimations
                                </Header>
                                <List style={{paddingLeft: '15%'}}>
                                    <List.Item>
                                        <Image avatar src='../images/DFAM.jpg'/>
                                        <List.Content verticalAlign='middle'>
                                            <Label basic circular color='green' size='large'>
                                                {999} DFAM
                                            </Label>
                                        </List.Content>
                                    </List.Item>
                                    <List.Item>
                                        {/*<Image avatar src='https://react.semantic-ui.com/images/avatar/small/stevie.jpg' />*/}
                                        <ListIcon name='gripfire' size='big' color='blue'/>
                                        <List.Content verticalAlign='middle'>
                                            <Label basic circular color='blue' size='large'>
                                                {3000000} Gas used
                                            </Label>
                                        </List.Content>
                                    </List.Item>
                                </List>
                            </FormField>
                        </GridColumn>
                    </GridRow>
                    <GridRow>
                        <GridColumn textAlign='center'>
                            <FormButton
                                color='purple'
                                style={{width: '75%', margin: '5% auto'}}
                                onClick={handleSubmit}
                            >
                                Buy
                                <Icon name='right arrow'/>
                            </FormButton>
                        </GridColumn>
                    </GridRow>
                </Grid>


            </Form>
        </Segment>
    )
}

export default InvestorPanel;