import { promises as fs } from 'fs';

import {
  Address,
  Assets, 
  bytesToHex,
  bytesToText,
  ByteArray,
  config,
  Datum,
  hexToBytes,
  MintingPolicyHash,
  NetworkEmulator,
  NetworkParams, 
  Program,
  TxRefInput,
  Value, 
  textToBytes,
  TxOutput,
  Tx,
  UTxO,
  PubKeyHash,
  WalletEmulator,
} from "@hyperionbt/helios";

export {
    approveEscrow,
    assetSwap,
    assetSwapEscrow,
    beaconMPH,
    closeSwap,
    escrowProgram,
    EscrowConfig,
    openSwap,
    getMphTnQty,
    mintUserTokens,
    optimize,
    owner,
    network,
    showWalletUTXOs,
    SwapConfig,
    updateSwap
}

config.AUTO_SET_VALIDITY_RANGE = false;

// Create an Instance of NetworkEmulator
const network = new NetworkEmulator();

// Network Parameters
//const networkParamsFile = await fs.readFile('./contracts/preprod.json', 'utf8');
//const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));

//const networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preprod.json";
const networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preview.json";

const networkParamsPreview = new NetworkParams(
    await fetch(networkParamsUrl)
        .then(response => response.json())
  )
const networkParams = network.initNetworkParams(networkParamsPreview);

// Set the Helios compiler optimizer flag
let optimize = false;

// Global variables
const minChangeAda = BigInt(1_000_000);  // minimum lovelace needed to send back as change

// Create owner wallet - we add 10ADA to start
const owner = network.createWallet(BigInt(10_000_000));

// Create a new program swap script
const swapScript = await fs.readFile('./contracts/swap.hl', 'utf8');
const swapProgram = Program.new(swapScript);

// Define the swap config object which is used to uniquely create
// a swap script address for a given asset pair, beacon token and 
// seller pkh
class SwapConfig {
    constructor(version,
                askedMPH,
                askedTN, 
                offeredMPH, 
                offeredTN, 
                beaconMPH,  
                sellerPkh,
                escrowEnabled,
                escrowHash,
                userTokenMPH,
                userTokenVHash,
                serviceFee,
                ownerPkh,
                minAda,
                depositAda) {
      this.version = version;
      this.askedMPH = askedMPH;
      this.askedTN = askedTN;
      this.offeredMPH = offeredMPH;
      this.offeredTN = offeredTN;
      this.beaconMPH = beaconMPH;
      this.sellerPkh = sellerPkh;
      this.escrowEnabled = escrowEnabled;
      this.escrowHash = escrowHash;
      this.userTokenMPH = userTokenMPH;
      this.userTokenVHash = userTokenVHash;
      this.serviceFee = serviceFee;
      this.ownerPkh = ownerPkh;
      this.minAda = minAda;
      this.depositAda = depositAda;
    }
}

// Compile the escrow script
const escrowScript = await fs.readFile('./contracts/escrow.hl', 'utf8');
const escrowProgram = Program.new(escrowScript);

// Define the escrow config object which is used to uniquely create
// an escrow script address for a given buyer pkh, seller pkh 
// and the owner pkh.
class EscrowConfig {
    constructor(version, buyerPkh, sellerPkh, ownerPkh) {
        this.version = version;
        this.buyerPkh = buyerPkh;
        this.sellerPkh = sellerPkh;
        this.ownerPkh = ownerPkh;
    }
}

// Compile the Beacon minting script
const beaconScript = await fs.readFile('./contracts/beacon.hl', 'utf8');
const beaconProgram = Program.new(beaconScript);
beaconProgram.parameters = {["VERSION"] : "1.0"};
beaconProgram.parameters = {["OWNER_PKH"] : owner.pubKeyHash.hex};
const beaconCompiledProgram = beaconProgram.compile(optimize);
const beaconMPH = beaconCompiledProgram.mintingPolicyHash;

// Compile the Points minting script
const pointsScript = await fs.readFile('./contracts/points.hl', 'utf8');
const pointsProgram = Program.new(pointsScript);
pointsProgram.parameters = {["VERSION"] : "1.0"};
pointsProgram.parameters = {["OWNER_PKH"] : owner.pubKeyHash.hex};
const pointsCompiledProgram = pointsProgram.compile(optimize);
const pointsMPH = pointsCompiledProgram.mintingPolicyHash;

// Construct the Points asset
const pointsTN = textToBytes("Points Token");
const pointsToken = [[pointsTN, BigInt(1)]];

// Compile the Rewards minting script
const rewardsScript = await fs.readFile('./contracts/rewards.hl', 'utf8');
const rewardsProgram = Program.new(rewardsScript);
rewardsProgram.parameters = {["VERSION"] : "1.0"};
rewardsProgram.parameters = {["OWNER_PKH"] : owner.pubKeyHash.hex};
const rewardsCompiledProgram = rewardsProgram.compile(optimize);
const rewardsMPH = rewardsCompiledProgram.mintingPolicyHash;

// Construct the Rewards asset
const rewardsTN =  textToBytes("Rewards Token");
const rewardsToken = [[rewardsTN, BigInt(1)]];

// Read in the user token minting script
const userTokenPolicyScript = await fs.readFile('./contracts/userTokenPolicy.hl', 'utf8');
const userTokenPolicyProgram = Program.new(userTokenPolicyScript);

// Read in the user token validator script
const userTokenValScript = await fs.readFile('./contracts/userTokenValidator.hl', 'utf8');
const userTokenValProgram = Program.new(userTokenValScript);

/**
 * Throws an error if 'cond' is false.
 * @package
 * @param {boolean} cond 
 * @param {string} msg 
 */
function assert(cond, msg = "assertion failed") {
	if (!cond) {
		throw new Error(msg);
	}
}

/**
 * Prints out the UTXOs for the buyer and seller wallets
 * @package
 */
const showWalletUTXOs = async (name, wallet) => {

     // Get the UTxOs in Buyer & Seller Wallets
     const utxos = await network.getUtxos(wallet.address);

     console.log("");
     console.log(name + " Wallet UTXOs:");
     console.log("-------------");
     for (const utxo of utxos) {
         console.log("txId", utxo.txId.hex + "#" + utxo.utxoIdx);
         console.log("value", utxo.value.dump());
     }
}

/**
 * Prints out the UTXOs at the swap script address
 * @param {SwapConfig} swapConfig
 * @package
 */
const showSwapScriptUTXOs = async (swapConfig) => {

    swapProgram.parameters = {["VERSION"] : swapConfig.version};
    swapProgram.parameters = {["ASKED_MPH"] : swapConfig.askedMPH};
    swapProgram.parameters = {["ASKED_TN"] : swapConfig.askedTN};
    swapProgram.parameters = {["OFFERED_MPH"] : swapConfig.offeredMPH};
    swapProgram.parameters = {["OFFERED_TN"] : swapConfig.offeredTN};
    swapProgram.parameters = {["BEACON_MPH"] : swapConfig.beaconMPH};
    swapProgram.parameters = {["SELLER_PKH"] : swapConfig.sellerPkh};
    swapProgram.parameters = {["ESCROW_ENABLED"] : swapConfig.escrowEnabled};
    swapProgram.parameters = {["ESCROW_HASH"] : swapConfig.escrowHash};
    swapProgram.parameters = {["USER_TOKEN_MPH"] : swapConfig.userTokenMPH};
    swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapConfig.userTokenVHash};
    swapProgram.parameters = {["SERVICE_FEE"] : swapConfig.serviceFee};
    swapProgram.parameters = {["OWNER_PKH"] : swapConfig.ownerPkh};
    swapProgram.parameters = {["MIN_ADA"] : swapConfig.minAda};
    swapProgram.parameters = {["DEPOSIT_ADA"] : swapConfig.depositAda};
    const swapCompiledProgram = swapProgram.compile(optimize);

    const swapScriptAddr = Address.fromHashes(swapCompiledProgram.validatorHash);
    const swapUtxos = await network.getUtxos(swapScriptAddr);
    console.log("");
    console.log("Swap Script Hash: ", swapCompiledProgram.validatorHash.hex);
    console.log("Swap Script UTXOs:");
    console.log("------------------");
    for (const utxo of swapUtxos) {
        console.log("txId", utxo.txId.hex + "#" + utxo.utxoIdx);
        console.log("value", utxo.value.dump());
        if (utxo.origOutput.datum) {
            console.log("datum", utxo.origOutput.datum.data.toSchemaJson());
        }
    }
}

