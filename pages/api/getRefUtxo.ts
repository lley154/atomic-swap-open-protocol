import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

import {
    Address,
    Assets,
    ByteArray,
    Datum,
    hexToBytes,
    bytesToText,
    ListData,
    textToBytes,
    TxId,
    TxOutput,
    UTxO,
    Value, 
    MintingPolicyHash} from "@hyperionbt/helios";

import { tokenNameCount } from "../../common/utxos";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getRefUtxo = async (refValidatorAddr : string, userTN : string) : Promise<UTxO> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });

        console.log("getRefUtxo: ", refValidatorAddr);
    
        const address = await API.addressesUtxos(refValidatorAddr);
                                                      
        console.log("getRefUtxo: address: ", address);
        // Check that there exist at least one reference utxo
        if (address.length < 1) {
            throw console.error("getRefUtxo: no reference utxos found");
        }
        
        let utxoValue = new Value(BigInt(0));
        let mph = "";
        for (const addr of address) {
            for (const asset of addr.amount) {
                if (asset.unit === "lovelace") {
                    console.log("lovelace");
                    const assetValue = new Value(BigInt(asset.quantity));
                    utxoValue = utxoValue.add(assetValue);
                } else {
                    mph = asset.unit.substring(0,56);
                    const tn = hexToBytes(asset.unit.substring(56));
                    console.log("mph: ", mph);
                    console.log("tn: ", bytesToText(tn));
                    const assetValue = new Value(BigInt(0), new Assets([[mph, [[tn, BigInt(asset.quantity)]]]]));
                    utxoValue = utxoValue.add(assetValue);
                }
            }
            if (await tokenNameCount(MintingPolicyHash.fromHex(mph), userTN, utxoValue) == 1) {
                
                if (addr.inline_datum) {
                    const utxo = new UTxO(
                        TxId.fromHex(address[0].tx_hash),
                        BigInt(address[0].output_index),
                        new TxOutput(
                          Address.fromBech32(refValidatorAddr),
                          utxoValue,
                          Datum.inline(new ByteArray(addr.inline_datum))
                        )
                    );
                    console.log("getRefUtxo: utxo: ", utxo);
                    return utxo;
                } else {
                    throw console.error("getRefUtxo: No inline datum found")
                }
                
            } else {
                // reset utxoValue
                utxoValue = new Value(BigInt(0));
            }
        }

        throw console.error("getRefUtxo: no refernce tokens found")

        //console.log("utxoValue: ", utxoValue.toSchemaJson());
        //console.log("getRefUtxo: address[0].tx_hash: ", address[0].tx_hash);
        //console.log("getRefUtxo: address[0].output_index: ", address[0].output_index);
        //console.log("getRefUtxo: hexToBytes(address[0].inline_datum ", hexToBytes(address[0].inline_datum));
        //console.log("getRefUtxo: Datum: ", Datum.inline(new ByteArray(address[0].inline_datum)));
        
    }

    try {
        // TODO - sanitize inputs
        const utxo = await getRefUtxo(req.body.addr, req.body.userTN)
        console.log("utxo", utxo.toCbor());
        res.status(200).send(utxo.toCbor());
    }
    catch (err) {
        res.status(500).json("getRefUtxo API error: " + err);
    }
}