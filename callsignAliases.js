 const callsignAliases = {
  "ALASKA AIRLINES": "ASA",
  "ALASKA": "ASA",

  "ALITALIA": "AZA",
  "ALITALIA AIRLINES": "AZA",

  "AMERICAN AIRLINES": "AAL",
  "AMERICAN": "AAL",

  "ANA ALL NIPPON AIRWAYS": "ANA",

  "AIR CANADA": "ACA",
  "CANADA": "ACA",

  "AIR CHINA": "CCA",
  "CHINA AIR": "CCA",

  "AIR FRANCE": "AFR",
  "AIR FRANCE‑KLM": "AFR",

  "AIR INDIA": "AIC",
  "INDIA": "AIC",

  "AIR FLOAT": "AFL",
  "AIRFLOW": "AFL",
  "AIRPORT": "AFL",
  "AIRFLOWED": "AFL",
  "AIRFLIGHT": "AFL",

  "BRITISH AIRWAYS": "BAW",
  "BRITISH": "BAW",
  "SPEED BIRD": "BAW",

  "BELAVIA": "BRU",
  "BELLAVIA": "BRU",
  "BOLIVIA": "BRU", 
  "BELARUS": "BRU",

  "CHINA EASTERN AIRLINES": "CES",
  "CHINA EASTERN": "CES",

  "CHINA SOUTHERN AIRLINES": "CSN",
  "CHINA SOUTHERN": "CSN",

  "CHINA AIRLINES": "CAL",
  "CHINA AIR": "CAL",

  "DELTA AIR LINES": "DAL",
  "DELTA": "DAL",

  "EMIRATES": "UAE",
  "EMIRATES AIRLINE": "UAE",

  "ETIHAD AIRWAYS": "ETD",
  "ETIHAD": "ETD",

  "EASYJET": "EZY",
  "EASYJET AIRLINES": "EZY",

  "FINNAIR": "FIN",
  "FINNAIR AIRLINES": "FIN",

  "HONGKONG AIRLINES": "CRK",
  "HONG KONG": "CRK",

  "HAINAN AIRLINES": "CHH",
  "HAINAN": "CHH",

  "INDIGO": "6E",
  "INDIGO AIRLINES": "6E",

  "JETBLUE AIRWAYS": "JBU",
  "JETBLUE": "JBU",

  "JAPAN AIRLINES": "JAL",
  "JAPAN": "JAL",

  "KLM ROYAL DUTCH AIRLINES": "KLM",

  "LATAM AIRLINES": "LAN",
  "LATAM": "LAN",

  "LUFTHANSA": "DLH",
  "LUFTHANSA GROUP": "DLH",

  "NORWEGIAN AIR SHUTTLE": "NAX",
  "NORWEGIAN": "NAX",

  "QANTAS": "QFA",
  "QANTAS AIRWAYS": "QFA",

  "QATAR AIRWAYS": "QTR",
  "QATAR": "QTR",

  "RYANAIR": "RYR",

  "SINGAPORE AIRLINES": "SIA",
  "SINGAPORE": "SIA",

  "SCANDINAVIAN AIRLINES": "SAS",
  "SCANDINAVIAN": "SAS",

  "SOUTHWEST AIRLINES": "SWA",
  "SOUTHWEST": "SWA",

  "SOUTH AFRICAN AIRWAYS": "SAA",
  "SOUTH AFRICAN": "SAA",

  "SPIRIT AIRLINES": "NKS",
  "SPIRIT": "NKS",

  "TURKISH AIRLINES": "THY",
  "TURKISH": "THY",

  "TAP AIR PORTUGAL": "TAP",

  "UNITED AIRLINES": "UAL",
  "UNITED": "UAL",

  "VIRGIN ATLANTIC": "VIR",
  "VIRGIN": "VIR",

  "WESTJET": "WJA",
  "WESTJET AIRLINES": "WJA"
};

function normalizeCallsign(str) {
  return str.toUpperCase().replace(/[\s\-.,]/g, '');
}
export const callsignAliasesJoined = {};
for (const [k, v] of Object.entries(callsignAliases)) {
  callsignAliasesJoined[normalizeCallsign(k)] = v;
}
