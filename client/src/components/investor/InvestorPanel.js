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
        <Segment raised>
            <Container style={{width: '50%', marginBottom: '20px'}}>
                <ButtonGroup fluid>
                    <Button color={isBuy && 'purple'}>Purchase</Button>
                    <Button color={!isBuy && 'purple'}>Redeem</Button>
                </ButtonGroup>
            </Container>

            <Form onSubmit={handleSubmit}>
                <FormField>
                    <Input
                        value={capital}
                        // label={{ content: label, color: 'purple', basic: 'true' }}
                        placeholder='Investment Capital'
                        onChange={e => {handleChange(e.target.value);}}
                        type='number'
                        size='large'
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
                <Grid divided>
                    <GridRow>
                        <GridColumn width={11}>
                            <Header as='h4'>
                                <List horizontal>
                                    <ListItem>
                                        <Header as='h4' content='Front-running Prevention'/>
                                    </ListItem>
                                    <ListItem>
                                        <Checkbox toggle label='&nbsp;' />
                                    </ListItem>
                                </List>
                            </Header>
                            <FormField>
                                <Input
                                    type={'number'}
                                    label={{ basic: true, content: '%' }}
                                    labelPosition='right'
                                    placeholder='Enter percentage...'
                                />
                            </FormField>

                            <List horizontal relaxed>
                                {displayMinAmountsOut()}
                            </List>
                        </GridColumn>
                        <GridColumn width={5}>
                            <FormField>
                                <Header as='h4'>
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
                                style={{width: '75%', margin: '0 auto'}}
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