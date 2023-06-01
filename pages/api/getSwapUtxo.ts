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

    const getSwapUtxo = async (swapValidatorAddr : string, unit : string) : Promise<UTxO> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });
    
        const address = await API.addressesUtxosAsset(swapValidatorAddr, unit);
                                                      
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
              Address.fromBech32(swapValidatorAddr),
              valueAda,
              Datum.inline(ListData.fromCbor(textToBytes(address[0].inline_datum!)))
            )
        );
        return utxo;
    }

    try {
        // TODO - sanitize inputs
        const utxo = await getSwapUtxo(req.body.addr, req.body.unit)
        console.log("utxo", utxo.toCbor());
        res.status(200).send(utxo.toCbor());
    }
    catch (err) {
        res.status(500).json("getSwapUtxo API error: " + err);
    }
}