/**
 * Prints out the UTXOs at the swap script address
 * @param {SwapConfig} swapConfig
 * @package
 */
const showEscrowScriptUTXOs = async (escrowConfig) => {

    escrowProgram.parameters = {["VERSION"] : escrowConfig.version};
    escrowProgram.parameters = {["BUYER_PKH"] : escrowConfig.buyerPkh};
    escrowProgram.parameters = {["SELLER_PKH"] : escrowConfig.sellerPkh};
    escrowProgram.parameters = {["OWNER_PKH"] : escrowConfig.ownerPkh};
    const escrowCompiledProgram = escrowProgram.compile(optimize);

    const escrowUtxos = await network.getUtxos(Address.fromHashes(escrowCompiledProgram.validatorHash));
    console.log("");
    console.log("Escrow Script UTXOs:");
    console.log("------------------");
    for (const utxo of escrowUtxos) {
        console.log("txId", utxo.txId.hex + "#" + utxo.utxoIdx);
        console.log("value", utxo.value.dump());
        if (utxo.origOutput.datum) {
            console.log("datum", utxo.origOutput.datum.data.toSchemaJson());
        }
    }
}


/**
 * Prints out the UTXOs at the swap script address
 * @param {Address} address
 * @param {string} name
 * @package
 */
const showScriptUTXOs = async (address, name) => {

    const utxos = await network.getUtxos(address);
    console.log("");
    console.log(name + " Script UTXOs:");
    console.log("------------------");
    for (const utxo of utxos) {
        console.log("txId", utxo.txId.hex + "#" + utxo.utxoIdx);
        console.log("value", utxo.value.dump());
        if (utxo.origOutput.datum) {
            console.log("datum", utxo.origOutput.datum.data.toSchemaJson());
        }
    }
}

/**
 * Get the UTXO at the swap address which contains the beacon token
 * @package
 * @param {SwapConfig} swapConfig
 * @returns {UTxO} 
 */
const getSwapUTXO = async (swapConfig) => {

    swapProgram.parameters = {["VERSION"] : swapConfig.version};
    swapProgram.parameters = {["ASKED_MPH"] : swapConfig.askedMPH};
    swapProgram.parameters = {["ASKED_TN"] : swapConfig.askedTN};
    swapProgram.parameters = {["OFFERED_MPH"] : swapConfig.offeredMPH};
    swapProgram.parameters = {["OFFERED_TN"] : swapConfig.offeredTN};
    swapProgram.parameters = {["BEACON_MPH"] : swapConfig.beaconMPH};
    swapProgram.parameters = {["SELLER_PKH"] : swapConfig.sellerPkh};
    swapProgram.parameters = {["ESCROW_ENABLED"] : swapConfig.escrowEnabled};
    swapProgram.parameters = {["ESCROW_HASH"] : swapConfig.escrowHash};
    swapProgram.parameters = {["USER_TOKEN_MPH"] : swapConfig.userTokenMPH};
    swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapConfig.userTokenVHash};
    swapProgram.parameters = {["SERVICE_FEE"] : swapConfig.serviceFee};
    swapProgram.parameters = {["OWNER_PKH"] : swapConfig.ownerPkh};
    swapProgram.parameters = {["MIN_ADA"] : swapConfig.minAda};
    swapProgram.parameters = {["DEPOSIT_ADA"] : swapConfig.depositAda};
    const swapCompiledProgram = swapProgram.compile(optimize);

    const swapUtxos = await network.getUtxos(Address.fromHashes(swapCompiledProgram.validatorHash));
    for (const utxo of swapUtxos) {
        // only one UTXO with beacon token should exist
        if (utxo.value.assets.mintingPolicies.includes(beaconMPH)) { 
            console.log("");
            console.log("getSwapUTXO: UTXO with beacon found");
            return utxo;
        }
    }
}

/**
 * Get the UTXO at the escrow address
 * @package
 * @param {PubKeyHash} buyerPkh
 * @param {PubKeyHash} sellerPkh
 * @param {string} orderId 
 * @returns {UTxO}
 */
const getEscrowUTXO = async (orderId, buyerPkh, sellerPkh, escrowConfig) => {

    console.log("getEscrowUTXO: ", escrowConfig);
    escrowProgram.parameters = {["VERSION"] : escrowConfig.version};
    escrowProgram.parameters = {["BUYER_PKH"] : escrowConfig.buyerPkh};
    escrowProgram.parameters = {["SELLER_PKH"] : escrowConfig.sellerPkh};
    escrowProgram.parameters = {["OWNER_PKH"] : escrowConfig.ownerPkh};
    
    const escrowCompiledProgram = escrowProgram.compile(optimize);
    const escrowUtxos = await network.getUtxos(Address.fromHashes(escrowCompiledProgram.validatorHash));
    for (const utxo of escrowUtxos) {

        // only one UTXO with orderId, buyerPkh & sellerPkh should exist
        if (ByteArray.fromUplcData(utxo.origOutput.datum.data.list[3]).hex === (new ByteArray(orderId).hex) &&
            PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[0]).hex === buyerPkh.hex &&
            PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[6]).hex === sellerPkh.hex) { 
            console.log("");
            console.log("getEscrowUTXO: UTXO with order found");
            return utxo;
        }
    }
}

/**
 * Get the UTXO at the reference user token validator script
 * @package
 * @param {string} sellerTokenMPH
 * @param {string} sellerTokenTN
 * @returns {UTxO}
 */
const getRefTokenUTXO = async (user, userTokenMPH, userTokenTN, minAda) => {

    const userToken = [[textToBytes(userTokenTN), BigInt(1)]];
    const userTokenAsset = new Assets([[MintingPolicyHash.fromHex(userTokenMPH), userToken]]);
    const userTokenValue = new Value(BigInt(minAda), userTokenAsset);
    
    // Compile the user token validator script
    userTokenValProgram.parameters = {["VERSION"] : "1.0"};
    userTokenValProgram.parameters = {["USER_PKH"] : user.pubKeyHash.hex};
    userTokenValProgram.parameters = {["OWNER_PKH"] : owner.pubKeyHash.hex};
    
    const userTokenValCompiledProgram = userTokenValProgram.compile(optimize);  
    const userTokenValHash = userTokenValCompiledProgram.validatorHash;

    const userTokenUtxos = await network.getUtxos(Address.fromHashes(userTokenValHash));
    for (const utxo of userTokenUtxos) {
 
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
        }
    }
}

/**
 * Obtain the 1st minting policy hash, token name and qty from a value.
 * @package
 * @param {Value} value
 * @return {{mph: string, tn: string, qty: bigint}}
 */
const getMphTnQty = async (value) => {

    const valueMP = value.assets.mintingPolicies;

    // Check if the askedAsset is lovelace
    if (valueMP.length == 0) {
        return {
            mph: "",
            tn: "",
            qty: value.lovelace
        }
    } else { 
        // The askedAsset is a native token and should only contain 1 MPH
        assert(value.assets.mintingPolicies.length == 1);
        const valueMPH = value.assets.mintingPolicies[0];
        const valueTN = value.assets.getTokenNames(valueMPH)[0];
        const valueQty = value.assets.get(valueMPH, valueTN);

        return {
            mph: valueMPH.hex,
            tn: bytesToHex(valueTN),
            qty: valueQty
        }
    }
}

/**
 * Determine the quantity of a product a buyer can purchase
 * given the amount he is willing to pay.
 * @package
 * @param {UTxO, number} utxo
 * @param {UTxO, Value} swapAskedAssetValue
 * @returns {{askedAssetVal: Value, 
 *            buyAssetVal: Value,
 *            offeredAssetVal: Value,
 *            changeAssetVal: Value}} 
 */
