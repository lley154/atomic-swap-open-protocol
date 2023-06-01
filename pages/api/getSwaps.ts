import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

import {
    Address,
    Assets,
    Datum,
    ListData,
    textToBytes,
    TxId,
    TxOutput,
    UTxO,
    Value } from "@hyperionbt/helios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getSwaps = async (mph : string) : Promise<({asset: string, quantity: string})[]> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });
    
        const assets = await API.assetsPolicyByIdAll(mph);

        /*
        console.log("getSwapInfo: assets: ",  assets);
                                                      
        let swapInfo = [];
        for (const asset of assets) {
            const address = await API.assetsAddresses(asset.asset);
            const utxo = await API.addressesUtxosAsset(address[0].address, asset.asset);
            console.log("getSwaps: utxo: ", utxo);
            const swapData = {
                addr: utxo[0].address,
                datum: utxo[0].inline_datum
            }
            swapInfo.push(swapData);
        }

        return swapInfo;
        */
       return assets;
    }

    try {
        // TODO - sanitize inputs
        const swaps = await getSwaps(req.body.mph)
        res.status(200).send(swaps);
    }
    catch (err) {
        res.status(500).json("getSwapInfo API error: " + err);
    }
}