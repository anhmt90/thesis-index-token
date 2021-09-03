// const { storeItcTokens } = require('../utils');

const fetchEthereumTokens = async (filters = []) => {
    if (!process.env.ITSA_KEY) {
        return;
    }

    const site = 'https://api.itsa.global/v1/';
    const endpoint = "search-tokens";
    const queries = filters.concat(["itc_tts_v100=TTS42ET01", "rows=99999"])
    const url = site + endpoint + '?' + queries.join('&');

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': process.env.ITSA_KEY
        }
    });
    if (res.status === 200) {
        const resJson = await res.json();
        if (resJson.data.length > 0) {
            resJson.data.forEach(entry => {
                delete entry.itc_eep_v090;
                delete entry.itc_tts_v090;
                delete entry.itc_llc_v090;
                delete entry.itc_ein_v090;
                delete entry.itc_lit_v090;
                delete entry.itc_reu_v090;
            });
            // storeItcTokens(resJson.data);
            console.log(resJson.data.length + ' tokens stored!');
        }
    } else {
        throw new Error(`Unable to fetch from ITSA. RESPONSE: ${res}`);
    }
};


export default fetchEthereumTokens;