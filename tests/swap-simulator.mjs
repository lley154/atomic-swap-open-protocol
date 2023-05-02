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
} from "@hyperionbt/helios";


// Create an Instance of NetworkEmulator
const network = new NetworkEmulator();

// Set the Helios compiler optimizer flag
let optimize = false;
const minAda = BigInt(2000000);  // minimum lovelace needed to send an NFT
const swapAmt = BigInt(100000000);  // minimum lovelace needed to send an NFT
const askedAsset = 15000000 // 20 Ada asked for 
const offeredAsset = 1;

// Network Parameters
const networkParamsFile = await fs.readFile('./src/preprod.json', 'utf8');
const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));


// Compile the swap script
const swapScript = await fs.readFile('./src/swap.hl', 'utf8');
const swapProgram = Program.new(swapScript);
const swapCompiledProgram = swapProgram.compile(optimize);

// Compile the beacon minting script
const beaconScript = await fs.readFile('./src/beacon.hl', 'utf8');
const beaconProgram = Program.new(beaconScript);
const beaconCompiledProgram = beaconProgram.compile(optimize);
const beaconMPH = beaconCompiledProgram.mintingPolicyHash;

// Create a Product Token
const productAsset = new Assets();
productAsset.addComponent(
    MintingPolicyHash.fromHex(
    '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c'
    ),
    Array.from(new TextEncoder().encode('Product Asset Name')),
    BigInt(1)
);

// Create seller wallet - we add 10ADA to start
const seller = network.createWallet(BigInt(10000000));

// Add Product Token to the seller wallet
network.createUtxo(seller, minAda, productAsset);

// Create buyer wallet - we add 10ADA to start
const buyer = network.createWallet(BigInt(10000000));

// Create buyer wallet - add 100ADA for swap
network.createUtxo(buyer, swapAmt);

// Now lets tick the network on 10 slots,
// this will allow the UTxOs to be created from Genisis
network.tick(BigInt(10));




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
}


const getSwapUTXO = async () => {

    const swapUtxos = await network.getUtxos(Address.fromHashes(swapCompiledProgram.validatorHash));
    for (const utxo of swapUtxos) {
        if (utxo.origOutput.datum) {
            return utxo;
        }
    }
}

const initSwap = async () => {

    try {
        console.log("");
        console.log("************ INIT SWAP ************");
        console.log("************ PRE-TEST ************");
        await showWalletUTXOs();
        
        // Now we are able to get the UTxOs in Buyer & Seller Wallets
        const utxosSeller = await network.getUtxos(seller.address);

        // Start building the transaction
        const tx = new Tx();

        // Add the Seller UTXOs as inputs
        tx.addInputs(utxosSeller);

        // Add the script as a witness to the transaction
        tx.attachScript(beaconCompiledProgram);

        // Create an Beacon Minting Init Redeemer because we must always send a Redeemer with
        // a plutus script transaction even if we don't actually use it.
        const beaconRedeemer = (new beaconProgram.types.Redeemer.Init())._toUplcData();

        // Construct the beacon that we will want to send as an output
        const beaconToken = [[textToBytes("Becaon Token"), BigInt(1)]];
        const beaconAsset = new Assets([[beaconMPH, beaconToken]]);
        
        // Add the mint to the tx
        tx.mintTokens(
            beaconMPH,
            beaconToken,
            beaconRedeemer
        )

        // Attach the output with the minted beacon to the swap script address
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            new Value(minAda, beaconAsset)
        ));

        // Construct the swap price
        const swapPrice = new (swapProgram.types.Price)(
            askedAsset,
            offeredAsset
        )

        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            swapPrice,
            new Value(minAda, beaconAsset)
          )

        // Attach the output with the swap datum to the swap script address
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            new Value(minAda, productAsset),
            Datum.inline(swapDatum._toUplcData())
        ));

        console.log("");
        console.log("************ EXECUTE SMART CONTRACT ************");
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

const executeSwap = async () => {

    try {
        console.log("");
        console.log("************ EXECUTE SWAP ************");
        console.log("************ PRE-TEST ************");

        // Tick the network on 10 more slots,
        network.tick(BigInt(10));
        await showWalletUTXOs();
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

        // Construct the beacon so it can be referenced in the swap datum
        const beaconToken = [[textToBytes("Becaon Token"), BigInt(1)]];
        const beaconAsset = new Assets([[beaconMPH, beaconToken]]);

        // Construct the swap price
        const swapPrice = new (swapProgram.types.Price)(
            askedAsset,
            offeredAsset
        )

        // Construct the swap datum
        const swapDatum = new (swapProgram.types.Datum)(
            swapPrice,
            new Value(minAda, beaconAsset)
          )

        // Create the output with the swap datum to the swap script address
        tx.addOutput(new TxOutput(
            Address.fromHashes(swapCompiledProgram.validatorHash),
            new Value(BigInt(minAda)),
            Datum.inline(swapDatum._toUplcData())
        ));

        // Create the output to send the askedAsset to the seller address
        tx.addOutput(new TxOutput(
            seller.address,
            new Value(BigInt(askedAsset))
        ));

        // Creat the output for the product asset that was purchased to the buyer address
        tx.addOutput(new TxOutput(
            buyer.address,
            new Value(minAda, productAsset))
        );

        console.log("");
        console.log("************ EXECUTE SMART CONTRACT ************");
        await tx.finalize(networkParams, buyer.address, utxosBuyer);

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
        console.error("executeSwap tx failed", err);
        return false;
    }
}

await initSwap();
await executeSwap();
  