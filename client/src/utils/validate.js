

export const isAnnounceAvailable = (isPortfolioUpdate, updateTime, rebalancingTime) => {
    return (isPortfolioUpdate && updateTime.getTime() > 0) || (!isPortfolioUpdate && rebalancingTime.getTime() > 0)
}