import React, {useContext, Fragment} from "react";
import {Grid, GridColumn, GridRow, Header, Icon, Image, List, Segment} from 'semantic-ui-react';
import _ from 'lodash';


import AppContext from "../../context";
import PortfolioBoard from '../PortfolioBoard';
import PriceBoard from "../PriceBoard";
import InvestorPanel from "./InvestorPanel";

const InvestorPage = () => {
    const {web3, account, isWalletDetected} = useContext(AppContext);


    return (
        <Fragment>
            <Grid style={{margin: '1.5% auto'}}>
                <GridRow>
                    <GridColumn width={6}>
                        <GridRow style={{marginBottom: '5%'}}>
                            <PortfolioBoard/>
                        </GridRow>
                        <GridRow>
                            <PriceBoard />
                        </GridRow>
                    </GridColumn>
                    <GridColumn width={10}>
                        <InvestorPanel />
                    </GridColumn>
                </GridRow>
            </Grid>
            {/*<p>{Object.entries(addresses).map(([k, v]) => v + ', ')}</p>*/}


        </Fragment>

    )
}

export default InvestorPage;