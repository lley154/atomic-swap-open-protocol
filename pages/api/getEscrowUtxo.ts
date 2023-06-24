import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

import {
    Address,
    BlockfrostV0,
    bytesToText,
    Datum,
    hexToBytes,
    ListData,
    TxId,
    TxOutput,
    UTxO } from "@hyperionbt/helios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getEscrowUtxo = async (escrowValAddr : string, orderId : string) : Promise<UTxO> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });

    
        const utxos = await API.addressesUtxos(escrowValAddr);
                                                      
        if (utxos.length < 1) {
            throw console.error("getEscrowUtxo: can't find any escrow utxos");
        }
    
        for (const utxo of utxos) {
            if (!utxo.inline_datum) {
                continue;
            }
            const datum = Datum.inline(ListData.fromCbor(hexToBytes(utxo.inline_datum)));
            if (bytesToText(datum.data.list[0].bytes) == orderId) {
                const utxoReturn = new UTxO(
                    TxId.fromHex(utxo.tx_hash),
                    BigInt(utxo.output_index),
                    new TxOutput(
                      Address.fromBech32(utxo.address),
                      BlockfrostV0.parseValue(utxo.amount),
                      Datum.inline(ListData.fromCbor(hexToBytes(utxo.inline_datum)))
                      )
                );
                return utxoReturn;
            }

        }
        throw console.error("getEscrowUtxo: escrow UTXO not found")
    }

    try {
        // TODO - sanitize inputs
        const utxo = await getEscrowUtxo(req.body.addr, req.body.orderId)
        res.status(200).send(utxo.toCbor());
    }
    catch (err) {
        res.status(500).json("getEscrowUtxo API error: " + err);
    }
}