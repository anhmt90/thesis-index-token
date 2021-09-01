import {Fragment, useCallback, useContext, useEffect, useRef, useState} from "react";
import {
    Button,
    ButtonGroup,
    Checkbox,
    Container,
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
    List, ListContent,
    ListDescription,
    ListHeader,
    ListIcon,
    ListItem,
    Segment
} from "semantic-ui-react";
import AppContext from "../../context";
import {CONTRACTS, getInstance} from "../../utils/getContract";
import {queryAllComponentAmountsOut} from "../../utils/queryAmountsOut";
import {estimateMintedDFAM, estimateTxCost} from "../../utils/estimations";
import {BN, fromWei, toWei} from "../../getWeb3";
import {calcFrontrunningPrevention} from "../../utils/common";
import {tokenUnits2Float} from "../../utils/conversions";
import AmountInput from "./AmountInput";


const InvestorPanel = () => {
    const {
        web3,
        account,
        portfolio,
        setIndexBalance,
        ethBalance, setEthBalance,
        supply, setSupply,
        indexBalance, setIndexPrice,
    } = useContext(AppContext);

    const [isInvestPanel, setIsInvestPanel] = useState(true);
    const [capital, setCapital] = useState('0');
    const [tolerance, setTolerance] = useState(5);
    const [estimationDFAM, setEstimationDFAM] = useState('0');
    const [estimationTxCost, setEstimationTxCost] = useState('0');
    const [minAmountsOut, setMinAmountsOut] = useState([]);
    const [isFRPActivated, setIsFRPActivated] = useState(true);

    const expectedAmountsOut = useRef([])

    const getTx = useCallback(() => {
        const _minAmountsOut = isFRPActivated && tolerance ? minAmountsOut : [];
        return getInstance(CONTRACTS.INDEX_FUND).methods.buy(_minAmountsOut);
    }, [isFRPActivated, minAmountsOut, tolerance])


    useEffect(() => {
        const estimateGas = async () => {
            if (capital && parseFloat(capital) > 0.00) {
                const _txCost = await estimateTxCost(getTx(), account, capital);
                console.log('_txCost', _txCost)
                setEstimationTxCost(_txCost);
            } else {
                setEstimationTxCost('0');
            }
        }
        estimateGas();
    }, [account, capital, getTx])


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (capital) {
            await getTx().send({
                from: account,
                value: toWei(capital.toString()),
                gas: '3000000'
            }).on('receipt', async (txReceipt) => {
                const costPaid = txReceipt.gasUsed * fromWei((await web3.eth.getGasPrice()), 'ether');
                console.log('costPaid', costPaid)

                const _indexBalance = await getInstance(CONTRACTS.INDEX_TOKEN).methods.balanceOf(account).call();
                const _ethBalance = await web3.eth.getBalance(account);
                const _supply = await getInstance(CONTRACTS.INDEX_TOKEN).methods.totalSupply().call();
                const _indexPrice = await getInstance(CONTRACTS.INDEX_FUND).methods.getIndexPrice().call();
                setIndexBalance(_indexBalance);
                setEthBalance(_ethBalance);
                setSupply(_supply);
                setIndexPrice(_indexPrice);

                // toast(positiveMsg({
                //     header: `Smart Contract successfully ${!initInputs? 'deployed' : 'updated'}`,
                //     msg: `TLS-endorsed Smart Contract ${!initInputs? 'deployed' : 'updated'} successully at address ${futureContractAddress}`
                // }));
            });
        }
    }

    const handleChangeCapital = (_capital) => {
        const maxCapital = parseFloat(tokenUnits2Float(ethBalance));
        if (parseInt(supply) === 0)
            _capital = _capital < 0 ? 0.00 : (_capital > 0.01 ? 0.01 : _capital)
        else
            _capital = _capital < 0 ? 0.00 : (_capital > maxCapital ? maxCapital : _capital)

        setCapital(_capital)
        if (_capital && parseFloat(_capital) > 0.00) {
            estimateMintedDFAM(toWei(_capital.toString())).then(estimation => {
                console.log('DFAM estimation: ', estimation)
                setEstimationDFAM(estimation)
            })

            queryAllComponentAmountsOut(toWei(_capital.toString())).then(amountsOut => {
                expectedAmountsOut.current = amountsOut;
                setMinAmountsOut(calcFrontrunningPrevention(amountsOut, tolerance))
            });

        } else {
            setEstimationDFAM('0')
            setMinAmountsOut([])
        }

    }

    function handleChangeFRP() {
        setIsFRPActivated(!isFRPActivated)
    }

    const handleChangeTolerance = (_tolerance) => {
        _tolerance = _tolerance < 0 ? 0 : (_tolerance > 100 ? 100 : _tolerance)
        setTolerance(_tolerance);
        setMinAmountsOut(calcFrontrunningPrevention(expectedAmountsOut.current, _tolerance));
        // const _minAmountsOut = calcFrontrunningPrevention(expectedAmountsOut.current, _tolerance);
        // setMinAmountsOut(_minAmountsOut)

    }

    function renderMinAmountsOut() {
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
        <Container style={{boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'}}>
            <ButtonGroup fluid attached='top'>
                <Button
                    color={isInvestPanel && 'purple'}
                    content='Invest'
                    onClick={() => setIsInvestPanel(true)}
                />
                <Button
                    color={!isInvestPanel && 'purple'}
                    content='Redeem'
                    onClick={() => setIsInvestPanel(false)}
                />
            </ButtonGroup>
            <Segment padded attached raised color='purple'>
                <Form style={{marginTop: '1%'}}>
                    <AmountInput
                        isInvestPanel={isInvestPanel}
                        capital={capital}
                        handleChangeCapital={handleChangeCapital}
                    />

                    <Grid divided style={{marginTop: '1%'}}>
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
                                            <Checkbox
                                                toggle
                                                label='&nbsp;'
                                                checked={isFRPActivated}
                                                onClick={() => handleChangeFRP()}
                                                color='purple'
                                            />
                                        </ListItem>
                                    </List>
                                </Header>
                                <FormField>
                                    <Input
                                        value={tolerance}
                                        onChange={e => {
                                            handleChangeTolerance(e.target.value)
                                        }}
                                        type='number'
                                        step='any'
                                        min={0}
                                        max={100}
                                        label={{basic: true, content: '%'}}
                                        labelPosition='right'
                                        placeholder='Enter percentage...'
                                        disabled={!isFRPActivated || !capital || parseFloat(capital) <= 0}
                                        style={{width: '35%'}}
                                    />
                                </FormField>
                                <List horizontal relaxed>
                                    {(isFRPActivated && tolerance && capital && parseFloat(capital) > 0) && renderMinAmountsOut()}
                                </List>
                            </GridColumn>
                            <GridColumn width={6} style={{paddingLeft: '30px'}}>
                                <FormField>
                                    <Header as='h4'>
                                        <Icon name='calculator'/>
                                        Estimations
                                    </Header>
                                    <List style={{paddingLeft: '10%'}}>
                                        <List.Item style={{paddingBottom: '10px'}}>
                                            <Image avatar src='../images/DFAM.jpg'/>
                                            <List.Content verticalAlign='middle'>
                                                <ListHeader>
                                                    <Label basic circular color='green' size='large'>
                                                        + {fromWei(estimationDFAM)}{estimationDFAM === '0' && '.00'}
                                                    </Label>
                                                </ListHeader>
                                                <ListDescription style={{paddingTop: '10px'}}>
                                                    <Icon name='arrow right'/>
                                                    {fromWei(BN(indexBalance).add(BN(estimationDFAM)))}
                                                </ListDescription>
                                            </List.Content>
                                        </List.Item>
                                        <List.Item style={{paddingBottom: '10px'}}>
                                            <Image avatar
                                                   src='https://react.semantic-ui.com/images/avatar/small/stevie.jpg'/>
                                            <List.Content verticalAlign='middle'>
                                                <ListHeader>
                                                    <Label basic circular color='red' size='large'>
                                                        - {fromWei(BN(toWei(capital.toString())).add(BN(estimationTxCost)))}{capital === '0' && '.00'}
                                                    </Label>
                                                </ListHeader>
                                                <ListDescription style={{paddingTop: '10px'}}>
                                                    <Icon name='arrow right'/>
                                                    {fromWei(BN(ethBalance).sub(BN(toWei(capital.toString())).add(BN(estimationTxCost))))}
                                                </ListDescription>
                                            </List.Content>
                                        </List.Item>
                                        <List.Item>
                                            <ListIcon name='gripfire' size='big' color='blue'/>
                                            <List.Content verticalAlign='middle'>
                                                <Header color='blue' size='small'>
                                                    {fromWei(estimationTxCost)}{estimationTxCost === '0' && '.00'}
                                                    <span><Icon name='ethereum' size='normal'/></span>
                                                </Header>
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
                                    <Icon name='arrow circle right'/>
                                </FormButton>
                            </GridColumn>
                        </GridRow>
                    </Grid>


                </Form>
            </Segment>
        </Container>
    )
}

export default InvestorPanel;