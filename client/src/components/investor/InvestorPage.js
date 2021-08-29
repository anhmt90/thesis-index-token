import React, {useContext, Fragment} from "react";
import {Grid, GridColumn, GridRow, Header, Icon, Image, List, Segment} from 'semantic-ui-react';
import _ from 'lodash';


import AppContext from "../../context";
import PortfolioBoard from '../PortfolioBoard';

const InvestorPage = () => {
    const {web3, account, isWalletDetected} = useContext(AppContext);




    return (
        <Fragment>
            <Grid style={{ margin: '3% auto' }}>
                <GridRow>
                    <GridColumn width={6} style={{backgroundColor: 'green'}}>
                        <Segment raised>
                            <Header as='h3'>
                                <Icon name='briefcase' />
                                Portfolio
                            </Header>
                            <PortfolioBoard />
                        </Segment>

                    </GridColumn>
                    <GridColumn width={10} style={{backgroundColor: 'blue'}}>

                    </GridColumn>
                </GridRow>
            </Grid>
            {/*<p>{Object.entries(addresses).map(([k, v]) => v + ', ')}</p>*/}


        </Fragment>

    )
}

export default InvestorPage;