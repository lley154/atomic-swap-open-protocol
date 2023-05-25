import axios from 'axios';

import { bytesToHex,
         Tx } from "@hyperionbt/helios";

export {
    getNetworkParams,
    getUtxos,
    signSubmitTx
}

async function getNetworkParams(network: string) {

    var networkParamsUrl;
    if (network === "preview") {
        networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preview.json";
    } else if (network === "preprod") {
        networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preprod.json";
    } else if (network === "mainnet") {
        networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/mainnet.json";
    } else {
        throw console.error("getNetworkParams: network not set");
    }

    try {
       let res = await axios({
            url: networkParamsUrl,
            method: 'get',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(res.status == 200){
            return res.data;
        } else {
          throw console.error("getNetworkParams: error getting network params: ", res);
        }   
    }
    catch (err) {
        throw console.error("getNetworkParams: error getting network params: ", err);
    }
}


async function getUtxos(blockfrostUrl: string) {

    const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;

    try {
       let res = await axios({
            url: blockfrostUrl,
            method: 'get',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json',
                'project_id': apiKey
            }
        })
        if(res.status == 200){
            return res.data;
        } else {
          throw console.error("getUtxos: error getting utxos from blockfrost: ", res);
        }   
    }
    catch (err) {
        throw console.error("getUtxos: error getting utxos from blockfrost: ", err);
    }
}

const signSubmitTx = async (tx: Tx) : Promise<string> => {
    const payload = bytesToHex(tx.toCbor());
    const urlAPI = "/api/getSignature";
  
    try {
      let res = await axios({
            url: urlAPI,
            data: payload,
            method: 'post',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/cbor'
            }
        })
        if(res.status == 200){
            return res.data;
        } else {
          console.error("signSumitTx API Error: ", res);
          throw res.data;
        }   
    }
    catch (err) {
        console.error("signSubmitTx Failed: ", err);
        throw err;
    }
  }