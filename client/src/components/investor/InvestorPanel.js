import {Fragment, useContext, useEffect, useRef, useState} from "react";
import {
    Button,
    ButtonGroup,
    Checkbox,
    Form,
    FormButton,
    FormField,
    Grid,
    GridColumn,
    GridRow,
    Header,
    Icon,
    Image,
    Input,
    Label,
    List,
    ListDescription,
    ListIcon,
    ListItem,
    Segment
} from "semantic-ui-react";
import AppContext from "../../context";
import {CONTRACTS, getInstance} from "../../utils/getContract";
import {queryAllComponentAmountsOut} from "../../utils/queryAmountsOut";
import {estimateMintedDFAM} from "../../utils/estimations";
import {fromWei, toWei} from "../../getWeb3";


const InvestorPanel = () => {
    const { account, portfolio} = useContext(AppContext);

    const [isBuy, setIsBuy] = useState(true);
    const [capital, setCapital] = useState(null);
    const [estimationDFAM, setEstimationDFAM] = useState('0');
    const [minAmountsOut, setMinAmountsOut] = useState([]);

    const indexFundContract = useRef(getInstance(CONTRACTS.INDEX_FUND));
    const dfamContract = useRef(getInstance(CONTRACTS.INDEX_TOKEN));

    // const [portfolioSymbols, setPortfolioSymbols] = useState([]);

    // useEffect(() => {
    //     const fetchPortfolio = async () => {
    //         const symbols = await indexFundContract.current.methods.getComponentSymbols().call();
    //         if (symbols) {
    //             setPortfolioSymbols(symbols);
    //         }
    //     }
    //     fetchPortfolio();
    // }, [])

    useEffect(() => {
        const expectAmountsOut = async () => {
            if (capital && capital !== '0') {
                const amountsOut = await queryAllComponentAmountsOut(toWei(capital));
                setMinAmountsOut(amountsOut)
                console.log('amountsOut', amountsOut)
            }
        }
        expectAmountsOut();
    }, [capital])


    const handleSubmit = () => {
        if (capital) {
            indexFundContract.current.methods.buy([]).send({
                from: account,
                value: toWei(capital),
                gas: '3000000'
            })
        }
    }

    const handleChange = (_capital) => {
        setCapital(_capital)
        if(_capital && parseFloat(_capital) > 0.00) {
            estimateMintedDFAM(toWei(_capital)).then(estimation => {
                console.log('DFAM estimation: ', estimation)
                setEstimationDFAM(estimation)
            })
        } else {
            setEstimationDFAM('0')
        }

    }

    function displayMinAmountsOut() {
        const items = []
        for (let i = 0; i < portfolio.length; i++) {
            const item = (
                <List.Item key={i} style={{paddingLeft: '100px!important'}}>
                    <Image avatar src='https://react.semantic-ui.com/images/avatar/small/daniel.jpg'/>
                    <List.Content>
                        <List.Header>{portfolio[i]}</List.Header>
                        {minAmountsOut.length > 0 && <ListDescription>{minAmountsOut[i]}</ListDescription>}
                    </List.Content>
                </List.Item>
            )
            items.push(item);
        }
        return items;
    }

    return (
        <Fragment>
            <ButtonGroup fluid attached='top'>
                <Button color={isBuy && 'purple'}>Purchase</Button>
                <Button color={!isBuy && 'purple'}>Redeem</Button>
            </ButtonGroup>
            <Segment raised padded attached color='purple'>
                {/*<Container style={{width: '50%', marginBottom: '20px'}}>*/}
                {/*    <ButtonGroup fluid>*/}
                {/*        <Button color={isBuy && 'purple'}>Purchase</Button>*/}
                {/*        <Button color={!isBuy && 'purple'}>Redeem</Button>*/}
                {/*    </ButtonGroup>*/}
                {/*</Container>*/}

                <Form style={{marginTop: '5%'}}>
                    <FormField>
                        <Header as='h4'>
                            <Icon name='money bill alternate outline'/>
                            Investment Capital
                        </Header>
                        <Input
                            value={capital}
                            placeholder='0.00'
                            onChange={e => {
                                handleChange(e.target.value);
                            }}
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
                            <GridColumn width={10} style={{paddingRight: '30px'}}>
                                <Header as='h4'>
                                    <List horizontal>
                                        <ListItem>
                                            <Header as='h4'>
                                                <Icon name='shield'/>
                                                Front-running Prevention
                                            </Header>
                                        </ListItem>
                                        <ListItem>
                                            <Checkbox toggle label='&nbsp;'/>
                                        </ListItem>
                                    </List>
                                </Header>
                                <FormField>
                                    <Input
                                        type='number'
                                        label={{basic: true, content: '%'}}
                                        labelPosition='right'
                                        placeholder='Enter percentage...'
                                        style={{width: '35%'}}
                                    />
                                </FormField>

                                <List horizontal relaxed>
                                    {displayMinAmountsOut()}
                                </List>
                            </GridColumn>
                            <GridColumn width={6} style={{paddingLeft: '30px'}}>
                                <FormField>
                                    <Header as='h4'>
                                        <Icon name='calculator'/>
                                        Estimations
                                    </Header>
                                    <List style={{paddingLeft: '15%'}}>
                                        <List.Item>
                                            <Image avatar src='../images/DFAM.jpg'/>
                                            <List.Content verticalAlign='middle'>
                                                <Label basic circular color='green' size='large'>
                                                    {fromWei(estimationDFAM)}
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
                                    style={{width: '50%', margin: '5% auto'}}
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
        </Fragment>
    )
}

export default InvestorPanel;