import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { SwapInfo } from '../../common/types';

import {
    hexToBytes,
    bytesToHex,
    bytesToText,
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
    
        // Since we are using beacon token, there will only be one script address
        // and one utxo and the inline datum must be present
        const address = await API.assetsAddresses(beacon);
        const utxo = await API.addressesUtxosAsset(address[0].address, beacon);
        const metaData = (await API.txsMetadata(utxo[0].tx_hash))[0].json_metadata;
        const metaDataObj = JSON.parse((JSON.stringify(metaData)));
        const inlineDatum = utxo[0].inline_datum!;
        const datum = ListData.fromCbor(hexToBytes(inlineDatum));
        const askedAssetValue =  Value.fromUplcData(datum.list[0]);
        const offeredAssetValue = Value.fromUplcData(datum.list[1]);

        let askedAssetMPH = "";
        let askedAssetTN = "";
        let askedAssetPrice = 0;

        if (askedAssetValue.lovelace > 0) {
            askedAssetPrice = Number(askedAssetValue.lovelace);
        } else {
            // There should only be one asked asset minting policy
            const askedMPH = askedAssetValue.assets.mintingPolicies[0];
            const askedTN = offeredAssetValue.assets.getTokenNames(askedMPH);
            const askedTokens = offeredAssetValue.assets.getTokens(askedMPH);
            askedAssetMPH = askedMPH.hex;
            askedAssetTN = bytesToText(askedTN[0].bytes);
            askedAssetPrice = Number(askedTokens[0][1]);
        }

        let offeredAssetMPH = "";
        let offeredAssetTN = "";
        let offeredAssetQty = 0;

        if (offeredAssetValue.lovelace > 0) {
            offeredAssetQty = Number(offeredAssetValue.lovelace);
        } else {
            // There should only be one minting policy hash and token name as offered assets
            const offeredMPH = offeredAssetValue.assets.mintingPolicies[0];
            if (offeredMPH) {
                const offeredTN = offeredAssetValue.assets.getTokenNames(offeredMPH);
                const offeredTokens = offeredAssetValue.assets.getTokens(offeredMPH);
                offeredAssetMPH = offeredMPH.hex;
                offeredAssetTN = bytesToText(offeredTN[0].bytes);
                offeredAssetQty = Number(offeredTokens[0][1]);
            } else {
                // If asset is zero qty then need to handle differently
                // because when value is being created fromUplcData, zero qty assets
                // are being removed :(
                offeredAssetMPH = bytesToHex(datum.list[1].map[0][0].bytes);
                offeredAssetTN = bytesToText(datum.list[1].map[0][1].map[0][0].bytes);
            }
        }

        const mph = beacon.substring(0,56);
        const tn = beacon.substring(56);
        const escrowEnabled = metaDataObj[mph][tn]['ESCROW_ENABLED'];
        const escrowHash = metaDataObj[mph][tn]['ESCROW_HASH'];
        const serviceFee = metaDataObj[mph][tn]['SERVICE_FEE'];
        const sellerTokenTN = metaDataObj[mph][tn]['SELLER_TN'];
        const sellerPKH = metaDataObj[mph][tn]['SELLER_PKH'];
        const userTokenMPH = metaDataObj[mph][tn]['USER_TOKEN_MPH'];
        const userTokenValHash = metaDataObj[mph][tn]['USER_TOKEN_VHASH'];
        const minAda = metaDataObj[mph][tn]['MIN_ADA'];
        const ownerPKH = metaDataObj[mph][tn]['OWNER_PKH'];
        const depositAda = metaDataObj[mph][tn]['DEPOSIT_ADA'];
        const version = metaDataObj[mph][tn]['VERSION'];

        const swapInfo = new SwapInfo(
            mph,
            tn,
            address[0].address,
            askedAssetMPH,
            askedAssetTN,
            askedAssetPrice,
            offeredAssetMPH,
            offeredAssetTN,
            offeredAssetQty,
            (escrowEnabled === "true"),
            escrowHash,
            sellerTokenTN,
            sellerPKH,
            userTokenMPH,
            userTokenValHash,
            serviceFee,
            ownerPKH,
            minAda,
            depositAda,
            version
        );
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