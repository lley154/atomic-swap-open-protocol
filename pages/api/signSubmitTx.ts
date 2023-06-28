import type { NextApiRequest, NextApiResponse } from 'next'
import { Bip32PrivateKey } from '@stricahq/bip32ed25519';
import { BlockFrostAPI, BlockfrostServerError } from '@blockfrost/blockfrost-js';
import { Buffer } from "buffer";
import { blake2b } from "blakejs";
import {
    bytesToHex, 
    hexToBytes, 
    Signature,
    Tx } from "@hyperionbt/helios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const submitTx = async (tx: Tx) : Promise<string> => {

      const payload = new Uint8Array(tx.toCbor());
      const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;
  
      try {
        const client = new BlockFrostAPI({
            projectId: apiKey,
          });
        const txHash = await client.txSubmit(payload);
        return txHash;

      }
      catch (err) {
          console.error("signSubmitTx API Failed: ", err);
          throw err;
      }
    }

    const hash32 = (data: any) => {
        const hash = blake2b(data, undefined, 32);
        return Buffer.from(hash);
    };
        
    function harden(num: number) {
        return 0x80000000 + num;
    }
    
    try {
        const rootKeyHex : string = process.env.NEXT_PUBLIC_ROOT_KEY as string;
        const buffer = Buffer.from(rootKeyHex, 'hex');
        const rootKey = new Bip32PrivateKey(buffer);

        const accountKey = rootKey
        .derive(harden(1852)) // purpose
        .derive(harden(1815)) // coin type
        .derive(harden(0)); // account #0
        
        const addrPrvKey = accountKey
        .derive(0) // external
        .derive(0)
        .toPrivateKey();

        const addrPubKey = accountKey
        .derive(0) // external
        .derive(0)
        .toBip32PublicKey();
        
        const txCbor = req.body;
        const tx = Tx.fromCbor(hexToBytes(txCbor));
        const txBodyCbor = bytesToHex((tx.body).toCbor());
        const txBody = Buffer.from(txBodyCbor, 'hex');
        const txHash = hash32(txBody);

        const pubKeyArray = [...addrPubKey.toBytes().subarray(0, 32)];
        const signatureArray = [...addrPrvKey.sign(txHash)];

        const signature = new Signature(pubKeyArray,
                                        signatureArray);

        tx.addSignature(signature);
        const txId = await submitTx(tx);
        console.log("txId", txId);
        res.status(200).send(txId);
    }
    catch (err) {
        res.status(500).json("signSubmitTx API error: " + err);
    }
}