const calcOrderDetails = async (utxo, swapAskedAssetValue) => {

    // swapAskedAssetValue can't have any negative values
    swapAskedAssetValue.assertAllPositive();

    // Get Values from the swap datum
    const askedAssetValue = Value.fromUplcData(utxo.origOutput.datum.data.list[0]);
    const offeredAssetValue = Value.fromUplcData(utxo.origOutput.datum.data.list[1]);

    const askedAssetMP = askedAssetValue.assets.mintingPolicies;
    var askedAssetMPH;
    var askedAssetTN;
    var askedAssetQty;

    // Check if the askedAsset is lovelace
    if (askedAssetMP.length == 0) {
        askedAssetMPH = askedAssetValue.assets.mintingPolicies;
        askedAssetTN = askedAssetValue.assets.getTokenNames(askedAssetMPH);
        askedAssetQty = askedAssetValue.lovelace;
    } else { 
        // The askedAsset is a native token and should only contain 1 MPH
        assert(askedAssetValue.assets.mintingPolicies.length == 1);
        askedAssetMPH = askedAssetValue.assets.mintingPolicies[0];
        askedAssetTN = askedAssetValue.assets.getTokenNames(askedAssetMPH)[0];
        askedAssetQty = askedAssetValue.assets.get(askedAssetMPH, askedAssetTN);
    }

    const offeredAssetMP = offeredAssetValue.assets.mintingPolicies;
    var offeredAssetMPH;
    var offeredAssetTN;
    var offeredAssetQty;

    // Check if the offeredAsset is lovelace
    if (offeredAssetMP.length == 0) {
        offeredAssetMPH = offeredAssetValue.assets.mintingPolicies;
        offeredAssetTN = offeredAssetValue.assets.getTokenNames(askedAssetMPH);
        offeredAssetQty = offeredAssetValue.lovelace;
    } else { 
        // The offeredAsset is a native token and should only contain 1 MPH
        assert(offeredAssetValue.assets.mintingPolicies.length == 1);
        offeredAssetMPH = offeredAssetValue.assets.mintingPolicies[0];
        offeredAssetTN = offeredAssetValue.assets.getTokenNames(offeredAssetMPH)[0];
        offeredAssetQty = offeredAssetValue.assets.get(offeredAssetMPH, offeredAssetTN);
    }

    const swapAskedAssetMP = swapAskedAssetValue.assets.mintingPolicies;
    var swapAskedAssetMPH;
    var swapAskedAssetTN;
    var swapAskedAssetQty;

    // Check if the swapAskedAsset is lovelace
    if (swapAskedAssetMP.length == 0) {
        swapAskedAssetMPH = swapAskedAssetValue.assets.mintingPolicies;
        swapAskedAssetTN = swapAskedAssetValue.assets.getTokenNames(askedAssetMPH);
        swapAskedAssetQty = swapAskedAssetValue.lovelace;
    } else { 
        // The swapAskedAsset is a native token and should only contain 1 MPH
        assert(swapAskedAssetValue.assets.mintingPolicies.length == 1);
        swapAskedAssetMPH = swapAskedAssetValue.assets.mintingPolicies[0];
        swapAskedAssetTN = swapAskedAssetValue.assets.getTokenNames(swapAskedAssetMPH)[0];
        swapAskedAssetQty = swapAskedAssetValue.assets.get(swapAskedAssetMPH, swapAskedAssetTN);
    }

    // Check that the askedAssets match
    if (askedAssetMPH.hex === swapAskedAssetMPH.hex &&
        bytesToHex(askedAssetTN) === bytesToHex(swapAskedAssetTN)) {
        console.log("");
        console.log("calcQtyToBuy: swap assets match");
    } else {
        throw console.error("calcQtyToBuy: swap assets don't match")
    }

    var qtyToBuy;
    var qtyRemainder;
    var changeAmt;
    
    const price = askedAssetQty;
    const qty = offeredAssetQty;
    const spendAmt = swapAskedAssetQty;
    const diff = spendAmt - price * qty; 

    assert(price > 0); // price must be greater than zero
    const orderAmt = spendAmt / price;  
    if (orderAmt < 1) {
        throw console.error("calcRemainder: insufficient funds")
    } else if (diff >= 0) { 
        qtyToBuy = qty;  // can purchase all available qty
        qtyRemainder = 0;
        changeAmt = spendAmt - qtyToBuy * price; // return the change to the buyer
    } else {
        qtyToBuy = orderAmt; 
        qtyRemainder = qty - orderAmt;  // calc the remaining qty at the utxo
        changeAmt = spendAmt - qtyToBuy * price; // return the change to the buyer
    }
    
    // If the change amount is too small to be sent back as change,
    // then just included it as part of the overall cost to avoid
    // sending back change to the buyer's wallet
    if (swapAskedAssetMP.length == 0) {
        // Check if the swapAskedAsset is lovelace
        if (changeAmt < minChangeAda) {
            changeAmt = 0;
        }
    } else if (changeAmt < 1) {
        changeAmt = 0;  
    } 
    
    // Create the updated offeredAsset
    const updatedOfferedAsset = new Assets();
    updatedOfferedAsset.addComponent(
        offeredAssetMPH,
        offeredAssetTN,
        BigInt(qtyRemainder)
    );
    const updatedOfferAssetValue = new Value(BigInt(0), updatedOfferedAsset);

    // Create the offeredAsset that is being bought
    const buyOfferedAsset = new Assets();
    buyOfferedAsset.addComponent(
        offeredAssetMPH,
        offeredAssetTN,
        BigInt(qtyToBuy)
    );
    const buyOfferAssetValue = new Value(BigInt(0), buyOfferedAsset);

    // Create the change for the asked asset
    var noChangeAmt;
    var changeAskedAssetValue;
    if (changeAmt == 0) {
        noChangeAmt = true;
    } else {
        noChangeAmt = false;
    }
    if (swapAskedAssetMP.length == 0) {
        // Change is in lovelace
        changeAskedAssetValue = new Value(changeAmt);
    } else {
        // Change is a native asset
        const changeAskedAsset = new Assets();
        changeAskedAsset.addComponent(
            askedAssetMPH,
            askedAssetTN,
            BigInt(changeAmt)
        );
        changeAskedAssetValue = new Value(BigInt(0), changeAskedAsset);
    }  

    const orderInfo = { 
        askedAssetVal: askedAssetValue,
        buyAssetVal: buyOfferAssetValue,
        offeredAssetVal: updatedOfferAssetValue,
        changeAssetVal: changeAskedAssetValue,
        noChange: noChangeAmt,
    }
    return orderInfo
}

/**
 * Return the askedAsset and offeredAsset inline Datum info.
 * @package
 * @param {UTxO, number} utxo
 * @returns {{askedAssetValue: Value, offeredAssetValue: Value}}
 */
const getSwapDatumInfo = async (utxo) => {

    const datumInfo = {
        askedAssetValue: Value.fromUplcData(utxo.origOutput.datum.data.list[0]),
        offeredAssetValue: Value.fromUplcData(utxo.origOutput.datum.data.list[1])
    }
    return datumInfo
}

/**
 * Return the datum info attached to the UTXO locked at escrow contract
 * @package
 * @param {UTxO} utxo
 * @returns {{  buyerPkh: PubKeyHash,
 *              buyerTokenId: number,
 *              depositVal: Value,
 *              orderId: ByteArray,
 *              orderVal: Value,
 *              productVal: Value,
 *              sellerPkh: PubKeyHash,
 *              sellerTokenId: number}} 
 */
const getEscrowDatumInfo = async (utxo) => {

    const datumInfo = {
        
        buyerPkh: PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[0]),
        buyerTokenId: utxo.origOutput.datum.data.list[1],
        depositVal: Value.fromUplcData(utxo.origOutput.datum.data.list[2]),
        orderId: ByteArray.fromUplcData(utxo.origOutput.datum.data.list[3]),
        orderVal: Value.fromUplcData(utxo.origOutput.datum.data.list[4]),
        productVal: Value.fromUplcData(utxo.origOutput.datum.data.list[5]),
        sellerPkh: PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[6]),
        sellerTokenId: utxo.origOutput.datum.data.list[7]
    }
    return datumInfo
}


/**
 * Mint user tokens including the reference token
 * @package
 * @param {WalletEmulator} user
 * @param {number} qty
 */
