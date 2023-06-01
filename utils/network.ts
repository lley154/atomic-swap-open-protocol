import axios from 'axios';
import { promises as fs } from 'fs';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

import { Address,
         Assets,
         bytesToHex,
         bytesToText,
         Datum,
         hexToBytes,
         ListData,
         MintingPolicyHash,
         textToBytes,
         Tx,
         TxId,
         TxOutput,
         UTxO, 
         ValidatorHash,
         Value} from "@hyperionbt/helios";

import SwapInfo from '../utils/swaps';

export {
    getNetworkParams,
    getUtxos,
    getSwapInfo,
    getSwaps,
    getSwapUtxo,
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
  

  const getSwaps = async (beaconMPH : MintingPolicyHash) : Promise<({asset: string, quantity: string})[]> => {

    const payload = { 
        mph : beaconMPH.hex
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

            /*

            let swaps = [];
            for (const swap of res.data) {
                const datum = ListData.fromCbor(hexToBytes(swap.datum));
                console.log("datum: ", datum.toSchemaJson());
                console.log("datum.fields[0]: ", datum.list[0]);
                const askedAssetValue =  Value.fromUplcData(datum.list[0]);
                console.log("askedAssetValue: ", askedAssetValue);
                const offeredAssetValue = Value.fromUplcData(datum.list[1]);
                
                let askedAssetMPH = "";
                let askedAssetTN = "";
                let askedAssetPrice = 0;

                if (askedAssetValue.lovelace > 0) {
                    askedAssetPrice = Number(askedAssetValue.lovelace);
                } else {

                    const askedAsset = askedAssetValue.assets.dump();
                    Object.entries(askedAsset).forEach(([keyMph, valueMph], index, arr) => {
                        Object.entries(valueMph as {}).forEach(([tokenName, tokenQty], index, arr) => {
                            console.log("asked mph: ", keyMph);
                            console.log("asked token name: ", bytesToText(hexToBytes(tokenName)));
                            console.log("asked token qty: ", tokenQty);

                            askedAssetMPH = keyMph;
                            askedAssetTN = tokenName;
                            askedAssetPrice = tokenQty as number;

                            arr.length = index + 1; // there will only be 1 token, so break
                        })
                        arr.length = index + 1; // there will only be 1 mph, so break
                    })
                }

                let offeredAssetMPH = "";
                let offeredAssetTN = "";
                let offeredAssetQty = 0;

                if (offeredAssetValue.lovelace > 0) {
                    offeredAssetQty = Number(offeredAssetValue.lovelace);
                } else {

                    const offeredAsset = offeredAssetValue.assets.dump();
                    Object.entries(offeredAsset).forEach(([keyMph, valueMph], index, arr) => {
                        Object.entries(valueMph as {}).forEach(([tokenName, tokenQty], index, arr) => {
                            console.log("offered mph: ", keyMph);
                            console.log("offered token name: ", bytesToText(hexToBytes(tokenName)));
                            console.log("offered token qty: ", tokenQty);

                            offeredAssetMPH = keyMph;
                            offeredAssetTN = tokenName;
                            offeredAssetQty = tokenQty as number;

                            arr.length = index + 1; // there will only be 1 token, so break
                        })
                        arr.length = index + 1; // there will only be 1 mph, so break
                    })
                }

                const swapInfo = new SwapInfo(
                    swap.addr,
                    askedAssetMPH,
                    askedAssetTN,
                    askedAssetPrice,
                    offeredAssetMPH,
                    offeredAssetTN,
                    offeredAssetQty);
                swaps.push(swapInfo);
            }
            //console.log("getSwaps: swaps: ", swaps);
            return swaps;
            */
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

            /*

            let swaps = [];
            for (const swap of res.data) {
                const datum = ListData.fromCbor(hexToBytes(swap.datum));
                console.log("datum: ", datum.toSchemaJson());
                console.log("datum.fields[0]: ", datum.list[0]);
                const askedAssetValue =  Value.fromUplcData(datum.list[0]);
                console.log("askedAssetValue: ", askedAssetValue);
                const offeredAssetValue = Value.fromUplcData(datum.list[1]);
                
                let askedAssetMPH = "";
                let askedAssetTN = "";
                let askedAssetPrice = 0;

                if (askedAssetValue.lovelace > 0) {
                    askedAssetPrice = Number(askedAssetValue.lovelace);
                } else {

                    const askedAsset = askedAssetValue.assets.dump();
                    Object.entries(askedAsset).forEach(([keyMph, valueMph], index, arr) => {
                        Object.entries(valueMph as {}).forEach(([tokenName, tokenQty], index, arr) => {
                            console.log("asked mph: ", keyMph);
                            console.log("asked token name: ", bytesToText(hexToBytes(tokenName)));
                            console.log("asked token qty: ", tokenQty);

                            askedAssetMPH = keyMph;
                            askedAssetTN = tokenName;
                            askedAssetPrice = tokenQty as number;

                            arr.length = index + 1; // there will only be 1 token, so break
                        })
                        arr.length = index + 1; // there will only be 1 mph, so break
                    })
                }

                let offeredAssetMPH = "";
                let offeredAssetTN = "";
                let offeredAssetQty = 0;

                if (offeredAssetValue.lovelace > 0) {
                    offeredAssetQty = Number(offeredAssetValue.lovelace);
                } else {

                    const offeredAsset = offeredAssetValue.assets.dump();
                    Object.entries(offeredAsset).forEach(([keyMph, valueMph], index, arr) => {
                        Object.entries(valueMph as {}).forEach(([tokenName, tokenQty], index, arr) => {
                            console.log("offered mph: ", keyMph);
                            console.log("offered token name: ", bytesToText(hexToBytes(tokenName)));
                            console.log("offered token qty: ", tokenQty);

                            offeredAssetMPH = keyMph;
                            offeredAssetTN = tokenName;
                            offeredAssetQty = tokenQty as number;

                            arr.length = index + 1; // there will only be 1 token, so break
                        })
                        arr.length = index + 1; // there will only be 1 mph, so break
                    })
                }

                const swapInfo = new SwapInfo(
                    swap.addr,
                    askedAssetMPH,
                    askedAssetTN,
                    askedAssetPrice,
                    offeredAssetMPH,
                    offeredAssetTN,
                    offeredAssetQty);
                swaps.push(swapInfo);
            }
            //console.log("getSwaps: swaps: ", swaps);
            return swaps;
            */
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