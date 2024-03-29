import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

import {
    Address,
    Assets,
    Datum,
    hexToBytes,
    ListData,
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

        console.log("unit: ", unit);
        const address = await API.addressesUtxosAsset(swapValidatorAddr, unit);
        console.log("address: ", address);
                                                      
        if (address.length != 1) {
            throw console.error("getSwapUtxo: incorrect amount of swap utxos");
        }
    
        var utxoValue = new Value(BigInt(0));
        for (const asset of address[0].amount) {
            const mph = asset.unit.substring(0,56);
            if (mph === "lovelace") {
                const assetValue = new Value(BigInt(asset.quantity));
                utxoValue = utxoValue.add(assetValue);
            } else {
                const tn = hexToBytes(asset.unit.substring(56));
                const assetValue = new Value(BigInt(0), new Assets([[mph, [[tn, BigInt(asset.quantity)]]]]));
                utxoValue = utxoValue.add(assetValue);
            }
            
        }
        const utxo = new UTxO(
            TxId.fromHex(address[0].tx_hash),
            BigInt(address[0].output_index),
            new TxOutput(
              Address.fromBech32(swapValidatorAddr),
              utxoValue,
              Datum.inline(ListData.fromCbor(hexToBytes(address[0].inline_datum!)))
            )
        );
        return utxo;
    }

    try {
        // TODO - sanitize inputs
        const utxo = await getSwapUtxo(req.body.addr, req.body.unit)
        res.status(200).send(utxo.toCbor());
    }
    catch (err) {
        res.status(500).json("getSwapUtxo API error: " + err);
    }
}