const mintUserTokens = async (user, minAda) => {

    try {
        console.log("");
        console.log("************ MINT USER TOKENS ************");
        console.log("************ PRE-TEST *************");
        await showWalletUTXOs("User", user);

        // Compile the user token validator script
        userTokenValProgram.parameters = {["VERSION"] : "1.0"};
        userTokenValProgram.parameters = {["USER_PKH"] : user.pubKeyHash.hex};
        userTokenValProgram.parameters = {["OWNER_PKH"] : owner.pubKeyHash.hex};
        const userTokenValCompiledProgram = userTokenValProgram.compile(optimize);  
        const userTokenValHash = userTokenValCompiledProgram.validatorHash;

        // Compile the user token policy script
        userTokenPolicyProgram.parameters = {["VERSION"] : "1.0"};
        userTokenPolicyProgram.parameters = {["OWNER_PKH"] : owner.pubKeyHash.hex};
        userTokenPolicyProgram.parameters = {["MIN_ADA"] : minAda};
        const userTokenPolicyCompiledProgram = userTokenPolicyProgram.compile(optimize);  
        const userTokenMPH = userTokenPolicyCompiledProgram.mintingPolicyHash;

        // Get the UTxOs in User wallet
        const utxosUser = await network.getUtxos(user.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the user UTXOs as inputs
        tx.addInputs(utxosUser);

        // Add the user token policy script as a witness to the transaction
        tx.attachScript(userTokenPolicyCompiledProgram);

        // Construct the time validity interval
        const slot = networkParams.liveSlot;
        const time = networkParams.slotToTime(slot);
        console.log("slot: ", slot);
        console.log("time: ", time);

        const now = new Date(Number(time));
        const before = new Date(now.getTime());
        before.setMinutes(now.getMinutes() - 5);
        const after = new Date(now.getTime());
        after.setMinutes(now.getMinutes() + 5);
        const userTokenTN = textToBytes("User Token|" + now.getTime().toString());

        // Create the user token and reference token
        const userTokens = [[userTokenTN, BigInt(2)]];

        // Create the user token poicy redeemer 
        const userTokenPolicyRedeemer = (new userTokenPolicyProgram
            .types.Redeemer
            .Mint(userTokenTN))
            ._toUplcData();
        
        // Add the mint to the tx
        tx.mintTokens(
            userTokenMPH,
            userTokens,
            userTokenPolicyRedeemer
        )

        // Create the user token
        const userToken = [[userTokenTN, BigInt(1)]];
        const userTokenAsset = new Assets([[userTokenMPH, userToken]]);
        const userTokenValue = new Value(minAda, userTokenAsset);
        console.log("userTokenValue: ", userTokenValue.toSchemaJson());

        // Construct the reference token datum
        const userTokenDatum = new (userTokenValProgram.types.Datum)(
            user.pubKeyHash
          )
        
        // Create the output for the reference user token
        tx.addOutput(new TxOutput(
            Address.fromHashes(userTokenValHash),
            userTokenValue,
            Datum.inline(userTokenDatum)
        ));
        
        // Create the output for the user token
        tx.addOutput(new TxOutput(
            user.address,
            userTokenValue
        ));

        // Set a valid time interval
        tx.validFrom(before);
        tx.validTo(after);

        // Add app wallet & user pkh as a signer which is required to mint user token
        tx.addSigner(user.pubKeyHash);
        tx.addSigner(owner.pubKeyHash);

        console.log("");
        console.log("************ EXECUTE USER TOKEN MINTING CONTRACT ************");
        await tx.finalize(networkParams, user.address, utxosUser);
        console.log("Tx Fee", tx.body.fee);
        console.log("Tx Execution Units", tx.witnesses.dump().redeemers);

        // Sign tx with user signature
        const signatureUserWallet = await user.signTx(tx);
        tx.addSignatures(signatureUserWallet);

        // Sign tx with owner signature
        const signatureAppWallet = await owner.signTx(tx);
        tx.addSignatures(signatureAppWallet);

        console.log("");
        console.log("************ SUBMIT TX ************");

        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs("User", user);
        await showScriptUTXOs(Address.fromHashes(userTokenValHash), "User Token");
        return {
            mph: userTokenMPH.hex,
            tn: bytesToText(userTokenTN),
            vHash: userTokenValHash.hex
        }

    } catch (err) {
        console.error("mintUserToken tx failed", err);
        return false;
    }
}

/**
 * Initialize the swap smart contract and mint a beacon token.
 * @package
 * @param {Value} askedAssetValue
 * @param {Value} offeredAssetValue
 */
const openSwap = async (buyer, seller, askedAssetValue, offeredAssetValue, swapConfig, sellerTokenTN) => {

    try {
        console.log("");
        console.log("************ INIT SWAP ************");
        console.log("************ PRE-TEST *************");
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);

        // Compile the swap script
        swapProgram.parameters = {["VERSION"] : swapConfig.version};
        swapProgram.parameters = {["ASKED_MPH"] : swapConfig.askedMPH};
        swapProgram.parameters = {["ASKED_TN"] : swapConfig.askedTN};
        swapProgram.parameters = {["OFFERED_MPH"] : swapConfig.offeredMPH};
        swapProgram.parameters = {["OFFERED_TN"] : swapConfig.offeredTN};
        swapProgram.parameters = {["BEACON_MPH"] : swapConfig.beaconMPH};
        swapProgram.parameters = {["SELLER_PKH"] : swapConfig.sellerPkh};
        swapProgram.parameters = {["ESCROW_ENABLED"] : swapConfig.escrowEnabled};
        swapProgram.parameters = {["ESCROW_HASH"] : swapConfig.escrowHash};
        swapProgram.parameters = {["USER_TOKEN_MPH"] : swapConfig.userTokenMPH};
        swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapConfig.userTokenVHash};
        swapProgram.parameters = {["SERVICE_FEE"] : swapConfig.serviceFee};
        swapProgram.parameters = {["OWNER_PKH"] : swapConfig.ownerPkh};
        swapProgram.parameters = {["MIN_ADA"] : swapConfig.minAda};
        swapProgram.parameters = {["DEPOSIT_ADA"] : swapConfig.depositAda};
        const swapCompiledProgram = swapProgram.compile(optimize);  

        console.log("swapAdaEscrow: ", swapConfig);
        
        // Now we are able to get the UTxOs in Buyer & Seller Wallets
        const utxosSeller = await network.getUtxos(seller.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Seller UTXOs as inputs
        tx.addInputs(utxosSeller);

        // Add the beacon minting script as a witness to the transaction
        tx.attachScript(beaconCompiledProgram);

        // Create an Beacon Minting Init Redeemer because we must always send a Redeemer with
        // a plutus script transaction even if we don't actually use it.
        const beaconRedeemer = (new beaconProgram.types.Redeemer.Mint())._toUplcData();

        // Construct the Beacon asset & value
        const beaconTN = swapCompiledProgram.validatorHash.hex;
        const beaconToken = [[hexToBytes(beaconTN), BigInt(1)]];
        const beaconAsset = new Assets([[beaconMPH, beaconToken]]);
        const beaconValue = new Value(BigInt(0), beaconAsset);
        
        // Add the mint to the tx
        tx.mintTokens(
            beaconMPH,
            beaconToken,
            beaconRedeemer
        )

        // Construct the Seller Token value
        const sellerToken = [[textToBytes(sellerTokenTN), BigInt(1)]];
        const sellerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapConfig.userTokenMPH), sellerToken]]);
        const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);
        
        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            askedAssetValue,
            offeredAssetValue
          )
        
        // Attach the output with product asset, beacon token
        // and the swap datum to the swap script address
        const swapValue = (new Value(swapConfig.minAda))
                            .add(offeredAssetValue)
                            .add(beaconValue)
                            .add(sellerTokenValue);
    
        console.log("openSwap: swapValue: ", swapValue.toSchemaJson());
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum)
        ));

        // Construct the time validity interval
        const slot = networkParams.liveSlot;
        const time = networkParams.slotToTime(slot);
        const now = new Date(Number(time));
        const before = new Date(now.getTime());
        before.setMinutes(now.getMinutes() - 5);
        const after = new Date(now.getTime());
        after.setMinutes(now.getMinutes() + 5);
   
        // Set a valid time interval
        tx.validFrom(before);
        tx.validTo(after);

        // Add app wallet pkh as a signer which is required to mint beacon
        tx.addSigner(owner.pubKeyHash);

        console.log("");
        console.log("************ EXECUTE BEACON MINTING CONTRACT ************");
        await tx.finalize(networkParams, seller.address, utxosSeller);
        console.log("Tx Fee", tx.body.fee);
        console.log("Tx Execution Units", tx.witnesses.dump().redeemers);

        // Sign tx with owner signature
        const signatureAppWallet = await owner.signTx(tx);
        tx.addSignatures(signatureAppWallet);

        console.log("");
        console.log("************ SUBMIT TX ************");
        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showSwapScriptUTXOs(swapConfig);
        return true;

    } catch (err) {
        console.error("openSwap tx failed", err);
        return false;
    }
}

