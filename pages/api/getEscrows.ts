import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { Address,
         BlockfrostV0,
         ConstrData,
         Datum,
         hexToBytes,
         TxId,
         TxOutput,
         UTxO } from '@hyperionbt/helios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getEscrows = async (addr : string) : Promise<({ txHash : string })[]> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });
    
        console.log("getEscrows: addr: ", addr);
        const utxos = await API.addressesUtxos(addr);
        console.log("getEscrows: utxos:", utxos);
        //let escrows = [];

        return utxos.map(obj => {

            const txHash = obj.tx_hash + "#" + obj.output_index.toString();
            //escrows.push(txHash);
            return { txHash : txHash };
            /*
            return new UTxO(
                TxId.fromHex(obj.tx_hash),
                BigInt(obj.output_index),
                new TxOutput(
                    Address.fromBech32(addr),
                    BlockfrostV0.parseValue(obj.amount),
                    Datum.inline(ConstrData.fromCbor(hexToBytes(obj.inline_datum!))) // TODO error checking
                )
            );
            */
        });
    }

    try {
        // TODO - sanitize inputs
        const escrows = await getEscrows(req.body.addr);
        res.status(200).send(escrows);
    }
    catch (err) {
        res.status(500).json("getEscrows API error: " + err);
    }
}