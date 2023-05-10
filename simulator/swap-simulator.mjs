import { promises as fs } from 'fs';

import {
  Address,
  Assets, 
  bytesToHex,
  Datum,
  NetworkEmulator,
  NetworkParams, 
  Program,
  Value, 
  textToBytes,
  TxOutput,
  Tx,
  UTxO,
  ByteArray,
  PubKeyHash,
} from "@hyperionbt/helios";

export {
    approveEscrow,
    assetSwap,
    assetSwapEscrow,
    closeSwap,
    initSwap,
    minAda,
    network,
    updateSwap
}

// Create an Instance of NetworkEmulator
const network = new NetworkEmulator();

// Network Parameters
const networkParamsFile = await fs.readFile('./src/preprod.json', 'utf8');
const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));

// Set the Helios compiler optimizer flag
let optimize = false;

// Global variables
const minAda = BigInt(2_000_000);        // minimum lovelace needed to send a token
const minChangeAda = BigInt(1_000_000);  // minimum lovelace needed to send back as change
const deposit = BigInt(5_000_000)        // 5 Ada deposit for escrow

// Compile the swap script
const swapScript = await fs.readFile('./src/swap.hl', 'utf8');
const swapProgram = Program.new(swapScript);
const swapCompiledProgram = swapProgram.compile(optimize);

// Compile the escrow script
const escrowScript = await fs.readFile('./src/escrow.hl', 'utf8');
const escrowProgram = Program.new(escrowScript);
const escrowCompiledProgram = escrowProgram.compile(optimize);

// Compile the Beacon minting script
const beaconScript = await fs.readFile('./src/beacon.hl', 'utf8');
const beaconProgram = Program.new(beaconScript);
const beaconCompiledProgram = beaconProgram.compile(optimize);
const beaconMPH = beaconCompiledProgram.mintingPolicyHash;

// Construct the Beacon asset
const beaconTN = textToBytes("Beacon Token");
const beaconToken = [[beaconTN, BigInt(1)]];
const beaconAsset = new Assets([[beaconMPH, beaconToken]]);
const beaconValue = new Value(BigInt(0), beaconAsset);

// Compile the Points minting script
const pointsScript = await fs.readFile('./src/points.hl', 'utf8');
const pointsProgram = Program.new(pointsScript);
const pointsCompiledProgram = pointsProgram.compile(optimize);
const pointsMPH = pointsCompiledProgram.mintingPolicyHash;

// Construct the Points asset
const pointsTN = textToBytes("Points Token");
const pointsToken = [[pointsTN, BigInt(1)]];

// Compile the Rewards minting script
const rewardsScript = await fs.readFile('./src/rewards.hl', 'utf8');
const rewardsProgram = Program.new(rewardsScript);
const rewardsCompiledProgram = rewardsProgram.compile(optimize);
const rewardsMPH = rewardsCompiledProgram.mintingPolicyHash;

// Construct the Rewards asset
const rewardsTN =  textToBytes("Rewards Token");
const rewardsToken = [[rewardsTN, BigInt(1)]];

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
const showWalletUTXOs = async (buyer, seller) => {

     // Get the UTxOs in Buyer & Seller Wallets
     const utxosSeller = await network.getUtxos(seller.address);
     const utxosBuyer = await network.getUtxos(buyer.address);

     console.log("");
     console.log("Seller Wallet UTXOs:");
     console.log("-------------");
     for (const utxo of utxosSeller) {
         console.log("txId", utxo.txId.hex + "#" + utxo.utxoIdx);
         console.log("value", utxo.value.dump());
     }
     console.log("");
     console.log("Buyer Wallet UTXOs:");
     console.log("-------------");
     for (const utxo of utxosBuyer) {
         console.log("txId", utxo.txId.hex + "#" + utxo.utxoIdx);
         console.log("value", utxo.value.dump());
     }
}

/**
 * Prints out the UTXOs at the swap script address
 * @package
 */