/**
 * Update swap askedAsset and/or offeredAsset
 * @package
 * @param {Value} askedAssetValue
 * @param {Value} offeredAssetValue
 */
const updateSwap = async (buyer, seller, askedAssetValue, offeredAssetValue, swapConfig, sellerTokenTN) => {
    
    try {
        console.log("");
        console.log("************ EXECUTE UPDATE SWAP ************");
        console.log("***************** PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showSwapScriptUTXOs(swapConfig);

        // Compile the swap script
        swapProgram.parameters = {["VERSION"] : swapConfig.version};
        swapProgram.parameters = {["ASKED_MPH"] : swapConfig.askedMPH};
        swapProgram.parameters = {["ASKED_TN"] : swapConfig.askedTN};
        swapProgram.parameters = {["OFFERED_MPH"] : swapConfig.offeredMPH};
        swapProgram.parameters = {["OFFERED_TN"] : swapConfig.offeredTN};
        swapProgram.parameters = {["BEACON_MPH"] : swapConfig.beaconMPH};
        swapProgram.parameters = {["SELLER_PKH"] : swapConfig.sellerPkh};
        swapProgram.parameters = {["ESCROW_ENABLED"] : swapConfig.escrowEnabled};
        swapProgram.parameters = {["ESCROW_HASH"] : swapConfig.escrowHash};
        swapProgram.parameters = {["USER_TOKEN_MPH"] : swapConfig.userTokenMPH};
        swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapConfig.userTokenVHash};
        swapProgram.parameters = {["SERVICE_FEE"] : swapConfig.serviceFee};
        swapProgram.parameters = {["OWNER_PKH"] : swapConfig.ownerPkh};
        swapProgram.parameters = {["MIN_ADA"] : swapConfig.minAda};
        swapProgram.parameters = {["DEPOSIT_ADA"] : swapConfig.depositAda};
        const swapCompiledProgram = swapProgram.compile(optimize);  

        console.log("swapAdaEscrow: ", swapConfig);

        // Get the UTxOs in Seller Wallet
        const utxosSeller = await network.getUtxos(seller.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Seller UTXOs as inputs
        tx.addInputs(utxosSeller);

        // Add the script as a witness to the transaction
        tx.attachScript(swapCompiledProgram);

        // Create the swap redeemer
        const swapRedeemer = (new swapProgram.types.Redeemer
                                .Update(textToBytes(sellerTokenTN))
                             )._toUplcData();
        
        // Get the UTXO that has the swap datum
        const swapUtxo = await getSwapUTXO(swapConfig);
        tx.addInput(swapUtxo, swapRedeemer);  
        
        // Get the qty of the offeredAssetValue from the datum
        const datumInfo = await getSwapDatumInfo(swapUtxo);

        // Now calculate the new updated offerAssetValue
        const updatedOfferedAssetValue = datumInfo.offeredAssetValue
                                                  .add(offeredAssetValue);
        
        // Confirm that the updated offeredAssetValue is positive
        updatedOfferedAssetValue.assertAllPositive();

        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            askedAssetValue,
            updatedOfferedAssetValue
          )

        // Construct the Beacon value
        const beaconTN = swapCompiledProgram.validatorHash.hex;
        const beaconToken = [[hexToBytes(beaconTN), BigInt(1)]];
        const beaconAsset = new Assets([[beaconMPH, beaconToken]]);
        const beaconValue = new Value(BigInt(0), beaconAsset);

        // Construct the Seller Token value
        const sellerToken = [[textToBytes(sellerTokenTN), BigInt(1)]];
        const sellerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapConfig.userTokenMPH), sellerToken]]);
        const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);
        
        const swapValue = (new Value(swapConfig.minAda))
                            .add(updatedOfferedAssetValue)
                            .add(beaconValue)
                            .add(sellerTokenValue);

        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum)
        ));

        // Construct the time validity interval
        const slot = networkParams.liveSlot;
        const time = networkParams.slotToTime(slot);
        const now = new Date(Number(time));
        const before = new Date(now.getTime());
        before.setMinutes(now.getMinutes() - 5);
        const after = new Date(now.getTime());
        after.setMinutes(now.getMinutes() + 5);
   
        // Set a valid time interval
        tx.validFrom(before);
        tx.validTo(after);

        // Add seller wallet pkh as a signer which is required for an update
        tx.addSigner(seller.pubKeyHash);

        console.log("");
        console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
        await tx.finalize(networkParams, seller.address, utxosSeller);
        console.log("Tx Fee", tx.body.fee);
        console.log("Tx Execution Units", tx.witnesses.dump().redeemers);

        // Sign tx with sellers signature
        const signatures = await seller.signTx(tx);
        tx.addSignatures(signatures);

        console.log("");
        console.log("************ SUBMIT TX ************");
        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showSwapScriptUTXOs(swapConfig);
        return true;

    } catch (err) {
        console.error("updateSwap tx failed", err);
        return false;
    }
}

/**
 * Execute a swap with a given amount
 * @package
 * @param {Value} swapAskedAssetValue
 */
