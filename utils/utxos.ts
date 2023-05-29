import { 
    Assets,
    bytesToText, 
    MintingPolicyHash,
    TxId,
    TxOutput,
    UTxO,
    Value } from "@hyperionbt/helios";


export { getTokenNames,
         tokenCount }

/**
 * Get the list of tokens names that match the minting policy
 * hash provided
 * @param {MintingPolicyHash} tokenMph
 * @param {UTxO[]} utxos
 * @returns {string[]} 
 */
const getTokenNames = async (tokenMph: MintingPolicyHash, utxos: UTxO[]): string[] => {
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
 * @returns {int} 
 */
const tokenCount = async (tokenMph: MintingPolicyHash, utxos: UTxO[]) => {
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