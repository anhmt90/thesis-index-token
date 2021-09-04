import React, {useContext} from "react";
import {Grid, GridColumn, GridRow} from 'semantic-ui-react';
import PortfolioBoard from './PortfolioBoard';
import PriceBoard from "./investor/PriceBoard";
import {Route} from "react-router-dom";
import AdminPanel from "./admin/AdminPanel";
import InvestorPanel from "./investor/InvestorPanel";
import AppContext from "../context";
import PerformanceTable from "./admin/PerformanceTable";

const Page = () => {

    const {
        location
    } = useContext(AppContext)

    return (
        <Grid style={{margin: '1.5% auto', padding: '0 1%'}}>
            <GridRow>
                <GridColumn width={7}>
                    <GridRow style={{marginBottom: '5%'}}>
                        <PortfolioBoard/>
                    </GridRow>
                    <GridRow>
                        {location.pathname === '/admin' ? <PerformanceTable/> : <PriceBoard/>}
                    </GridRow>
                </GridColumn>
                <GridColumn width={9}>
                    <Route path='/' exact component={InvestorPanel}/>
                    <Route path='/investor' exact component={InvestorPanel}/>
                    <Route path='/admin' exact component={AdminPanel}/>
                </GridColumn>
            </GridRow>
        </Grid>
    )
}

export default Page;