const assetSwap = async (buyer, seller, swapAskedAssetValue, swapConfig, sellerTokenTN, buyerTokenTN) => {

    try {
        console.log("");
        console.log("************ EXECUTE ASSET SWAP ************");
        console.log("***************** PRE-TEST *****************");

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showWalletUTXOs("Owner", owner);
        await showSwapScriptUTXOs(swapConfig);

        // Compile the swap script
        swapProgram.parameters = {["VERSION"] : swapConfig.version};
        swapProgram.parameters = {["ASKED_MPH"] : swapConfig.askedMPH};
        swapProgram.parameters = {["ASKED_TN"] : swapConfig.askedTN};
        swapProgram.parameters = {["OFFERED_MPH"] : swapConfig.offeredMPH};
        swapProgram.parameters = {["OFFERED_TN"] : swapConfig.offeredTN};
        swapProgram.parameters = {["BEACON_MPH"] : swapConfig.beaconMPH};
        swapProgram.parameters = {["SELLER_PKH"] : swapConfig.sellerPkh};
        swapProgram.parameters = {["ESCROW_ENABLED"] : swapConfig.escrowEnabled};
        swapProgram.parameters = {["ESCROW_HASH"] : swapConfig.escrowHash};
        swapProgram.parameters = {["USER_TOKEN_MPH"] : swapConfig.userTokenMPH};
        swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapConfig.userTokenVHash};
        swapProgram.parameters = {["SERVICE_FEE"] : swapConfig.serviceFee};
        swapProgram.parameters = {["OWNER_PKH"] : swapConfig.ownerPkh};
        swapProgram.parameters = {["MIN_ADA"] : swapConfig.minAda};
        swapProgram.parameters = {["DEPOSIT_ADA"] : swapConfig.depositAda};
        const swapCompiledProgram = swapProgram.compile(optimize); 
        
        // Now we are able to get the UTxOs in Buyer & Seller Wallets
        const utxosBuyer = await network.getUtxos(buyer.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Buyer UTXOs as inputs
        tx.addInputs(utxosBuyer);

        // Add the script as a witness to the transaction
        tx.attachScript(swapCompiledProgram);

        // Create the swap redeemer
        const swapRedeemer = (new swapProgram.types.Redeemer.Swap(buyer.pubKeyHash))._toUplcData();
        
        // Get the UTXO that has the swap datum
        const swapUtxo = await getSwapUTXO(swapConfig);
        tx.addInput(swapUtxo, swapRedeemer); 

        // Add the buyer & sell reference user tokens
        const buyerRefTokenUtxo = await getRefTokenUTXO(buyer, swapConfig.userTokenMPH, buyerTokenTN, swapConfig.minAda);
        tx.addRefInput(buyerRefTokenUtxo);
        const sellerRefTokenUtxo = await getRefTokenUTXO(seller, swapConfig.userTokenMPH, sellerTokenTN, swapConfig.minAda);
        tx.addRefInput(sellerRefTokenUtxo);
        
        // Calc the amount of products remaining
        const orderDetails = await calcOrderDetails(swapUtxo, swapAskedAssetValue);

        console.log("swapAsset: askedAssetVal", orderDetails.askedAssetVal.dump());
        console.log("swapAsset: buyAssetVal", orderDetails.buyAssetVal.dump());
        console.log("swapAsset: changeAssetVal", orderDetails.changeAssetVal.dump());
        console.log("swapAsset: offeredAssetVal", orderDetails.offeredAssetVal.dump());
        console.log("swapAsset: noChange", orderDetails.noChange);

        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            orderDetails.askedAssetVal,     // askedAsset
            orderDetails.offeredAssetVal    // offeredAsset
          )
        
        // Construct the Beacon asset
        const beaconTN = swapCompiledProgram.validatorHash.hex;
        const beaconToken = [[hexToBytes(beaconTN), BigInt(1)]];
        const beaconAsset = new Assets([[beaconMPH, beaconToken]]);
        const beaconValue = new Value(BigInt(0), beaconAsset);

        // Construct the Seller Token value
        const sellerToken = [[textToBytes(sellerTokenTN), BigInt(1)]];
        const sellerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapConfig.userTokenMPH), sellerToken]]);
        const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);
        
        const swapValue = (new Value(swapConfig.minAda))
                            .add(orderDetails.offeredAssetVal)
                            .add(beaconValue)
                            .add(sellerTokenValue);

        // Create the output that goes back to the swap address
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum._toUplcData())
        ));

        // Create the output to send the askedAsset to the seller address
        // and check if asked Asset is in lovelace
        if (swapAskedAssetValue.lovelace == 0) {
            if (orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    seller.address,
                    (new Value(swapConfig.minAda)).add(swapAskedAssetValue)
                ));
            } else {
                tx.addOutput(new TxOutput(
                    seller.address,
                    (new Value(swapConfig.minAda)).add(swapAskedAssetValue.sub(orderDetails.changeAssetVal))
                ));
            }
        } else {
            if (orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    seller.address,
                    swapAskedAssetValue
                ));
            } else {
                tx.addOutput(new TxOutput(
                    seller.address,
                    swapAskedAssetValue.sub(orderDetails.changeAssetVal)
                ));
            }
        }

        // Construct the Buyer Token value
        const buyerToken = [[textToBytes(buyerTokenTN), BigInt(1)]];
        const buyerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapConfig.userTokenMPH), buyerToken]]);
        const buyerTokenValue = new Value(BigInt(0), buyerTokenAsset);
        
        console.log("swapAsset:orderDetails.buyAssetVal: ", orderDetails.buyAssetVal.toSchemaJson());
        
        // Create the output that goes to the buyer
        tx.addOutput(new TxOutput(
            buyer.address,
            (new Value(swapConfig.minAda)).add(orderDetails.buyAssetVal).add(buyerTokenValue)
        ));

        // Create the output to send to the buyer address for the change
        if (orderDetails.changeAssetVal.lovelace == 0)
        {
            if (!orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    buyer.address,
                    (new Value(swapConfig.minAda)).add(orderDetails.changeAssetVal)
                ));
            }
        } else {
            if (!orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    buyer.address,
                    orderDetails.changeAssetVal
                ));
            }
        }

        // Create the output for the service fee
        tx.addOutput(new TxOutput(
            owner.address,
            new Value(BigInt(swapConfig.serviceFee))
        ));

        // Construct the time validity interval
        const slot = networkParams.liveSlot;
        const time = networkParams.slotToTime(slot);
        const now = new Date(Number(time));
        const before = new Date(now.getTime());
        before.setMinutes(now.getMinutes() - 5);
        const after = new Date(now.getTime());
        after.setMinutes(now.getMinutes() + 5);
   
        // Set a valid time interval
        tx.validFrom(before);
        tx.validTo(after);

        // Add buyer wallet pkh as a signer which is required for an update
        tx.addSigner(buyer.pubKeyHash);

        console.log("");
        console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
        
        await tx.finalize(networkParams, buyer.address, utxosBuyer);

        // Sign tx with buyers signature
        const signatures = await buyer.signTx(tx);
        tx.addSignatures(signatures);

        console.log("Tx Fee", tx.body.fee);
        console.log("Tx Execution Units", tx.witnesses.dump().redeemers);
        

        console.log("");
        console.log("************ SUBMIT TX ************");
        
        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showWalletUTXOs("Owner", owner);
        await showSwapScriptUTXOs(swapConfig);
        return true;

    } catch (err) {
        console.error("assetSwap tx failed", err);
        return false;
    }
}

/**
 * Execute a swap with a given amount using an escrow script
 * @package
 * @param {Value} swapAskedAssetValue
 */
