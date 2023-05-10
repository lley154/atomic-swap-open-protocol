import {
  Assets, 
  bytesToHex,
  MintingPolicyHash,
  Value,
  textToBytes
} from "@hyperionbt/helios";

import {
    approveEscrow,
    assetSwapEscrow,
    beaconMPH,
    beaconTN,
    closeSwap,
    initSwap,
    getMphTnQty,
    minAda,
    network,
    SwapConfig
} from "./swap-simulator.mjs"

// Create seller wallet - we add 10ADA to start
const seller = network.createWallet(BigInt(10_000_000));

// Create buyer wallet - we add 10ADA to start
const buyer = network.createWallet(BigInt(10_000_000));

// Create product token to buy
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

// Add Product Token to the seller wallet
network.createUtxo(seller, minAda, productAsset);

// Create asset value to be offered
const offeredAsset = new Assets();
offeredAsset.addComponent(
    productMPH,
    productTN,
    BigInt(5)
);
const offeredAssetValue = new Value(BigInt(0), offeredAsset);

// Create a usda token to use as medium of exchange
const usdaTokenMPH = MintingPolicyHash.fromHex(
    '23aa5486dab6527c4697387736ae449411c03dcd20a3950453e6777e'
    );
const usdaTokenTN =  textToBytes('USDA Token');

// Create usda tokens and add them to the buyers wallet
const buyerUSDATokenAsset = new Assets();
buyerUSDATokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(50)
);

// Add Product Token to the seller wallet
network.createUtxo(buyer, minAda, buyerUSDATokenAsset);

// Now lets tick the network on 10 slots
network.tick(BigInt(10));

// Create usda tokens to for askedAssets
const usdaTokenAsset = new Assets();
usdaTokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(20)
);

const askedAssetValue = new Value(BigInt(0), usdaTokenAsset);

// Create the swap config
const askedValueInfo = await getMphTnQty(askedAssetValue);
const offeredValueInfo = await getMphTnQty(offeredAssetValue);
const swapConfig = new SwapConfig(askedValueInfo.mph,
                                  askedValueInfo.tn,
                                  offeredValueInfo.mph,
                                  offeredValueInfo.tn,
                                  beaconMPH.hex,
                                  bytesToHex(beaconTN),
                                  seller.pubKeyHash.hex
                                  ); 

// Initialize with price of 20 usda tokens with 5 product tokens
await initSwap(buyer, seller, askedAssetValue, offeredAssetValue, swapConfig);   

// Create usda token value for swap asset
const swapUSDATokenAsset = new Assets();
swapUSDATokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(50)
);

const swapAskedAssetValue = new Value(minAda, swapUSDATokenAsset);

// Swap 50 usda coins and get as many product tokens as possible
const order_id = await assetSwapEscrow(buyer, seller, swapAskedAssetValue, swapConfig);

// Approve the escrow for a given order id
await approveEscrow(buyer, seller, order_id, swapConfig);

// Close the swap position
await closeSwap(buyer, seller, swapConfig);    

