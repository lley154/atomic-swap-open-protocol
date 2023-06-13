import { 
    Address,
    Assets,
    ByteArray,
    bytesToText, 
    MintingPolicyHash,
    PubKeyHash,
    textToBytes,
    UTxO,
    TxRefInput,
    Value } from "@hyperionbt/helios";

import { SwapInfo } from '../common/types';
import UserTokenValidator from '../contracts/userTokenValidator.hl';
import { getRefUtxo } from '../common/network';

export { getEscrowDatumInfo,
         getRefTokenUTXO,
         getTokenNames,
         getSwapDatumInfo,
         tokenCount,
         tokenNameCount }



/**
 * Get the list of tokens names that match the minting policy
 * hash provided
 * @param {MintingPolicyHash} tokenMph
 * @param {string} tn
 * @param {Value} value
 * @returns {number} 
 */
const tokenNameCount = async (tokenMph: MintingPolicyHash, tn : string,  value: Value): Promise<number> => {
    let count = 0;
        const mphs = value.assets.mintingPolicies;
        for (const mph of mphs) {
            if (mph.hex === tokenMph.hex) {
                const tokenNames = value.assets.getTokenNames(mph);
                for (const tokenName of tokenNames) {
                    if (bytesToText(tokenName) === tn) {
                        count += 1;
                    }
                }
            }
        }

    return count;
}

/**
 * Get the list of tokens names that match the minting policy
 * hash provided
 * @param {MintingPolicyHash} tokenMph
 * @param {string} tn
 * @param {UTxO} utxo
 * @returns {number} 
 */
/*
const tokenNameCount = async (tokenMph: MintingPolicyHash, tn : string,  utxo: UTxO): Promise<number> => {
    let count = 0;
        const mphs = utxo.value.assets.mintingPolicies;
        for (const mph of mphs) {
            if (mph.hex === tokenMph.hex) {
                const tokenNames = utxo.value.assets.getTokenNames(mph);
                for (const tokenName of tokenNames) {
                    if (bytesToText(tokenName) === tn) {
                        count += 1;
                    }
                }
            }
        }

    return count;
}
*/

/**
 * Get the list of tokens names that match the minting policy
 * hash provided
 * @param {MintingPolicyHash} tokenMph
 * @param {UTxO[]} utxos
 * @returns {string[]} 
 */
const getTokenNames = async (tokenMph: MintingPolicyHash, utxos: UTxO[]): Promise<string[]> => {
    let tn = [];
    for (const utxo of utxos) {
        const mphs = utxo.value.assets.mintingPolicies;
        for (const mph of mphs) {
            if (mph.hex == tokenMph.hex) {
                const tokenNames = utxo.value.assets.getTokenNames(mph);
                for (const tokenName of tokenNames) {
                    tn.push(bytesToText(tokenName));
                }
            }
        }
    }
    return tn;
}

/**
 * Get the number of tokens in a set of utxo for a given mph
 * @param {MintingPolicyHash} tokenMph
 * @param {UTxO[]} utxos
 * @returns {BigInt} 
 */
const tokenCount = async (tokenMph: MintingPolicyHash, utxos: UTxO[]): Promise<BigInt> => {
    let tokenCount = BigInt(0);
    for (const utxo of utxos) {
        const mphs = utxo.value.assets.mintingPolicies;
        for (const mph of mphs) {
            if (mph.hex == tokenMph.hex) {
                const tokenNames = utxo.value.assets.getTokenNames(mph);
                for (const tokenName of tokenNames) {
                    tokenCount += utxo.value.assets.get(mph, tokenName);
                }
            }
        }
    }
    return tokenCount;
}


/**
 * Get a dump of each mph and the corresponding tokens
 * @param {Assets} assets
 * @returns {[string, string, bigint]} mph, tn, qty
 */
/*
const tokenList = (assets: Assets) => {
    let count = 0;
    
    assets.assets.forEach(([mph, tokens]) => {
        tokens.forEach(([tokenName, _]) => {
            count += 1
        })
    })
    */


/**
 * Return the askedAsset and offeredAsset inline Datum info.
 * @package
 * @param {UTxO} utxo
 * @returns {{askedAssetValue: Value, offeredAssetValue: Value}}
 */
const getSwapDatumInfo = async (utxo: UTxO): Promise<{ askedAssetValue: Value; offeredAssetValue: Value; }> => {

    const datumInfo = {
        askedAssetValue: Value.fromUplcData(utxo.origOutput.datum.data.list[0]),
        offeredAssetValue: Value.fromUplcData(utxo.origOutput.datum.data.list[1])
    }
    return datumInfo
}



/**
 * Return the datum info attached to the UTXO locked at escrow contract
 * @param {UTxO} utxo
 * @returns {{ orderId: ByteArray,
 *             buyerPkh: PubKeyHash,
*              depositVal: Value,
*              orderVal: Value,
*              productVal: Value,
*              sellerPKH: PubKeyHash,
*              version: ByteArray}} 
*/
const getEscrowDatumInfo = async (utxo : UTxO): Promise<{
    orderId: ByteArray;
    buyerPkh: PubKeyHash;
    depositVal: Value;
    orderVal: Value;
    productVal: Value;
    sellerPKH: PubKeyHash;
    version: ByteArray;
}> => {

   const datumInfo = {
       
       orderId: new ByteArray(utxo.origOutput.datum.data.list[0].bytes),
       buyerPkh: PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[1]),
       depositVal: Value.fromUplcData(utxo.origOutput.datum.data.list[2]),
       orderVal: Value.fromUplcData(utxo.origOutput.datum.data.list[3]),
       productVal: Value.fromUplcData(utxo.origOutput.datum.data.list[4]),
       sellerPKH: PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[5]),
       version: new ByteArray(utxo.origOutput.datum.data.list[6].bytes)
   }
   return datumInfo
}



const getRefTokenUTXO = async (userPKH : string,
                               userTokenTN : string,
                               swapInfo : SwapInfo,
                               optimize : Boolean): Promise<TxRefInput> => {

    const userToken : [number[], bigint][] = [[textToBytes(userTokenTN), BigInt(1)]];
    const userTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapInfo.userTokenMPH), userToken]]);
    const userTokenValue = new Value(BigInt(swapInfo.minAda), userTokenAsset);
    
    // Compile the user token validator script
    const userTokenValProgram = new UserTokenValidator();
    userTokenValProgram.parameters = {["VERSION"] : swapInfo.version};
    userTokenValProgram.parameters = {["USER_PKH"] : userPKH};
    userTokenValProgram.parameters = {["OWNER_PKH"] : swapInfo.ownerPKH};
    
    const userTokenValCompiledProgram = userTokenValProgram.compile(optimize.valueOf());  
    const userTokenValHash = userTokenValCompiledProgram.validatorHash;

    const utxo = await getRefUtxo(Address.fromHashes(userTokenValHash), userTokenTN);

    // Only one reference UTXO with the matching seller MPH should exist
    if (utxo.origOutput.value.eq(userTokenValue)) { 
        console.log("");
        console.log("getRefTokenUTXO: reference user token UTXO found");
        const refUtxo = new TxRefInput(
            utxo.txId,
            utxo.utxoIdx,
            utxo.origOutput
        )
        return refUtxo;
    } else {
        throw console.error("getRefTokenUTXO: reference user token not found");
    }
 
}
