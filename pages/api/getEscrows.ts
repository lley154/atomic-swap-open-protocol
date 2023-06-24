import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getEscrows = async (addr : string) : Promise<({ txHash : string })[]> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });
    
        const utxos = await API.addressesUtxos(addr);
        
        return utxos.map(obj => {
            const txHash = obj.tx_hash + "#" + obj.output_index.toString();
            return { txHash : txHash };
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