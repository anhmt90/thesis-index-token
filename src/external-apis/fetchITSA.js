const fetch = require('node-fetch');
const { storeItcTokens } = require('../utils');

const fetchEthereumTokens = async () => {
    const site = 'https://api.itsa.global/v1/';
    const endpoint = "search-tokens";
    const queries = ["itc_tts_v100=TTS42ET", "rows=999999"];
    const url = site + endpoint + '?' + queries.join('&');

    const res = await fetch(url);
    if (res.status == 200) {
        const resJson = await res.json();
        resJson.data.forEach(entry => {
            delete entry.itc_eep_v090;
            delete entry.itc_tts_v090;
            delete entry.itc_llc_v090;
            delete entry.itc_ein_v090;
            delete entry.itc_lit_v090;
            delete entry.itc_reu_v090;
        });

        storeItcTokens(resJson.data);
        console.log(resJson.data.length + ' tokens stored!');
    } else {
        throw new Error("Bad response from server");
    }
};


(async () => {
    fetchEthereumTokens();
})();