const showScriptUTXOs = async () => {

    const swapUtxos = await network.getUtxos(Address.fromHashes(swapCompiledProgram.validatorHash));
    console.log("");
    console.log("Swap Script UTXOs:");
    console.log("------------------");
    for (const utxo of swapUtxos) {
        console.log("txId", utxo.txId.hex + "#" + utxo.utxoIdx);
        console.log("value", utxo.value.dump());
        if (utxo.origOutput.datum) {
            console.log("datum", utxo.origOutput.datum.data.toSchemaJson());
        }
    }
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
 * Get the UTXO at the swap address which contains the beacon token
 * @package
 * @param {} 
 * @returns {UTxO} 
 */
const getSwapUTXO = async () => {

    const swapUtxos = await network.getUtxos(Address.fromHashes(swapCompiledProgram.validatorHash));
    for (const utxo of swapUtxos) {
        // only one UTXO with beacon token should exist
        if (utxo.value.assets.mintingPolicies.includes(beaconMPH)) { 
            console.log("getSwapUTXO: UTXO with beacon found");
            return utxo;
        }
    }
}

/**
 * Get the UTXO at the escrow address
 * @package
 * @param {PubKeyHash} buyerPKH
 * @param {PubKeyHash} sellerPKH
 * @param {string} orderId 
 * @returns {UTxO}
 */
const getEscrowUTXO = async (orderId, buyerPKH, sellerPKH) => {

    const escrowUtxos = await network.getUtxos(Address.fromHashes(escrowCompiledProgram.validatorHash));
    for (const utxo of escrowUtxos) {

        // only one UTXO with orderId, buyerPKH & sellerPKH should exist
        if (ByteArray.fromUplcData(utxo.origOutput.datum.data.list[0]).hex === (new ByteArray(orderId).hex) &&
            PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[1]).hex === buyerPKH.hex &&
            PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[3]).hex === sellerPKH.hex) { 
            console.log("getEscrowUTXO: UTXO with order found");
            return utxo;
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
    const updatedOfferAssetValue = new Value(minAda, updatedOfferedAsset);

    // Create the offeredAsset that is being bought
    const buyOfferedAsset = new Assets();
    buyOfferedAsset.addComponent(
        offeredAssetMPH,
        offeredAssetTN,
        BigInt(qtyToBuy)
    );
    const buyOfferAssetValue = new Value(minAda, buyOfferedAsset);

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
 * @returns {{  orderId: ByteArray, 
 *              buyerPKH: PubKeyHash,
 *              depositValue: Value,
 *              sellerPKH: PubKeyHash,
 *              orderValue: Value,
 *              productValue: Value}} 
 */
const getEscrowDatumInfo = async (utxo) => {

    const datumInfo = {
        orderId: ByteArray.fromUplcData(utxo.origOutput.datum.data.list[0]),
        buyerPKH: PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[1]),
        depositValue: Value.fromUplcData(utxo.origOutput.datum.data.list[2]),
        sellerPKH: PubKeyHash.fromUplcData(utxo.origOutput.datum.data.list[3]),
        orderValue: Value.fromUplcData(utxo.origOutput.datum.data.list[4]),
        productValue: Value.fromUplcData(utxo.origOutput.datum.data.list[5])
    }
    return datumInfo
}

/**
 * Initialize the swap smart contract and mint a beacon token.
 * @package
 * @param {Value} askedAssetValue
 * @param {Value} offeredAssetValue
 */
const initSwap = async (buyer, seller, askedAssetValue, offeredAssetValue) => {

    try {
        console.log("");
        console.log("************ INIT SWAP ************");
        console.log("************ PRE-TEST *************");
        await showWalletUTXOs(buyer, seller);
        
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

        // Add the mint to the tx
        tx.mintTokens(
            beaconMPH,
            beaconToken,
            beaconRedeemer
        )
        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            askedAssetValue,
            offeredAssetValue
          )

        // Attach the output with product asset, beacon token
        // and the swap datum to the swap script address
        const swapValue = (new Value(minAda)).add(offeredAssetValue).add(beaconValue);
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum)
        ));

        console.log("");
        console.log("************ EXECUTE BEACON MINTING CONTRACT ************");
        await tx.finalize(networkParams, seller.address, utxosSeller);
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
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();
        return true;

    } catch (err) {
        console.error("initSwap tx failed", err);
        return false;
    }
}

