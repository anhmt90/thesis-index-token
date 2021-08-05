// **********************************************************************
const ECONOMIC_DIM_GROUP = 'E';
/**
 *
 * DIMENSION: Econonomic purpose
 *
 */
const EEP = ECONOMIC_DIM_GROUP + 'EP';

// ********** pegged payment tokens **********
const EEP_PAYMENT = EEP + '21';
const EEP_PAYMENT_PEGGED = EEP_PAYMENT + 'PP';
// fiat pegged
const EEP_PAYMENT_PEGGED__FIAT = EEP_PAYMENT_PEGGED + '01';
const EEP_PAYMENT_PEGGED__FIAT_USD = EEP_PAYMENT_PEGGED__FIAT + 'USD';
const EEP_PAYMENT_PEGGED__FIAT_EUR = EEP_PAYMENT_PEGGED__FIAT + 'EUR';
//asset pegged
const EEP_PAYMENT_PEGGED__ASSET = EEP_PAYMENT_PEGGED + '02';

// ********** utility tokens **********
const EEP_UTILITY = EEP + '22';

// transactional utility tokens (used for transaction settlement)
const EEP_UTILITY_TX = EEP_UTILITY + 'TU';
const EEP_UTILITY_TX__SETTLEMENT = EEP_UTILITY_TX + '01';
const EEP_UTILITY_TX__SETTLEMENT_ACCESS = EEP_UTILITY_TX + '02';
const EEP_UTILITY_TX__SETTLEMENT_GOVERNANCE = EEP_UTILITY_TX + '03';

// non-transactional utility tokens (not used for transaction settlement)
const EEP_UTILITY_NONTX = EEP_UTILITY + 'NT';
const EEP_UTILITY_NONTX__ACCESS = EEP_UTILITY_NONTX + '01';
const EEP_UTILITY_NONTX__GOVERNANCE = EEP_UTILITY_NONTX + '02';
const EEP_UTILITY_NONTX__OWNERSHIP = EEP_UTILITY_NONTX + '03';

// ********** investment (instrument) tokens  **********
const EEP_INVESTMENT = EEP + '23';
const EEP_INVESTMENT_EQUITY = EEP_INVESTMENT + 'EQ';
const EEP_INVESTMENT_ENTITLEMENTRIGHTS = EEP_INVESTMENT + 'ER';
const EEP_INVESTMENT_DEBT = EEP_INVESTMENT + 'DT';
const EEP_INVESTMENT_DERIVATIVE = EEP_INVESTMENT + 'DV';
const EEP_INVESTMENT_FUND = EEP_INVESTMENT + 'FD';
const EEP_INVESTMENT_OTHERS = EEP_INVESTMENT + 'ZZ';

// ********** Tokens of other purpose **********
const EEP_OTHER = EEP + '99';


/**
 *
 * DIMENSION: Issuer Industry
 *
 */
const EIN = ECONOMIC_DIM_GROUP + 'IN';

// ********** Tokens in Agriculture and Mining **********
const EIN_AGRICULTURE_MINING = EIN + '01';

// ********** Tokens in Utilities and Construction  **********
const EIN_UTILILIES_CONSTRUCTION = EIN + '02';

// ********** Tokens in Real Estate, Rental and Leasing  **********
const EIN_REALESTATE_RENTAL_LEASING = EIN + '03';

// ********** Tokens in Manufacturing, Trade and Logistics  **********
const EIN_MANUFACTURE_TRADE_LOGISTICS = EIN + '04';

// ********** Tokens in Information, Communication and IT  **********
const EIN_ICT = EIN + '05';
const EIN_ICT_MEDIA = EIN_ICT + 'MS';
const EIN_ICT_TELECOM = EIN_ICT + 'TC';

// Software, Data Storage and Processing
const EIN_ICT_DA = EIN_ICT + 'DA';
const EIN_ICT_DA__AI = EIN_ICT_DA + '01';
const EIN_ICT_DA__IOT = EIN_ICT_DA + '02';
const EIN_ICT_DA__CLOUD_DS_DAPP = EIN_ICT_DA + '03';
const EIN_ICT_DA__SECURITY_PRIVACY_INDETITY = EIN_ICT_DA + '04';
const EIN_ICT_DA__OTHER = EIN_ICT_DA + '05';

const EIN_ICT_OTHER = EIN_ICT + 'ZZ';

// ********** Tokens in Finance and Insurance  **********
const EIN_FININS = EIN + '06';

// Payment Services and Infrastructure
const EIN_FININS_PAYSVC = EIN_FININS + 'PS';

// Exchange, Trading and Settlement
const EIN_FININS_EXCHG = EIN_FININS + 'EX';

// Banking, Custody and Financing Services
const EIN_FININS_BANK = EIN_FININS + 'BS';

// Investment and Asset Management
const EIN_FININS_ASSETMGMT = EIN_FININS + 'AM';

// Insurance Services
const EIN_FININS_INSURANCE = EIN_FININS + 'IS';

// Decentralized Finance (DeFi)
const EIN_FININS_DEFI = EIN_FININS + 'DF';
const EIN_FININS_DEFI__MARKETMAKING = EIN_FININS_DEFI + '01';
const EIN_FININS_DEFI__LENDINGSAVING = EIN_FININS_DEFI + '02';
const EIN_FININS_DEFI__DERIVATIVE_SYNASSET_INSURANCE = EIN_FININS_DEFI + '03';
const EIN_FININS_DEFI__DATA_ORACLE_INFRAS = EIN_FININS_DEFI + '04';
const EIN_FININS_DEFI__OTHER = EIN_FININS_DEFI + '05';


// ********** Tokens in Professional, Scientific and Technical Services  **********
const EIN_PST = EIN + '07';

// ********** Tokens in Arts, Entertainment, Recreation and Hospitality  **********
const EIN_AERH = EIN + '08';

// ********** Tokens in Public Administration, Education, Healthcare and Social Assistance  **********
const EIN_PEHS = EIN + '09';

// ********** Tokens in other industry  **********
const EIN_OTHER = EIN + '99';


// **********************************************************************
const TECHINOLOGICAL_DIM_GROUP = 'T';
const TTS = TECHINOLOGICAL_DIM_GROUP + 'TS';

const TTS_APPLAYER = TTS + '42';
const TTS_APPLAYER_ETH = TTS_APPLAYER + 'ET';
const TTS_APPLAYER_ETH__ERC20 = TTS_APPLAYER_ETH + '01';
const TTS_APPLAYER_ETH__ERC721 = TTS_APPLAYER_ETH + '02';
const TTS_APPLAYER_ETH__ERC1400 = TTS_APPLAYER_ETH + '03';
const TTS_APPLAYER_ETH__OTHER = TTS_APPLAYER_ETH + '99';

// **********************************************************************

const ITC_EEP_V100 = 'itc_ein_v100';
const ITC_TTS_V100 = 'itc_tts_v100';
const ITC_LLC_V100 = 'itc_llc_v100';
const ITC_EIN_V100 = 'itc_ein_v100';
const ITC_LIT_V100 = 'itc_lit_v100';
const ITC_REU_V100 = 'itc_reu_v100';


// OR-filter is used within a dimension, while AND-filter between dimensions
let filters = {
    itc_eep_v100: [],
    itc_tts_v100: [TTS_APPLAYER_ETH__ERC20],
    itc_llc_v100: [],
    itc_ein_v100: [EIN_FININS_DEFI__LENDINGSAVING],
    itc_lit_v100: [],
    itc_reu_v100: [],
};

module.exports = {
    ITC_EIN_V100,
    EIN_FININS_DEFI__LENDINGSAVING
}