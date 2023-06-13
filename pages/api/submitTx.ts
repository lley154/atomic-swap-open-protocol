import type { NextApiRequest, NextApiResponse } from 'next'

import {
    hexToBytes, 
    Tx } from "@hyperionbt/helios";

import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const submitTx = async (tx: Tx) : Promise<string> => {

      const payload = new Uint8Array(tx.toCbor());
      const blockfrostAPI = process.env.NEXT_PUBLIC_BLOCKFROST_API as string;
      const blockfrostUrl = blockfrostAPI + "/tx/submit";
      const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
  
      try {
        let res = await axios({
              url: blockfrostUrl,
              data: payload,
              method: 'post',
              timeout: 8000,
              headers: {
                  'Content-Type': 'application/cbor',
                  'project_id': apiKey
              }
          })
          if(res.status == 200){
              return res.data;
          } else {
            console.error("submitTx API Blockfrost Error: ", res.data);
            throw res.data;
          }   
      }
      catch (err) {
          console.error("submitTx API Failed: ", err);
          throw err;
      }
    }
    
    try {
        
        const txCbor = req.body;
        const tx = Tx.fromCbor(hexToBytes(txCbor));
        const txId = await submitTx(tx);
        console.log("txId", txId);
        res.status(200).send(txId);
    }
    catch (err) {
        res.status(500).json("submitTx API error: " + err);
    }
}