const assetSwapEscrow = async (buyer, seller, swapAskedAssetValue, swapConfig, escrowConfig, sellerTokenTN, buyerTokenTN) => {

    try {
        console.log("");
        console.log("******* EXECUTE ASSET SWAP ESCROW **********");
        console.log("***************** PRE-TEST *****************");

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showWalletUTXOs("Owner", owner);
        await showSwapScriptUTXOs(swapConfig);
        await showEscrowScriptUTXOs(escrowConfig);

        // Compile the escrow script script
        escrowProgram.parameters = {["VERSION"] : escrowConfig.version};
        escrowProgram.parameters = {["BUYER_PKH"] : escrowConfig.buyerPkh};
        escrowProgram.parameters = {["SELLER_PKH"] : escrowConfig.sellerPkh};
        escrowProgram.parameters = {["OWNER_PKH"] : escrowConfig.ownerPkh};
        const escrowCompiledProgram = escrowProgram.compile(optimize);

        // Compile the swap script
        swapProgram.parameters = {["VERSION"] : swapConfig.version};
        swapProgram.parameters = {["ASKED_MPH"] : swapConfig.askedMPH};
        swapProgram.parameters = {["ASKED_TN"] : swapConfig.askedTN};
        swapProgram.parameters = {["OFFERED_MPH"] : swapConfig.offeredMPH};
        swapProgram.parameters = {["OFFERED_TN"] : swapConfig.offeredTN};
        swapProgram.parameters = {["BEACON_MPH"] : swapConfig.beaconMPH};
        swapProgram.parameters = {["SELLER_PKH"] : swapConfig.sellerPkh};
        swapProgram.parameters = {["ESCROW_ENABLED"] : swapConfig.escrowEnabled};
        swapProgram.parameters = {["ESCROW_HASH"] : swapConfig.escrowHash};
        swapProgram.parameters = {["USER_TOKEN_MPH"] : swapConfig.userTokenMPH};
        swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapConfig.userTokenVHash};
        swapProgram.parameters = {["SERVICE_FEE"] : swapConfig.serviceFee};
        swapProgram.parameters = {["OWNER_PKH"] : swapConfig.ownerPkh};
        swapProgram.parameters = {["MIN_ADA"] : swapConfig.minAda};
        swapProgram.parameters = {["DEPOSIT_ADA"] : swapConfig.depositAda};
        const swapCompiledProgram = swapProgram.compile(optimize); 

        console.log("swapAdaEscrow: ", swapConfig);
        console.log("swapAdaEscrow: ", escrowConfig);

        // Get the UTxOs in Buyer Wallets
        const utxosBuyer = await network.getUtxos(buyer.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Buyer UTXOs as inputs
        tx.addInputs(utxosBuyer);

        // Add the script as a witness to the transaction
        tx.attachScript(swapCompiledProgram);

        // Create the swap redeemer
        const swapRedeemer = (new swapProgram.types.Redeemer.Swap(buyer.pubKeyHash))._toUplcData();
        
        // Get the UTXO that has the swap datum
        const swapUtxo = await getSwapUTXO(swapConfig);
        tx.addInput(swapUtxo, swapRedeemer);   

        // Add the buyer & sell reference user tokens
        const buyerRefTokenUtxo = await getRefTokenUTXO(buyer, swapConfig.userTokenMPH, buyerTokenTN, swapConfig.minAda);
        tx.addRefInput(buyerRefTokenUtxo);
        const sellerRefTokenUtxo = await getRefTokenUTXO(seller, swapConfig.userTokenMPH, sellerTokenTN, swapConfig.minAda);
        tx.addRefInput(sellerRefTokenUtxo);
        
        // Calc the amount of products to buy
        const orderDetails = await calcOrderDetails(swapUtxo, swapAskedAssetValue);

        console.log("swapAsset: askedAssetVal", orderDetails.askedAssetVal.dump());
        console.log("swapAsset: buyAssetVal", orderDetails.buyAssetVal.dump());
        console.log("swapAsset: changeAssetVal", orderDetails.changeAssetVal.dump());
        console.log("swapAsset: offeredAssetVal", orderDetails.offeredAssetVal.dump());
        console.log("swapAsset: noChange", orderDetails.noChange);

        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            orderDetails.askedAssetVal,     // askedAsset
            orderDetails.offeredAssetVal    // offeredAsset
          )

        // Construct the Beacon asset
        const beaconTN = swapCompiledProgram.validatorHash.hex;
        const beaconToken = [[hexToBytes(beaconTN), BigInt(1)]];
        const beaconAsset = new Assets([[beaconMPH, beaconToken]]);
        const beaconValue = new Value(BigInt(0), beaconAsset);

        // Construct the Seller Token value
        const sellerToken = [[textToBytes(sellerTokenTN), BigInt(1)]];
        const sellerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapConfig.userTokenMPH), sellerToken]]);
        const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);
        
        const swapValue = (new Value(swapConfig.minAda))
                            .add(orderDetails.offeredAssetVal)
                            .add(beaconValue)
                            .add(sellerTokenValue);

        console.log("swapValue", swapValue.toSchemaJson());

        // Create the output that goes back to the swap address
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum._toUplcData())
        ));

        // Construct the Buyer Token value
        const buyerToken = [[textToBytes(buyerTokenTN), BigInt(1)]];
        const buyerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapConfig.userTokenMPH), buyerToken]]);
        const buyerTokenValue = new Value(BigInt(0), buyerTokenAsset);
 
        // Return the buyer token to the buyer
        tx.addOutput(new TxOutput(
            buyer.address,
            (new Value(swapConfig.minAda)).add(buyerTokenValue)
        ));

        // Create deposit value use for escrow
        const depositVal = new Value(BigInt(swapConfig.depositAda));
        
        // Use timestamp for order id for now
        const orderId = Date.now().toString();  
        
        var orderVal;
        if (orderDetails.noChange) {
            orderVal = swapAskedAssetValue;
        } else {
            orderVal = swapAskedAssetValue.sub(orderDetails.changeAssetVal);
        }

        // Construct the escrow datum
        const escrowDatum = new (escrowProgram.types.Datum)(
            buyer.pubKeyHash.hex,
            buyerTokenTN.split("|")[1], 
            depositVal,
            new ByteArray(orderId),
            orderVal,
            orderDetails.buyAssetVal,
            seller.pubKeyHash.hex,
            sellerTokenTN.split("|")[1]
            )

        // Create the output to send the askedAsset to the escrow address
        // Check if asked Asset is in lovelace
        if (swapAskedAssetValue.lovelace == 0) {
            if (orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(escrowCompiledProgram.validatorHash),
                    (new Value(swapConfig.minAda))
                        .add(swapAskedAssetValue)
                        .add(depositVal),
                    Datum.inline(escrowDatum._toUplcData()) 
                ));
            } else {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(escrowCompiledProgram.validatorHash),
                    (new Value(swapConfig.minAda))
                        .add(swapAskedAssetValue)
                        .sub(orderDetails.changeAssetVal)
                        .add(depositVal),
                    Datum.inline(escrowDatum._toUplcData())
                ));
            }
        } else {
            if (orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(escrowCompiledProgram.validatorHash),
                    swapAskedAssetValue.add(depositVal)
                                       .add(orderDetails.buyAssetVal),
                    Datum.inline(escrowDatum._toUplcData())
                ));
            } else {
                console.log("creating escrow output");
                tx.addOutput(new TxOutput(
                    Address.fromHashes(escrowCompiledProgram.validatorHash),
                    swapAskedAssetValue.sub(orderDetails.changeAssetVal)
                                       .add(depositVal)
                                       .add(orderDetails.buyAssetVal),
                    Datum.inline(escrowDatum._toUplcData())
                ));
            }
        }

        // Create the output to send to the buyer address for the change
        if (orderDetails.changeAssetVal.lovelace == 0)
        {
            if (!orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    buyer.address,
                    (new Value(swapConfig.minAda)).add(orderDetails.changeAssetVal)
                ));
            }
        } else {
            if (!orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    buyer.address,
                    orderDetails.changeAssetVal
                ));
            }
        }

        // Create the output for the service fee
        tx.addOutput(new TxOutput(
            owner.address,
            new Value(BigInt(swapConfig.serviceFee))
        ));

        // Construct the time validity interval
        const slot = networkParams.liveSlot;
        const time = networkParams.slotToTime(slot);
        const now = new Date(Number(time));
        const before = new Date(now.getTime());
        before.setMinutes(now.getMinutes() - 5);
        const after = new Date(now.getTime());
        after.setMinutes(now.getMinutes() + 5);
   
        // Set a valid time interval
        tx.validFrom(before);
        tx.validTo(after);

        // Add buyer wallet pkh as a signer which is required for an update
        tx.addSigner(buyer.pubKeyHash);

        console.log("");
        console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
        
        await tx.finalize(networkParams, buyer.address, utxosBuyer);
        console.log("Tx Fee", tx.body.fee);
        console.log("Tx Execution Units", tx.witnesses.dump().redeemers);

        // Sign tx with buyers signature
        const signatures = await buyer.signTx(tx);
        tx.addSignatures(signatures);

        console.log("");
        console.log("************ SUBMIT TX ************");
        
        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showSwapScriptUTXOs(swapConfig);
        await showEscrowScriptUTXOs(escrowConfig);
        return orderId;

    } catch (err) {
        console.error("assetSwapEscrow tx failed", err);
        return false;
    }
}

/**
 * Approve and release the order in the escrow smart contract
 * @package
 */
