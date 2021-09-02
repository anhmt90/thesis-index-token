import React from "react";
import {Grid, GridColumn, GridRow} from 'semantic-ui-react';
import PortfolioBoard from './PortfolioBoard';
import PriceBoard from "./PriceBoard";
import {Route} from "react-router-dom";
import AdminPanel from "./admin/AdminPanel";
import InvestorPanel from "./investor/InvestorPanel";

const Page = () => {
    return (
        <Grid style={{margin: '1.5% auto', padding: '0 1%'}}>
            <GridRow>
                <GridColumn width={6}>
                    <GridRow style={{marginBottom: '5%'}}>
                        <PortfolioBoard/>
                    </GridRow>
                    <GridRow>
                        <PriceBoard/>
                    </GridRow>
                </GridColumn>
                <GridColumn width={10}>
                    <Route path='/' exact component={InvestorPanel} />
                    <Route path='/investor' exact component={InvestorPanel} />
                    <Route path='/admin' exact component={AdminPanel} />
                </GridColumn>
            </GridRow>
        </Grid>
    )
}

export default Page;