/**
 * Update swap askedAsset and/or offeredAsset
 * @package
 * @param {Value} askedAssetValue
 * @param {Value} offeredAssetValue
 */
const updateSwap = async (buyer, seller, askedAssetValue, offeredAssetValue) => {

    try {
        console.log("");
        console.log("************ EXECUTE UPDATE SWAP ************");
        console.log("***************** PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();

        // Get the UTxOs in Seller Wallet
        const utxosSeller = await network.getUtxos(seller.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Seller UTXOs as inputs
        tx.addInputs(utxosSeller);

        // Add the script as a witness to the transaction
        tx.attachScript(swapCompiledProgram);

        // Create the swap redeemer
        const swapRedeemer = (new swapProgram.types.Redeemer.Update())._toUplcData();
        
        // Get the UTXO that has the swap datum
        const swapUtxo = await getSwapUTXO();
        tx.addInput(swapUtxo, swapRedeemer);  
        
        // Get the qty of the offeredAssetValue from the datum
        const datumInfo = await getSwapDatumInfo(swapUtxo);

        // Now calculate the new updated offerAssetValue
        const updatedOfferedAssetValue = datumInfo.offeredAssetValue.add(offeredAssetValue);
        
        // Confirm that the updated offeredAssetValue is positive
        updatedOfferedAssetValue.assertAllPositive();

        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            askedAssetValue,
            updatedOfferedAssetValue
          )

        const swapValue = updatedOfferedAssetValue.add(beaconValue);
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum)
        ));

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

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();
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
const assetSwap = async (buyer, seller, swapAskedAssetValue) => {

    try {
        console.log("");
        console.log("************ EXECUTE ASSET SWAP ************");
        console.log("***************** PRE-TEST *****************");

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();
        
        // Now we are able to get the UTxOs in Buyer & Seller Wallets
        const utxosBuyer = await network.getUtxos(buyer.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Buyer UTXOs as inputs
        tx.addInputs(utxosBuyer);

        // Add the script as a witness to the transaction
        tx.attachScript(swapCompiledProgram);

        // Create the swap redeemer
        const swapRedeemer = (new swapProgram.types.Redeemer.Swap())._toUplcData();
        
        // Get the UTXO that has the swap datum
        const swapUtxo = await getSwapUTXO();
        tx.addInput(swapUtxo, swapRedeemer);   
        
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
        
        const swapValue = orderDetails.offeredAssetVal.add(beaconValue);
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum._toUplcData())
        ));

        // Create the output to send the askedAsset to the seller address
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

        // Create the output to send the offeredAsset to the buyer address
        if (orderDetails.noChange) {
            tx.addOutput(new TxOutput(
                buyer.address,
                orderDetails.buyAssetVal
            ));
        } else {
            tx.addOutput(new TxOutput(
                buyer.address,
                orderDetails.buyAssetVal.add(orderDetails.changeAssetVal)
            ));
        }

        console.log("");
        console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
        
        await tx.finalize(networkParams, buyer.address, utxosBuyer);
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
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();
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
const assetSwapEscrow = async (buyer, seller, swapAskedAssetValue) => {

    try {
        console.log("");
        console.log("******* EXECUTE ASSET SWAP ESCROW **********");
        console.log("***************** PRE-TEST *****************");

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();
        
        // Get the UTxOs in Buyer Wallets
        const utxosBuyer = await network.getUtxos(buyer.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Buyer UTXOs as inputs
        tx.addInputs(utxosBuyer);

        // Add the script as a witness to the transaction
        tx.attachScript(swapCompiledProgram);

        // Create the swap redeemer
        const swapRedeemer = (new swapProgram.types.Redeemer.Swap())._toUplcData();
        
        // Get the UTXO that has the swap datum
        const swapUtxo = await getSwapUTXO();
        tx.addInput(swapUtxo, swapRedeemer);   
        
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
        
        const swapValue = orderDetails.offeredAssetVal.add(beaconValue);
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum._toUplcData())
        ));

        const depositValue = new Value(deposit);
        
        // Use timestamp for order id for now
        const orderId = Date.now().toString();  
        
        var orderValue;
        if (orderDetails.noChange) {
            orderValue = swapAskedAssetValue;
        } else {
            orderValue = swapAskedAssetValue.sub(orderDetails.changeAssetVal);
        }

        // Construct the escrow datum
        const escrowDatum = new (escrowProgram.types.Datum)(
            new ByteArray(orderId),
            buyer.pubKeyHash, 
            depositValue,
            seller.pubKeyHash,
            orderValue,
            orderDetails.buyAssetVal
            )

        // Create an output for the order total, depoist and products bought 
        // to the escrow script address
        tx.addOutput(new TxOutput(
            Address.fromHashes(escrowCompiledProgram.validatorHash),
            orderValue.add(depositValue).add(orderDetails.buyAssetVal),
            Datum.inline(escrowDatum._toUplcData())
        ));

        // Return change to the buyer if there is any
        if (!orderDetails.noChange) {
            tx.addOutput(new TxOutput(
                buyer.address,
                orderDetails.changeAssetVal
            ));
        }

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
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();
        return orderId;

    } catch (err) {
        console.error("assetSwap tx failed", err);
        return false;
    }
}


