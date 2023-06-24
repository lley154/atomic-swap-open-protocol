import type { NextApiRequest, NextApiResponse } from 'next'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const getSwaps = async (mph : string) : Promise<({asset: string, quantity: string})[]> => {

        const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
    
        const API = new BlockFrostAPI({
            projectId: apiKey
        });
    
        const assets = await API.assetsPolicyByIdAll(mph);
        const liveAssets = assets.filter(assets => BigInt(assets.quantity) > 0);

       return liveAssets;
    }

    try {
        // TODO - sanitize inputs
        const swaps = await getSwaps(req.body.mph);
        res.status(200).send(swaps);
    }
    catch (err) {
        res.status(500).json("getSwaps API error: " + err);
    }
}