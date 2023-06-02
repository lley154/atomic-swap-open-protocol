import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import SwapInfo from '../../utils/swaps';

import {
    Bool,
    bytesToHex,
    bytesToText,
    hexToBytes,
    ListData,
    Value } from "@hyperionbt/helios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getSwapInfo = async (beacon : string) : Promise<SwapInfo> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });
    
        //const assets = await API.assetsPolicyByIdAll(mph);
        // Since we are using beacon token, there will only be one script address
        // one utxo and the inline datum will must exist
        const address = await API.assetsAddresses(beacon);
        const utxo = await API.addressesUtxosAsset(address[0].address, beacon);
        const metaData = (await API.txsMetadata(utxo[0].tx_hash))[0].json_metadata;
        console.log("getSwapInfo: metaData[0].json_metadata: ", metaData);
        //console.log("getSwapInfo: metaData[0].json_metadata: ", JSON.stringify(metaData));
        
        const metaDataObj = JSON.parse((JSON.stringify(metaData)));
        //console.log("mph", mph);
        //console.log("tn", tn);
        //console.log("getSwapInfo: metaData[0].json_metadata: test: ", test);
        //console.log("getSwapInfo: metaData[0].json_metadata: test[mph]: ", test[mph][tn]);
        //console.log("getSwapInfo: metaData[0].json_metadata: test[mph]: version: ", test[mph][tn]['VERSION']);
        const inlineDatum = utxo[0].inline_datum!;
        const datum = ListData.fromCbor(hexToBytes(inlineDatum));
        console.log("getSwapInfo: datum: ", datum.toSchemaJson());
        
        const askedAssetValue =  Value.fromUplcData(datum.list[0]);
        const offeredAssetValue = Value.fromUplcData(datum.list[1]);

        let askedAssetMPH = "";
        let askedAssetTN = "";
        let askedAssetPrice = 0;

        if (askedAssetValue.lovelace > 0) {
            askedAssetPrice = Number(askedAssetValue.lovelace);
            askedAssetTN = "lovelace";
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
            offeredAssetTN = "lovelace";
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

        const mph = beacon.substring(0,56);
        const tn = beacon.substring(56);
        const escrowHash = metaDataObj[mph][tn]['ESCROW_HASH'];
        const escrowEnabled = metaDataObj[mph][tn]['ESCROW_ENABLED']
        const serviceFee = metaDataObj[mph][tn]['SERVICE_FEE'];
        const sellerTN = metaDataObj[mph][tn]['SELLER_TN'];
        const sellerPkh = metaDataObj[mph][tn]['SELLER_PKH'];
        const minAda = metaDataObj[mph][tn]['MIN_ADA'];
        const ownerPkh = metaDataObj[mph][tn]['OWNER_PKH'];
        const depositAda = metaDataObj[mph][tn]['DEPOSIT_ADA'];
        const version = metaDataObj[mph][tn]['VERSION'];

        const swapInfo = new SwapInfo(
            beacon,
            address[0].address,
            askedAssetMPH,
            askedAssetTN,
            askedAssetPrice,
            offeredAssetMPH,
            offeredAssetTN,
            offeredAssetQty,
            (escrowEnabled === "true"),
            escrowHash,
            sellerTN,
            sellerPkh,
            serviceFee,
            ownerPkh,
            minAda,
            depositAda,
            version
        );

       console.log("swapInfo", swapInfo);
       return swapInfo;
    }

    try {
        // TODO - sanitize inputs
        const swapInfo = await getSwapInfo(req.body.asset)
        res.status(200).send(swapInfo);
    }
    catch (err) {
        res.status(500).json("getSwapInfo API error: " + err);
    }
}