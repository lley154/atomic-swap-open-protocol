import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { EscrowInfo } from '../../common/types';

import {
    bytesToHex,
    bytesToText,
    hexToBytes,
    ListData,
    Value } from "@hyperionbt/helios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getEscrowInfo = async (beaconMPH : string, txId : string, txIdx : string ) : Promise<EscrowInfo> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });
    
        //const address = await API.assetsAddresses(asset);
        const utxos = await API.txsUtxos(txId);

        let askedAssetMPH = "";
        let askedAssetTN = "";
        let askedAssetPrice = 0;
        let offeredAssetMPH = "";
        let offeredAssetTN = "";
        let offeredAssetQty = 0;
        let orderId;
        var metaData;
        var buyerPKH;
        var sellerPKH;
        var beacon;

        for (const output of utxos.outputs) {
            console.log("txId: ", txId);
            console.log("txIdx: ", txIdx);

            if (output.output_index == Number(txIdx)) {

                if (!output.inline_datum) {
                    throw console.error("getEscrowInfo: no datum found")
                }
                const datum = ListData.fromCbor(hexToBytes(output.inline_datum));
                console.log("getEscrowInfo: datum: ", datum.toSchemaJson());
                
                const askedAssetValue =  Value.fromUplcData(datum.list[2]);
                const offeredAssetValue = Value.fromUplcData(datum.list[4]);
        
                if (askedAssetValue.lovelace > 0) {
                    askedAssetPrice = Number(askedAssetValue.lovelace);
                } else {
                    const askedAsset = askedAssetValue.assets.dump();
                    Object.entries(askedAsset).forEach(([keyMph, valueMph], index, arr) => {
                        Object.entries(valueMph as {}).forEach(([tokenName, tokenQty], index, arr) => {
                            console.log("getEscrowInfo: asked mph: ", keyMph);
                            console.log("getEscrowInfo: asked token name: ", bytesToText(hexToBytes(tokenName)));
                            console.log("getEscrowInfo: asked token qty: ", tokenQty);
        
                            askedAssetMPH = keyMph;
                            askedAssetTN = Buffer.from(tokenName, "hex").toString("utf8");
                            askedAssetPrice = tokenQty as number;
        
                            arr.length = index + 1; // there will only be 1 token, so break
                        })
                        arr.length = index + 1; // there will only be 1 mph, so break
                    })
                }
        
                if (offeredAssetValue.lovelace > 0) {
                    offeredAssetQty = Number(offeredAssetValue.lovelace);
                } else {
                    const offeredAsset = offeredAssetValue.assets.dump();
                    Object.entries(offeredAsset).forEach(([keyMph, valueMph], index, arr) => {
                        Object.entries(valueMph as {}).forEach(([tokenName, tokenQty], index, arr) => {
                            console.log("getEscrowInfo: offered mph: ", keyMph);
                            console.log("getEscrowInfo: offered token name: ", tokenName);
                            console.log("getEscrowInfo: offered token qty: ", tokenQty);
        
                            offeredAssetMPH = keyMph;
                            offeredAssetTN  = Buffer.from(tokenName, "hex").toString("utf8");
                            offeredAssetQty = tokenQty as number;
        
                            arr.length = index + 1; // there will only be 1 token, so break
                        })
                        arr.length = index + 1; // there will only be 1 mph, so break
                    })
                }
                orderId = bytesToText(datum.list[0].bytes); 
                metaData = (await API.txsMetadata(txId))[0].json_metadata;
                console.log("metaData: ", metaData);
                buyerPKH = bytesToHex(datum.list[1].bytes);
                console.log("buyerPKH: ", buyerPKH);
                sellerPKH = bytesToHex(datum.list[5].bytes);
                console.log("sellerPKH: ", sellerPKH);
            } else {
                // Find the beacon in the tx
                for (const amount of output.amount ) {
                    console.log("amount: ", amount);
                    if (amount.unit.includes(beaconMPH)) {
                        beacon = amount.unit;
                        console.log("beacon: ", beacon);
                        
                    }
                }  
            } 
        }

        console.log("beacon: ", beacon);
        if (!beacon) {
            throw console.error("getEscrowInfo: beacon not found");
        }
        console.log("orderId: ", orderId);
        if (!orderId) {
            throw console.error("getEscrowInfo: orderId not found");
        }
        console.log("buyerPKH: ", buyerPKH);
        if (!buyerPKH) {
            throw console.error("getEscrowInfo: buyPKH not found");
        }
        console.log("sellerPKH: ", sellerPKH);
        if (!sellerPKH) {
            throw console.error("getEscrowInfo: sellerPKH not found");
        }
        //console.log("beacon: ", beacon);
        const metaDataObj = JSON.parse((JSON.stringify(metaData)));
        console.log("metaDataObj: ", metaDataObj);
        const mph = beacon.substring(0,56);
        const tn = beacon.substring(56);
        const escrowHash = metaDataObj[mph][tn]['ESCROW_HASH'];
        const minAda = metaDataObj[mph][tn]['MIN_ADA'];
        const ownerPKH = metaDataObj[mph][tn]['OWNER_PKH'];
        const depositAda = metaDataObj[mph][tn]['DEPOSIT_ADA'];
        const version = metaDataObj[mph][tn]['VERSION'];

        const escrowInfo = new EscrowInfo(
            orderId,
            escrowHash,
            askedAssetMPH,
            askedAssetTN,
            askedAssetPrice,
            offeredAssetMPH,
            offeredAssetTN,
            offeredAssetQty,
            buyerPKH,
            sellerPKH,
            ownerPKH,
            minAda,
            depositAda,
            version
        );
        return escrowInfo;
    }

    try {
        // TODO - sanitize inputs
        const escrowInfo = await getEscrowInfo(req.body.beaconMPH, req.body.txId, req.body.txIdx)
        console.log("getEscrowInfo: escrowInfo: ", escrowInfo);
        res.status(200).send(escrowInfo);
    }
    catch (err) {
        res.status(500).json("getEscrowInfo API error: " + err);
    }
}