/**
 * Approve and release the order in the escrow smart contract
 * @package
 */
const approveEscrow = async (buyer, seller, orderId) => {

    try {
        console.log("");
        console.log("************ EXECUTE APPROVE ESCROW ************");
        console.log("******************* PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();

        // Get the UTxOs in Seller and Buyer Wallet
        const utxosSeller = await network.getUtxos(seller.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the script as a witness to the transaction
        tx.attachScript(escrowCompiledProgram);

        // Create the swap redeemer
        const escrowRedeemer = (new escrowProgram.types.Redeemer.Approve())._toUplcData();
        
        // Get the UTXO that has the swap datum
        const escrowUtxo = await getEscrowUTXO(orderId, buyer.pubKeyHash, seller.pubKeyHash);
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
            escrowDatumInfo.depositValue.add(escrowDatumInfo.productValue).add(pointsValue)
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
            escrowDatumInfo.orderValue.add(rewardsValue)
        ));

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

        console.log("");
        console.log("************ SUBMIT TX ************");
        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();
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
const closeSwap = async (buyer, seller) => {

    try {
        console.log("");
        console.log("************ EXECUTE CLOSE SWAP ************");
        console.log("**************** PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();

        // Get the UTxOs in Seller Wallet
        const utxosSeller = await network.getUtxos(seller.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Seller UTXOs as inputs
        tx.addInputs(utxosSeller);

        // Add the script as a witness to the transaction
        tx.attachScript(swapCompiledProgram);

        // Create the swap redeemer
        const swapRedeemer = (new swapProgram.types.Redeemer.Close())._toUplcData();
        
        // Get the UTXO that has the swap datum
        const swapUtxo = await getSwapUTXO();
        tx.addInput(swapUtxo, swapRedeemer);   

        // Add the beacon minting script as a witness to the transaction
        tx.attachScript(beaconCompiledProgram);

        // Create an Beacon Minting Init Redeemer because we must always send a Redeemer with
        // a plutus script transaction even if we don't actually use it.
        const beaconRedeemer = (new beaconProgram.types.Redeemer.Burn())._toUplcData();

        // Create beacon token for burning
        const beaconToken = [[beaconTN, BigInt(-1)]];

        // Add the mint to the tx
        tx.mintTokens(
            beaconMPH,
            beaconToken,
            beaconRedeemer
        )

        // Get the qty of the offeredAsset from the datum
        const datumInfo = await getSwapDatumInfo(swapUtxo);

        tx.addOutput(new TxOutput(
            seller.address,
            datumInfo.offeredAssetValue
        ));

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

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs(buyer, seller);
        await showScriptUTXOs();
        return true;

    } catch (err) {
        console.error("updateSwap tx failed", err);
        return false;
    }
}

