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
        
        const utxos = await API.txsUtxos(txId);

        let askedAssetMPH = "";
        let askedAssetTN = "";
        let askedAssetQty = 0;
        let offeredAssetMPH = "";
        let offeredAssetTN = "";
        let offeredAssetQty = 0;
        let orderId;
        var metaData;
        var buyerPKH;
        var sellerPKH;
        var beacon;

        for (const output of utxos.outputs) {

            if (output.output_index == Number(txIdx)) {

                if (!output.inline_datum) {
                    throw console.error("getEscrowInfo: no datum found")
                }
                const datum = ListData.fromCbor(hexToBytes(output.inline_datum));
                const askedAssetValue =  Value.fromUplcData(datum.list[3]);
                const offeredAssetValue = Value.fromUplcData(datum.list[4]);
        
                if (askedAssetValue.lovelace > 0) {
                    askedAssetQty = Number(askedAssetValue.lovelace);
                } else {
                    const askedAsset = askedAssetValue.assets.dump();
                    Object.entries(askedAsset).forEach(([keyMph, valueMph], index, arr) => {
                        Object.entries(valueMph as {}).forEach(([tokenName, tokenQty], index, arr) => {
                            
                            askedAssetMPH = keyMph;
                            askedAssetTN = Buffer.from(tokenName, "hex").toString("utf8");
                            askedAssetQty = tokenQty as number;
        
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
                buyerPKH = bytesToHex(datum.list[1].bytes);
                sellerPKH = bytesToHex(datum.list[5].bytes);
            } else {
                // Find the beacon in the tx
                for (const amount of output.amount ) {
                    if (amount.unit.includes(beaconMPH)) {
                        beacon = amount.unit;
                    }
                }  
            } 
        }

        if (!beacon) {
            throw console.error("getEscrowInfo: beacon not found");
        }
        if (!orderId) {
            throw console.error("getEscrowInfo: orderId not found");
        }
        if (!buyerPKH) {
            throw console.error("getEscrowInfo: buyPKH not found");
        }
        if (!sellerPKH) {
            throw console.error("getEscrowInfo: sellerPKH not found");
        }
        const metaDataObj = JSON.parse((JSON.stringify(metaData)));
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
            askedAssetQty,
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
        res.status(200).send(escrowInfo);
    }
    catch (err) {
        res.status(500).json("getEscrowInfo API error: " + err);
    }
}