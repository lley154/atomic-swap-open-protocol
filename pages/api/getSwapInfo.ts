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
        const inlineDatum = utxo[0].inline_datum!;
        const datum = ListData.fromCbor(hexToBytes(inlineDatum));
        console.log("getSwapInfo: datum: ", datum.toSchemaJson());
        
        const askedAssetValue =  Value.fromUplcData(datum.list[0]);
        const offeredAssetValue = Value.fromUplcData(datum.list[1]);
        const escrowEnabled = Bool.fromUplcData(datum.list[2]);
        const sellerTokenTN = datum.list[3].bytes;
        console.log("sellerTokenTN: ", bytesToText(sellerTokenTN));
        const sellerPkh = datum.list[4].bytes;
        console.log("sellerPkh: ", bytesToHex(sellerPkh));
        const version = datum.list[5].bytes;
        console.log("version", bytesToText(version));

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

        const swapInfo = new SwapInfo(
            beacon,
            address[0].address,
            askedAssetMPH,
            askedAssetTN,
            askedAssetPrice,
            offeredAssetMPH,
            bytesToText(hexToBytes(offeredAssetTN)),
            offeredAssetQty,
            escrowEnabled.bool,
            bytesToText(sellerTokenTN),
            bytesToHex(sellerPkh),
            bytesToText(version)
        );

       //console.log("swapInfo", swapInfo);
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