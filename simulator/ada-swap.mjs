import {
  Assets, 
  MintingPolicyHash,
  Value,
  textToBytes, 
} from "@hyperionbt/helios";

import {
    assetSwap,
    beaconMPH,
    closeSwap,
    initSwap,
    getMphTnQty,
    minAda,
    mintUserTokens,
    network,
    SwapConfig,
    showWalletUTXOs,
    updateSwap
} from "./swap-simulator.mjs"

// Create seller wallet - we add 10ADA to start
const seller = network.createWallet(BigInt(10_000_000));

// Create buyer wallet - we add 10ADA to start
const buyer = network.createWallet(BigInt(10_000_000));

// Now lets tick the network on 10 slots,
network.tick(BigInt(10));

const sellerToken = await mintUserTokens(seller, 25);

// Create the asset value being asked for
const askedAssetValue = new Value(BigInt(15_000_000));

// Create product token value to buy
const productMPH = MintingPolicyHash.fromHex(
    '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c'
    );
const productTN =  textToBytes('Product Asset Name');

// Create product tokens in seller wallet
const productAsset = new Assets();
productAsset.addComponent(
    productMPH,
    productTN,
    BigInt(10)
);

// Add product token to the seller wallet
network.createUtxo(seller, minAda, productAsset);

// Create buyer wallet - add 100ADA for swap
network.createUtxo(buyer, BigInt(100_000_000));

// Now lets tick the network on 10 slots,
network.tick(BigInt(10));

// Create asset value to be offered
const offeredAsset = new Assets();
offeredAsset.addComponent(
    productMPH,
    productTN,
    BigInt(5)
);
const offeredAssetValue = new Value(BigInt(0), offeredAsset);

// Create the swap config
const askedValueInfo = await getMphTnQty(askedAssetValue);
const offeredValueInfo = await getMphTnQty(offeredAssetValue);
const swapConfig = new SwapConfig(askedValueInfo.mph,
                                  askedValueInfo.tn,
                                  offeredValueInfo.mph,
                                  offeredValueInfo.tn,
                                  beaconMPH.hex,
                                  seller.pubKeyHash.hex,
                                  false, // escrow not enabled
                                  "",    // escrow address n/a 
                                  sellerToken.mph
                                  ); 

// Initialize with price of 15 Ada and 5 product tokens
await initSwap(buyer, seller, askedAssetValue, offeredAssetValue, swapConfig, sellerToken.tn);   

// Create the updated asset value being asked for
const updatedAskedAssetValue = new Value(BigInt(10_000_000));

// Create the additional asset value to be offered
const updatedOfferedAsset = new Assets();
updatedOfferedAsset.addComponent(
    productMPH,
    productTN,
    BigInt(5)
);
const updatedOfferedAssetValue = new Value(BigInt(0), offeredAsset);

/*

// Change price to 10 Ada and add 5 more product tokens
await updateSwap(buyer, seller, updatedAskedAssetValue, updatedOfferedAssetValue, swapConfig); 

const swapAskedAssetValue = new Value(BigInt(25_000_000));

// Swap 25 Ada and get as many product tokens as possible
//await assetSwap(buyer, seller, swapAskedAssetValue, swapConfig);

// Close the swap position
//await closeSwap(seller, swapConfig);  
//showWalletUTXOs("Buyer", buyer);

*/
