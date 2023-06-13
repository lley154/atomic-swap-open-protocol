import axios from 'axios';

import { Address,
         bytesToHex,
         MintingPolicyHash,
         Tx,
         UTxO, 
         } from "@hyperionbt/helios";

import { SwapInfo,
         EscrowInfo } from '../common/types';

export {
    getEscrows,
    getEscrowInfo,
    getEscrowUtxo,
    getNetworkParams,
    getRefUtxo,
    getSwaps,
    getSwapInfo,
    getSwapUtxo,
    signSubmitTx,
    submitTx
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



/*
const getSwapUtxo = async (swapValidatorAddr : Address, beaconMPH : MintingPolicyHash) : Promise<UTxO> => {

    const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;

    const API = new BlockFrostAPI({
        projectId: apiKey
    });

    const address = await API.addressesUtxosAsset( swapValidatorAddr.toBech32(),
                                                   beaconMPH.hex + swapValidatorAddr.validatorHash.hex
                                                 );
    console.log("address", address);

    let valueAda = new Value(BigInt(address[0].amount[0].quantity));
    for (const asset of address[0].amount) {
        const mph = asset.unit.substring(0,57);
        const tn = textToBytes(asset.unit.substring(58));
        const qty = asset.quantity;
        const valueToken = new Value(BigInt(0), new Assets([[mph, [[tn, BigInt(qty)]]]]));
        valueAda.add(valueToken);
    }
    console.log("value", valueAda);

    const utxo = new UTxO(
        TxId.fromHex(address[0].tx_hash),
        BigInt(address[0].output_index),
        new TxOutput(
          swapValidatorAddr,
          valueAda,
          Datum.inline(ListData.fromCbor(textToBytes(address[0].inline_datum!)))
        )
    );
    return utxo;
}
*/


const getSwapUtxo = async (swapValidatorAddr : Address, beaconMPH : MintingPolicyHash) : Promise<UTxO> => {

    const addr = swapValidatorAddr.toBech32();
    const unit = beaconMPH.hex + swapValidatorAddr.validatorHash.hex;
    const payload = { 
        addr: addr,
        unit: unit
    }
    const api = "/api/getSwapUtxo";

    try {
      let res = await axios({
            url: api,
            data: payload,
            method: 'post',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(res.status == 200){
            return UTxO.fromCbor(res.data);
        } else {
          console.error("getSwapUtxo Error: ", res);
          throw res.data;
        }   
    }
    catch (err) {
        console.error("getSwapUtxo Failed: ", err);
        throw err;
    }
  }  



const getRefUtxo = async (refValidatorAddr : Address, userTokenTN : string) : Promise<UTxO> => {

    const addr = refValidatorAddr.toBech32();
    const payload = { 
        addr: addr,
        userTN: userTokenTN
    }
    const api = "/api/getRefUtxo";

    try {
      let res = await axios({
            url: api,
            data: payload,
            method: 'post',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(res.status == 200){
            return UTxO.fromCbor(res.data);
        } else {
          console.error("getRefUtxo Error: ", res);
          throw res.data;
        }   
    }
    catch (err) {
        console.error("getRefUtxo Failed: ", err);
        throw err;
    }
  }  


const getEscrowUtxo = async (escrowValAddr : Address, orderId : string) : Promise<UTxO> => {

    const addr = escrowValAddr.toBech32();
    const payload = { 
        addr: addr,
        orderId: orderId
    }
    const api = "/api/getEscrowUtxo";

    try {
      let res = await axios({
            url: api,
            data: payload,
            method: 'post',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(res.status == 200){
            return UTxO.fromCbor(res.data);
        } else {
          console.error("getEscrowUtxo Error: ", res);
          throw res.data;
        }   
    }
    catch (err) {
        console.error("getEscrowUtxo Failed: ", err);
        throw err;
    }
  }  

  const getSwaps = async (mph : MintingPolicyHash) : Promise<({asset: string, quantity: string})[]> => {

    const payload = { 
        mph : mph.hex
    }
    const api = "/api/getSwaps";

    try {
      let res = await axios({
            baseURL: 'http://localhost:3000',
            url: api,
            data: payload,
            method: 'post',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(res.status == 200){
            console.log("res.data:" , res.data);

           return res.data;

        } else {
          console.error("getSwaps Error: ", res);
          throw res.data;
        }   
    }
    catch (err) {
        console.error("getSwaps Failed: ", err);
        throw err;
    }
  }


  const getEscrows = async (addr : Address) : Promise<string[] | undefined> => {

    const payload = { 
        addr : addr.toBech32()
    }
    const api = "/api/getEscrows";

    try {
      let res = await axios({
            baseURL: 'http://localhost:3000',
            url: api,
            data: payload,
            method: 'post',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(res.status == 200){
            console.log("res.data:" , res.data);

           return res.data;

        } else {
          console.error("getEscrows Error: ", res.data);
          throw res.data;
        }   
    }
    catch (err) {
        console.error("getEscrows Failed: ", err);
        throw err;
    }
  }


  const getSwapInfo = async (asset : string) : Promise<SwapInfo> => {

    const payload = { 
        asset: asset
    }
    const api = "/api/getSwapInfo";

    try {
      let res = await axios({
            baseURL: 'http://localhost:3000',
            url: api,
            data: payload,
            method: 'post',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(res.status == 200){
            console.log("res.data:" , res.data);

           return res.data;

        } else {
          console.error("getSwapInfo Error: ", res);
          throw res.data;
        }   
    }
    catch (err) {
        console.error("getSwapInfo Failed: ", err);
        throw err;
    }
  }

  const getEscrowInfo = async (beaconMPH : string, txId : string, txIdx : string) : Promise<EscrowInfo> => {

    const payload = { 
        beaconMPH : beaconMPH,
        txId : txId,
        txIdx : txIdx
    }
    const api = "/api/getEscrowInfo";

    try {
      let res = await axios({
            baseURL: 'http://localhost:3000',
            url: api,
            data: payload,
            method: 'post',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        if(res.status == 200){
            console.log("res.data:" , res.data);

           return res.data;

        } else {
          throw console.error("getEscrowInfo Error: ", res);
        }   
    }
    catch (err) {
        //console.error("getEscrowInfo Failed: ", err);
        throw err;
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

const submitTx = async (tx: Tx) : Promise<string> => {
    const payload = bytesToHex(tx.toCbor());
    const urlAPI = "/api/submitTx";
  
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
          console.error("submitTx API Error: ", res);
          throw res.data;
        }   
    }
    catch (err) {
        console.error("submitTx Failed: ", err);
        throw err;
    }
}
  