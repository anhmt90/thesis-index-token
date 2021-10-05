const { CoinGeckoClient } = require('coingecko-api-v3');
const { storeTokenPrices } = require('../utils')
const { COINGECKO_ID_SYM_MAP } = require('../constants')

const client = new CoinGeckoClient({
    timeout: 10000,
    autoRetry: true,
});


(async () => {
    const prices2ETH = await client.simplePrice({
        ids:['dai', 'binancecoin', '0x'],
        vs_currencies: ['eth']
    });

    const eth2Prices = {}
    for (const token in prices2ETH) {
        eth2Prices[COINGECKO_ID_SYM_MAP[token]] = 1 / prices2ETH[token].eth
    }
    console.log(eth2Prices)
    storeTokenPrices(eth2Prices)
})();