import {Fragment, useCallback, useContext, useEffect, useRef, useState} from "react";
import {
    Button,
    ButtonGroup,
    Checkbox,
    Container,
    Form,
    FormGroup,
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
    ListHeader,
    ListIcon,
    ListItem,
    Segment
} from "semantic-ui-react";
import AppContext from "../../context";
import {CONTRACTS, getAddress, getInstance} from "../../utils/getContract";
import {queryAllComponentAmountsOut, queryAllComponentNAVs} from "../../utils/queryAmountsOut";
import {estimateMintedDFAM, estimateRedeemedETH, estimateTxCost} from "../../utils/estimations";
import {BN, fromWei, toWei} from "../../getWeb3";
import {calcArrayFRP} from "../../utils/common";
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
    const [estimationETH, setEstimationETH] = useState('0');
    const [estimationTxCost, setEstimationTxCost] = useState('0');
    const [minAmountsOut, setMinAmountsOut] = useState([]);
    const [isFRPActivated, setIsFRPActivated] = useState(true);
    const [allowance, setAllowance] = useState('0')

    const expectedAmountsOut = useRef([])

    const isEnoughAllowance = useCallback((_allowance, _capital) => {
        return isInvestPanel || BN(_allowance).gte(BN(toWei(_capital)))
    }, [isInvestPanel])

    const getTx = useCallback(({capital, tolerance, minAmountsOut, isInvestPanel, isFRPActivated}) => {
        const _minAmountsOut = isFRPActivated && tolerance ? minAmountsOut : [];
        if (isInvestPanel)
            return getInstance(CONTRACTS.INDEX_FUND).methods.buy(_minAmountsOut);
        else
            return getInstance(CONTRACTS.INDEX_FUND).methods.sell(toWei(capital), _minAmountsOut);
    }, [])

    useEffect(() => {
        const queryAllowance = async () => {
            if (account) {
                const indexFundAddress = getAddress(CONTRACTS.INDEX_FUND);
                const _allowance = await getInstance(CONTRACTS.INDEX_TOKEN).methods.allowance(account, indexFundAddress).call();
                setAllowance(_allowance);
            }
        }
        queryAllowance();
    }, [account])

    useEffect(() => {
        const estimateGas = async () => {
            if (capital && parseFloat(capital) > 0.00) {
                const tx = getTx({capital, tolerance, minAmountsOut, isInvestPanel, isFRPActivated});
                console.log('In estimateGas', tx)
                const value = isInvestPanel ? capital : '';

                if (isEnoughAllowance(allowance, capital)) {
                    const _txCost = await estimateTxCost(tx, account, value);
                    console.log('_txCost', _txCost)
                    setEstimationTxCost(_txCost);


                }
            } else {
                setEstimationTxCost('0');
            }
        }
        estimateGas();
    }, [account, allowance, capital, getTx, isEnoughAllowance, isFRPActivated, isInvestPanel, minAmountsOut, tolerance])

    /******************************************************************************************************************/


    const handleSubmit = async (e) => {
        e.preventDefault()

        const updateFigures = async (txReceipt) => {
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
        }

        const executeTx = async (value) => {
            const tx = getTx({capital, tolerance, minAmountsOut, isInvestPanel, isFRPActivated});
            await tx.send({
                from: account,
                gas: '3000000',
                value
            }).on('receipt', async (txReceipt) => {
                await updateFigures(txReceipt);
                resetStates();
            });
        }

        if (capital) {
            if (isInvestPanel) {
                await executeTx(toWei(capital.toString()))
            } else {
                if (isEnoughAllowance(allowance, capital)) {
                    await executeTx('');
                } else {
                    const indexFundAddress = getAddress(CONTRACTS.INDEX_FUND)
                    await getInstance(CONTRACTS.INDEX_TOKEN).methods.approve(indexFundAddress, toWei(capital)).send({
                        from: account,
                        gas: '3000000'
                    }).on('receipt', async (txIncreaseAllowanceReceipt) => {
                        await executeTx('')
                    })
                }
            }
        }
    }

    /******************************************************************************************************************/

    const handleChangeCapital = (_capital) => {
        if (isInvestPanel) {
            const maxCapital = parseFloat(tokenUnits2Float(ethBalance));
            if (parseInt(supply) === 0)
                _capital = _capital < 0 ? 0.00 : (_capital > 0.01 ? 0.01 : _capital)
            else
                _capital = _capital < 0 ? 0.00 : (_capital > maxCapital ? maxCapital : _capital)

            setCapital(_capital)
            setEstimationETH('-' + toWei(_capital))
            if (_capital && parseFloat(_capital) > 0.00) {
                estimateMintedDFAM(toWei(_capital.toString())).then(estimation => {
                    console.log('DFAM estimation: ', estimation)
                    setEstimationDFAM(estimation)
                })

                queryAllComponentAmountsOut(toWei(_capital.toString())).then(amountsOut => {
                    expectedAmountsOut.current = amountsOut;
                    setMinAmountsOut(calcArrayFRP(amountsOut, tolerance))
                });
            } else {
                setEstimationDFAM('0')
                setMinAmountsOut([])
            }
        } else {
            const maxCapital = parseFloat(tokenUnits2Float(indexBalance));
            _capital = _capital < 0 ? 0.00 : (_capital > maxCapital ? maxCapital : _capital)
            setCapital(_capital)
            setEstimationDFAM('-' + toWei(_capital))
            if (_capital && parseFloat(_capital) > 0.00) {
                estimateRedeemedETH(toWei(_capital.toString())).then(estimation => {
                    console.log('NAV estimation: ', estimation)
                    setEstimationETH(estimation)
                })

                queryAllComponentNAVs(toWei(_capital.toString())).then(navs => {
                    expectedAmountsOut.current = navs;
                    setMinAmountsOut(calcArrayFRP(navs, tolerance))
                })
            } else {
                setEstimationETH('0');
                setMinAmountsOut([])
            }
        }
    }

    function handleToggleFRP() {
        setIsFRPActivated(!isFRPActivated)
    }

    const handleChangeTolerance = (_tolerance) => {
        _tolerance = _tolerance < 0 ? 0 : (_tolerance > 100 ? 100 : _tolerance)
        setTolerance(_tolerance);
        setMinAmountsOut(calcArrayFRP(expectedAmountsOut.current, _tolerance));
    }

    const handleApprove = async () => {
        const indexFundAddress = getAddress(CONTRACTS.INDEX_FUND);
        console.log('toWei(capital)', toWei(capital));
        await getInstance(CONTRACTS.INDEX_TOKEN).methods.approve(indexFundAddress, toWei(capital)).send({
            from: account,
            gas: '300000'
        }).on('receipt', async (txReceipt) => {
            const _allowance = await getInstance(CONTRACTS.INDEX_TOKEN).methods.allowance(account, indexFundAddress).call()
            setAllowance(_allowance)
        })
    }

    /******************************************************************************************************************/

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

    const renderEstimationDFAM = () => {
        const _estimationDFAM = fromWei(estimationDFAM).replace('-', '')
        const decimalSuffix = _estimationDFAM.includes('.') ? '' : '.00'
        if (isInvestPanel)
            return '+ ' + _estimationDFAM + decimalSuffix
        else
            return '- ' + _estimationDFAM + decimalSuffix
    }

    const renderEstimationETH = () => {
        const _estimationETH = fromWei(estimationETH).replace('-', '')
        const decimalSuffix = _estimationETH.includes('.') ? '' : '.00'
        if (isInvestPanel)
            return '- ' + _estimationETH + decimalSuffix
        else
            return '+ ' + _estimationETH + decimalSuffix
    }

    const renderEstimationDFAMBalance = () => {
        return fromWei(BN(indexBalance).add(BN(estimationDFAM)))
    }

    const renderEstimationETHBalance = () => {
        return fromWei(BN(ethBalance).add(BN(estimationETH).add(BN(estimationTxCost).neg())))
    }

    const renderTxCost = () => {
        if (!isEnoughAllowance(allowance, capital)) {
            return (
                <Fragment>
                    <List.Header>
                        <Header color='blue' as='h5'>
                            Not enough allowance to estimate gas
                        </Header>
                    </List.Header>
                    <List.Description style={{paddingTop: '5px'}}>
                        <Form.Group inline>
                            <span>Approve {capital} DFAM? &nbsp; &nbsp;</span>
                            <Form.Button
                                compact
                                size='mini'
                                content='Approve'
                                onClick={handleApprove}
                                color='blue'
                            />
                        </Form.Group>
                    </List.Description>
                </Fragment>
            )
        }
        const _estimationTxCost = fromWei(estimationTxCost)
        const decimalSuffix = _estimationTxCost.includes('.') ? '' : '.00'
        return (
            <Header color='blue' size='small'>
                {_estimationTxCost + decimalSuffix}
                <span><Icon name='ethereum' size='normal'/></span>
            </Header>
        )
    }

    const resetStates = () => {
        setCapital('0');
        setEstimationDFAM('0')
        setEstimationETH('0')
        setEstimationTxCost('0')
        setTolerance(5)
        setMinAmountsOut([])
        setIsFRPActivated(true)
    }

    const handleClickInvestTab = () => {
        if (!isInvestPanel) {
            resetStates();
            setIsInvestPanel(true)
        }
    }

    const handleClickRedeemTab = () => {
        if (isInvestPanel) {
            console.log('resetting')
            resetStates();
            setIsInvestPanel(false)
        }
    }


    return (
        <Container style={{boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)'}}>
            <ButtonGroup fluid attached='top'>
                <Button
                    color={isInvestPanel && 'purple'}
                    content='Invest'
                    onClick={handleClickInvestTab}
                />
                <Button
                    color={!isInvestPanel && 'purple'}
                    content='Redeem'
                    onClick={handleClickRedeemTab}
                />
            </ButtonGroup>
            <Segment padded attached raised color='purple'>
                <Form>
                    <AmountInput
                        isUpdatePanel={isInvestPanel}
                        announcement={capital}
                        handleChangeAnnouncement={handleChangeCapital}
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
                                                onClick={() => handleToggleFRP()}
                                                color='purple'
                                            />
                                        </ListItem>
                                    </List>
                                </Header>
                                <FormGroup inline>
                                    <label>Slippage Tolerance:</label>
                                    <Form.Field>
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
                                    </Form.Field>
                                </FormGroup>
                                <List horizontal relaxed>
                                    {(isFRPActivated && tolerance && capital && parseFloat(capital) > 0) && renderMinAmountsOut()}
                                </List>
                            </GridColumn>
                            <GridColumn width={6} style={{paddingLeft: '20px'}}>
                                <Form.Field>
                                    <Header as='h4' style={{paddingBottom: '10px'}}>
                                        <Icon name='calculator'/>
                                        Estimations
                                    </Header>
                                    <List style={{paddingLeft: '0'}}>
                                        <List.Item style={{paddingBottom: '10px'}}>
                                            <Image avatar src='../images/DFAM.jpg'/>
                                            <List.Content verticalAlign='middle'>
                                                <ListHeader>
                                                    <Label basic circular color={isInvestPanel ? 'green' : 'red'}
                                                           size='large'>
                                                        {renderEstimationDFAM()}
                                                    </Label>
                                                </ListHeader>
                                                <ListDescription style={{paddingTop: '10px'}}>
                                                    <Icon name='arrow right'/>
                                                    {renderEstimationDFAMBalance()}
                                                </ListDescription>
                                            </List.Content>
                                        </List.Item>
                                        <List.Item style={{paddingBottom: '10px'}}>
                                            <Image avatar src='../images/Ethereum.png'/>
                                            <List.Content verticalAlign='middle'>
                                                <ListHeader>
                                                    <Label basic circular color={isInvestPanel ? 'red' : 'green'}
                                                           size='large'>
                                                        {renderEstimationETH()}
                                                    </Label>
                                                </ListHeader>
                                                <ListDescription style={{paddingTop: '10px'}}>
                                                    <Icon name='arrow right'/>
                                                    {renderEstimationETHBalance()}
                                                </ListDescription>
                                            </List.Content>
                                        </List.Item>
                                        <List.Item>
                                            <ListIcon name='gripfire' size='big' color='blue'/>
                                            <List.Content verticalAlign='middle'>
                                                {renderTxCost()}
                                            </List.Content>
                                        </List.Item>
                                    </List>
                                </Form.Field>
                            </GridColumn>
                        </GridRow>
                        <GridRow>
                            <GridColumn textAlign='center'>
                                <Form.Button
                                    onClick={handleSubmit}
                                    disabled={!capital || !(parseFloat(capital) > 0)}
                                    color='purple'
                                    style={{width: '50%', margin: '5% auto'}}

                                >
                                    {isInvestPanel ? 'Buy' : 'Sell'}
                                    <Icon name='arrow circle right'/>
                                </Form.Button>
                            </GridColumn>
                        </GridRow>
                    </Grid>


                </Form>
            </Segment>
        </Container>
    )
}

export default InvestorPanel;