const approveEscrow = async (orderId, buyer, seller, escrowConfig) => {

    try {
        console.log("");
        console.log("************ EXECUTE APPROVE ESCROW ************");
        console.log("******************* PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showEscrowScriptUTXOs(escrowConfig);

        escrowProgram.parameters = {["VERSION"] : escrowConfig.version};
        escrowProgram.parameters = {["BUYER_PKH"] : escrowConfig.buyerPkh};
        escrowProgram.parameters = {["SELLER_PKH"] : escrowConfig.sellerPkh};
        escrowProgram.parameters = {["OWNER_PKH"] : escrowConfig.ownerPkh};
        const escrowCompiledProgram = escrowProgram.compile(optimize);

        // Get the UTxOs in Seller and Buyer Wallet
        const utxosSeller = await network.getUtxos(seller.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the script as a witness to the transaction
        tx.attachScript(escrowCompiledProgram);

        // Create the swap redeemer
        const escrowRedeemer = (new escrowProgram.types.Redeemer.Approve())._toUplcData();
        
        // Get the UTXO that has the swap datum
        const escrowUtxo = await getEscrowUTXO(orderId, buyer.pubKeyHash, seller.pubKeyHash, escrowConfig);
        tx.addInput(escrowUtxo, escrowRedeemer);  

        // Get the datum info from the UTXO locked at the escrow script address
        const escrowDatumInfo = await getEscrowDatumInfo(escrowUtxo);

        // Add the points minting script as a witness to the transaction
        tx.attachScript(pointsCompiledProgram);

        // Create a points minting policy redeemer
        const pointsRedeemer = (new pointsProgram.types.Redeemer.Mint())._toUplcData();

        // Add the points mint to the tx
        tx.mintTokens(
            pointsMPH,
            pointsToken,
            pointsRedeemer
        )

        // Create points asset to attached to a buyer output
        const pointsAsset = new Assets();
        pointsAsset.addComponent(
            pointsMPH,
            pointsTN,
            BigInt(1) // default to 1 point per tx for now
        );
        const pointsValue = new Value(BigInt(0), pointsAsset);

        // Create the output that will go to the buyer
        tx.addOutput(new TxOutput(
            buyer.address,
            escrowDatumInfo.depositVal.add(escrowDatumInfo.productVal).add(pointsValue)
        ));

        // Add the rewards minting script as a witness to the transaction
        tx.attachScript(rewardsCompiledProgram);

        // Create the rewards minting policy redeemer
        const rewardsRedeemer = (new rewardsProgram.types.Redeemer.Mint())._toUplcData();

        // Add the rewards mint to the tx
        tx.mintTokens(
            rewardsMPH,
            rewardsToken,
            rewardsRedeemer
        )
             
        // Create rewards asset to attached to a seller output
        const rewardsAsset = new Assets();
        rewardsAsset.addComponent(
            rewardsMPH,
            rewardsTN,
            BigInt(1) // default to 1 reward per tx for now
        );
        const rewardsValue = new Value(BigInt(0), rewardsAsset);

        // Create the output that will go to the seller
        tx.addOutput(new TxOutput(
            seller.address,
            escrowDatumInfo.orderVal.add(rewardsValue)
        ));

        // Construct the time validity interval
        const slot = networkParams.liveSlot;
        const time = networkParams.slotToTime(slot);
        const now = new Date(Number(time));
        const before = new Date(now.getTime());
        before.setMinutes(now.getMinutes() - 5);
        const after = new Date(now.getTime());
        after.setMinutes(now.getMinutes() + 5);
   
        // Set a valid time interval
        tx.validFrom(before);
        tx.validTo(after);

        // Add buyer signer which is required to approve the escrow
        tx.addSigner(seller.pubKeyHash);

        // Add buyer signer which is required to approve the escrow
        tx.addSigner(buyer.pubKeyHash);

        // Add owner signer which is required to approve the escrow
        tx.addSigner(owner.pubKeyHash);

        console.log("");
        console.log("************ EXECUTE ESCROW APPROVE CONTRACT ************");
        
        await tx.finalize(networkParams, seller.address, utxosSeller);
        console.log("Tx Fee", tx.body.fee);
        console.log("Tx Execution Units", tx.witnesses.dump().redeemers);

        // Sign tx with sellers signature
        const sellerSignatures = await seller.signTx(tx);
        tx.addSignatures(sellerSignatures);

        // Sign tx with buyers signature
        const buyerSignatures = await seller.signTx(tx);
        tx.addSignatures(buyerSignatures);

        // Sign tx with buyers signature
        const ownerSignatures = await owner.signTx(tx);
        tx.addSignatures(ownerSignatures);

        console.log("");
        console.log("************ SUBMIT TX ************");
        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs("Buyer", buyer);
        await showWalletUTXOs("Seller", seller);
        await showEscrowScriptUTXOs(escrowConfig);
        return true;

    } catch (err) {
        console.error("approveEscrow tx failed", err);
        return false;
    }
}

/**
 * Close a swap position
 * @package
 */
const closeSwap = async (seller, swapConfig, sellerTokenTN) => {

    try {
        console.log("");
        console.log("************ EXECUTE CLOSE SWAP ************");
        console.log("**************** PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs("Seller", seller);
        await showSwapScriptUTXOs(swapConfig);

        // Compile the swap script
        swapProgram.parameters = {["VERSION"] : swapConfig.version};
        swapProgram.parameters = {["ASKED_MPH"] : swapConfig.askedMPH};
        swapProgram.parameters = {["ASKED_TN"] : swapConfig.askedTN};
        swapProgram.parameters = {["OFFERED_MPH"] : swapConfig.offeredMPH};
        swapProgram.parameters = {["OFFERED_TN"] : swapConfig.offeredTN};
        swapProgram.parameters = {["BEACON_MPH"] : swapConfig.beaconMPH};
        swapProgram.parameters = {["SELLER_PKH"] : swapConfig.sellerPkh};
        swapProgram.parameters = {["ESCROW_ENABLED"] : swapConfig.escrowEnabled};
        swapProgram.parameters = {["ESCROW_HASH"] : swapConfig.escrowHash};
        swapProgram.parameters = {["USER_TOKEN_MPH"] : swapConfig.userTokenMPH};
        swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapConfig.userTokenVHash};
        swapProgram.parameters = {["SERVICE_FEE"] : swapConfig.serviceFee};
        swapProgram.parameters = {["OWNER_PKH"] : swapConfig.ownerPkh};
        swapProgram.parameters = {["MIN_ADA"] : swapConfig.minAda};
        swapProgram.parameters = {["DEPOSIT_ADA"] : swapConfig.depositAda};
        const swapCompiledProgram = swapProgram.compile(optimize); 

        // Get the UTxOs in Seller Wallet
        const utxosSeller = await network.getUtxos(seller.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Seller UTXOs as inputs
        tx.addInputs(utxosSeller);

        // Add the script as a witness to the transaction
        tx.attachScript(swapCompiledProgram);

        // Create the swap redeemer
        const swapRedeemer = (new swapProgram.types.Redeemer.Close(textToBytes(sellerTokenTN)))._toUplcData();
        
        // Get the UTXO that has the swap datum
        const swapUtxo = await getSwapUTXO(swapConfig);
        tx.addInput(swapUtxo, swapRedeemer);   

        // Add the beacon minting script as a witness to the transaction
        tx.attachScript(beaconCompiledProgram);

        // Create an Beacon Minting Init Redeemer because we must always send a Redeemer with
        // a plutus script transaction even if we don't actually use it.
        const beaconRedeemer = (new beaconProgram.types.Redeemer.Burn())._toUplcData();

        // Create beacon token for burning
        const beaconTN = swapCompiledProgram.validatorHash.hex;
        const beaconToken = [[hexToBytes(beaconTN), BigInt(-1)]];

        // Add the mint to the tx
        tx.mintTokens(
            beaconMPH,
            beaconToken,
            beaconRedeemer
        )

        // Construct the Seller Token value
        const sellerToken = [[textToBytes(sellerTokenTN), BigInt(1)]];
        const sellerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapConfig.userTokenMPH), sellerToken]]);
        const sellerTokenValue = new Value(swapConfig.minAda, sellerTokenAsset);
        
        // Get the qty of the offeredAsset from the datum
        const datumInfo = await getSwapDatumInfo(swapUtxo);

        tx.addOutput(new TxOutput(
            seller.address,
            datumInfo.offeredAssetValue.add(sellerTokenValue)
        ));

        // Construct the time validity interval
        const slot = networkParams.liveSlot;
        const time = networkParams.slotToTime(slot);
        const now = new Date(Number(time));
        const before = new Date(now.getTime());
        before.setMinutes(now.getMinutes() - 5);
        const after = new Date(now.getTime());
        after.setMinutes(now.getMinutes() + 5);
   
        // Set a valid time interval
        tx.validFrom(before);
        tx.validTo(after);

        // Add buyer signer which is required to close the swap
        tx.addSigner(seller.pubKeyHash);
        
        // Add app wallet pkh as a signer which is required to burn beacon
        tx.addSigner(owner.pubKeyHash);

        console.log("");
        console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
        
        await tx.finalize(networkParams, seller.address, utxosSeller);
        console.log("Tx Fee", tx.body.fee);
        console.log("Tx Execution Units", tx.witnesses.dump().redeemers);

        // Sign tx with owner signature
        const signatureSeller = await seller.signTx(tx);
        tx.addSignatures(signatureSeller);

        // Sign tx with owner signature
        const signatureAppWallet = await owner.signTx(tx);
        tx.addSignatures(signatureAppWallet);

        console.log("");
        console.log("************ SUBMIT TX ************");
        
        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs("Seller", seller);
        await showSwapScriptUTXOs(swapConfig);
        return true;

    } catch (err) {
        console.error("closeSwap tx failed", err);
        return false;
    }
}

