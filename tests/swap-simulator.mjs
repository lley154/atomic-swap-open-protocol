import { promises as fs } from 'fs';

import {
  Address,
  Assets, 
  Datum,
  MintingPolicyHash,
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
const initSwapAmt = BigInt(100_000_000); // initial Ada for swap
const deposit = BigInt(5_000_000)        // 5 Ada deposit for escrow

// Set dummy tokenized product
const productMPH = MintingPolicyHash.fromHex(
    '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c'
    );
const productTN =  Array.from(new TextEncoder().encode('Product Asset Name'));

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
const beaconToken = [[textToBytes("Beacon Token"), BigInt(1)]];
const beaconAsset = new Assets([[beaconMPH, beaconToken]]);

// Compile the Points minting script
const pointsScript = await fs.readFile('./src/points.hl', 'utf8');
const pointsProgram = Program.new(pointsScript);
const pointsCompiledProgram = pointsProgram.compile(optimize);
const pointsMPH = pointsCompiledProgram.mintingPolicyHash;

// Construct the Points asset
const pointsToken = [[textToBytes("Points Token"), BigInt(1)]];
//const pointsAsset = new Assets([[pointsMPH, pointsToken]]);
const pointsTN =  Array.from(new TextEncoder().encode('Points Token'));

// Compile the Rewards minting script
const rewardsScript = await fs.readFile('./src/rewards.hl', 'utf8');
const rewardsProgram = Program.new(rewardsScript);
const rewardsCompiledProgram = rewardsProgram.compile(optimize);
const rewardsMPH = rewardsCompiledProgram.mintingPolicyHash;

// Construct the Rewards asset
const rewardsToken = [[textToBytes("Rewards Token"), BigInt(1)]];
//const rewardsAsset = new Assets([[rewardsMPH, rewardsToken]]);
const rewardsTN =  Array.from(new TextEncoder().encode('Rewards Token'));

// Create seller wallet - we add 10ADA to start
const seller = network.createWallet(BigInt(10_000_000));

// Create product tokens in seller wallet
const productAsset = new Assets();
productAsset.addComponent(
    productMPH,
    productTN,
    BigInt(10)
);

// Add Product Token to the seller wallet
network.createUtxo(seller, minAda, productAsset);

// Create buyer wallet - we add 10ADA to start
const buyer = network.createWallet(BigInt(10_000_000));

// Create buyer wallet - add 100ADA for swap
network.createUtxo(buyer, initSwapAmt);

// Now lets tick the network on 10 slots,
// this will allow the UTxOs to be created from Genisis
network.tick(BigInt(10));


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
const showWalletUTXOs = async () => {

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
 * @param {UTxO, number} utxospendAmt 
 * @returns {{buyPrice, buyQty, remQty, chgAmt}} 
 */
const calcQtyToBuy = async (utxo, spendAmt) => {

    if (spendAmt <= 0) {
        throw console.error("calcRemainder: spendAmt can't be negative");
    } 
    var qtyToBuy;
    var qtyRemainder;
    var changeAmt;
    const price = utxo.origOutput.datum.data.list[0].int;
    const qty = utxo.origOutput.datum.data.list[1].int;
    const diff = spendAmt - price * qty;

    assert(price > 0); // price must be greater than zero
    const unitAmt = spendAmt / price;  
    if (unitAmt < 1) {
        throw console.error("calcRemainder: insufficient funds")
    } else if (diff >= 0) { 
        qtyToBuy = qty;  // can purchase all available qty
        qtyRemainder = 0;
        changeAmt = spendAmt - qtyToBuy * price; // return the change to the buyer
    } else {
        qtyToBuy = unitAmt; 
        qtyRemainder = qty - unitAmt;  // calc the remaining qty at the utxo
        changeAmt = spendAmt - qtyToBuy * price; // return the change to the buyer
    }
    
    // If the change amount is too small to be sent back as change,
    // then just included it as part of the overall cost to avoid
    // sending back change to the buyer's wallet
    if (changeAmt < minChangeAda) {
        changeAmt = 0;
    } 

    return { 
        buyPrice: price,
        buyQty: qtyToBuy,
        remQty: qtyRemainder,
        chgAmt: changeAmt
    }
}

/**
 * Return the askedAsset and offeredAsset inline Datum info.
 * @package
 * @param {UTxO, number} utxo
 * @returns {{askedAsset, offeredAsset}}
 */
const getDatumInfo = async (utxo) => {

    return {
        askedAsset: utxo.origOutput.datum.data.list[0].int,
        offeredAsset: utxo.origOutput.datum.data.list[1].int
    }
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
 * @param {number} askedAsset
 * @param {number} offeredAsset
 */
const initSwap = async (askedAsset, offeredAsset) => {

    try {

        console.log("");
        console.log("************ INIT SWAP ************");
        console.log("************ PRE-TEST *************");
        await showWalletUTXOs();
        
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
            askedAsset,
            offeredAsset
          )

        // Create product asset to be offered
        const productAsset = new Assets();
        productAsset.addComponent(
            productMPH,
            productTN,
            BigInt(offeredAsset)
        );

        // Attach the output with product asset, beacon token
        // and the swap datum to the swap script address
        const swapValue = new Value(minAda, productAsset).add(new Value(BigInt(0), beaconAsset));
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum._toUplcData())
        ));

        console.log("");
        console.log("************ EXECUTE BEACON MINTING CONTRACT ************");
        await tx.finalize(networkParams, seller.address, utxosSeller);

        console.log("");
        console.log("************ SUBMIT TX ************");
        // Submit Tx to the network
        const txId = await network.submitTx(tx);
        console.log("TxId", txId.dump());

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));

        console.log("");
        console.log("************ POST-TEST ************");
        await showWalletUTXOs();
        await showScriptUTXOs();

        return true;

    } catch (err) {
        console.error("initSwap tx failed", err);
        return false;
    }
}

