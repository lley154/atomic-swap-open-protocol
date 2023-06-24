import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

import {
    Address,
    Assets,
    ByteArray,
    bytesToText,
    Datum,
    hexToBytes,
    MintingPolicyHash,
    TxId,
    TxOutput,
    UTxO,
    Value
    } from "@hyperionbt/helios";

import { tokenNameCount } from "../../common/utxos";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getRefUtxo = async (refValidatorAddr : string, userTN : string) : Promise<UTxO> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });

        const address = await API.addressesUtxos(refValidatorAddr);
                                                      
        // Check that there exist at least one reference utxo
        if (address.length < 1) {
            throw console.error("getRefUtxo: no reference utxos found");
        }
        
        let utxoValue = new Value(BigInt(0));
        let mph = "";
        for (const addr of address) {
            for (const asset of addr.amount) {
                if (asset.unit === "lovelace") {
                    const assetValue = new Value(BigInt(asset.quantity));
                    utxoValue = utxoValue.add(assetValue);
                } else {
                    mph = asset.unit.substring(0,56);
                    const tn = hexToBytes(asset.unit.substring(56));
                    const assetValue = new Value(BigInt(0), new Assets([[mph, [[tn, BigInt(asset.quantity)]]]]));
                    utxoValue = utxoValue.add(assetValue);
                }
            }
            if (await tokenNameCount(MintingPolicyHash.fromHex(mph), userTN, utxoValue) == 1) {
                
                if (addr.inline_datum) {
                    const utxo = new UTxO(
                        TxId.fromHex(addr.tx_hash),
                        BigInt(addr.output_index),
                        new TxOutput(
                          Address.fromBech32(addr.address),
                          utxoValue,
                          Datum.inline(new ByteArray(addr.inline_datum))
                        )
                    );
                    return utxo;
                } else {
                    throw console.error("getRefUtxo: No inline datum found")
                }
                
            } else {
                // reset utxoValue
                utxoValue = new Value(BigInt(0));
            }
        }

        throw console.error("getRefUtxo: no reference tokens found")
    }

    try {
        // TODO - sanitize inputs
        const utxo = await getRefUtxo(req.body.addr, req.body.userTN)
        res.status(200).send(utxo.toCbor());
    }
    catch (err) {
        res.status(500).json("getRefUtxo API error: " + err);
    }
}