/**
 * Execute a swap with a given amount
 * @package
 * @param {number} spendAmt
 */
const updateSwap = async (askedAsset, offeredAsset) => {

    try {
        console.log("");
        console.log("************ EXECUTE UPDATE SWAP ************");
        console.log("***************** PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs();
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
        
        // Get the qty of the offeredAsset from the datum
        const datumInfo = await getDatumInfo(swapUtxo);

        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            BigInt(askedAsset),
            BigInt(datumInfo.offeredAsset) + BigInt(offeredAsset)
          )

        // Create product asset to be offered
        const productAsset = new Assets();
        productAsset.addComponent(
            productMPH,
            productTN,
            BigInt(datumInfo.offeredAsset) + BigInt(offeredAsset)
        );
        // Build the output that includes the update product offered, beacon and 
        // swap datum
        const swapValue = new Value(minAda, productAsset).add(new Value(BigInt(0), beaconAsset));
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum._toUplcData())
        ));

        console.log("");
        console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
        await tx.finalize(networkParams, seller.address, utxosSeller);

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
        await showWalletUTXOs();
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
 * @param {number} spendAmt
 */
const assetSwap = async (spendAmt) => {

    try {
        console.log("");
        console.log("************ EXECUTE ASSET SWAP ************");
        console.log("***************** PRE-TEST *****************");

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs();
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
        const productToBuy = await calcQtyToBuy(swapUtxo, BigInt(spendAmt));

        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            BigInt(productToBuy.buyPrice),  // askedAsset
            BigInt(productToBuy.remQty)     // offeredAsset
          )
        
        // Create the remaining product assets if any
        const remainderProductAsset = new Assets();
        remainderProductAsset.addComponent(
            productMPH,
            productTN,
            BigInt(productToBuy.remQty)
        );

        console.log("assetSwap: remainderProductAsset", remainderProductAsset.mintingPolicies);

        // Build the output that includes the remaining product, beacon and 
        // swap datum
        const swapValue = new Value(minAda, remainderProductAsset).add(new Value(BigInt(0), beaconAsset));
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            swapValue,
            Datum.inline(swapDatum._toUplcData())
        ));

        // Create the bought product asset
        const boughtProductAsset = new Assets();
        boughtProductAsset.addComponent(
            productMPH,
            productTN,
            BigInt(productToBuy.buyQty)
        );
        console.log("assetSwap: boughtProductAsset", boughtProductAsset.mintingPolicies);

        // Construct the values to lock at the escrow contract
        const orderValue = new Value(BigInt(spendAmt) - BigInt(productToBuy.chgAmt));
        const productValue = new Value(BigInt(0), boughtProductAsset);
        const depositValue = new Value(deposit);
        
        // Use timestamp for order id for now
        const orderId = Date.now().toString();  
        
        // Construct the escrow datum
        const escrowDatum = new (escrowProgram.types.Datum)(
            new ByteArray(orderId),
            buyer.pubKeyHash, 
            depositValue,
            seller.pubKeyHash,
            orderValue,
            productValue
            )

        // Create an output for the order total, depoist and products bought 
        // to the escrow script address
        tx.addOutput(new TxOutput(
            Address.fromHashes(escrowCompiledProgram.validatorHash),
            orderValue.add(depositValue).add(productValue),
            Datum.inline(escrowDatum._toUplcData())
        ));

        // Return change to the buyer if there is any
        if (productToBuy.chgAmt != 0) {
            tx.addOutput(new TxOutput(
                buyer.address,
                new Value(BigInt(productToBuy.chgAmt)))
            );
        }

        console.log("");
        console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
        await tx.finalize(networkParams, buyer.address, utxosBuyer);

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
        await showWalletUTXOs();
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
const approveEscrow = async (orderId) => {

    try {
        console.log("");
        console.log("************ EXECUTE APPROVE ESCROW ************");
        console.log("******************* PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs();
        await showScriptUTXOs();

        // Get the UTxOs in Seller and Buyer Wallet
        //const utxosBuyer = await network.getUtxos(buyer.address);
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
        await showWalletUTXOs();
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
const closeSwap = async () => {

    try {
        console.log("");
        console.log("************ EXECUTE CLOSE SWAP ************");
        console.log("**************** PRE-TEST ******************");
        
        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs();
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
        const beaconToken = [[textToBytes("Beacon Token"), BigInt(-1)]];

        // Add the mint to the tx
        tx.mintTokens(
            beaconMPH,
            beaconToken,
            beaconRedeemer
        )

        // Get the qty of the offeredAsset from the datum
        const datumInfo = await getDatumInfo(swapUtxo);

        // Create product asset to be retrieved
        const productAsset = new Assets();
        productAsset.addComponent(
            productMPH,
            productTN,
            BigInt(datumInfo.offeredAsset)
        );
        // Build the output to send back to the seller the product
        // token locked at the swap address
        const swapValue = new Value(minAda, productAsset);
        tx.addOutput(new TxOutput(
            seller.address,
            swapValue
        ));

        console.log("");
        console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
        await tx.finalize(networkParams, seller.address, utxosSeller);

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
        await showWalletUTXOs();
        await showScriptUTXOs();

        return true;

    } catch (err) {
        console.error("updateSwap tx failed", err);
        return false;
    }
}

await initSwap(15_000_000, 5);                  // Initialize with price of 15 Ada and 5 product tokens
await updateSwap(10_000_000, 5);                // Change price to 10 Ada and add 5 more product tokens
const order_id = await assetSwap(25_000_000);   // Swap 25 Ada and get as many product tokens as possible
await approveEscrow(order_id);                  // Approve the escrow for a given order id
await closeSwap();                              // Close the swap position

