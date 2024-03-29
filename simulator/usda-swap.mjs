import {
  Assets, 
  MintingPolicyHash,
  textToBytes,
  Value
} from "@hyperionbt/helios";

import {
    assetSwap,
    beaconMPH,
    closeSwap,
    getMphTnQty,
    mintUserTokens,
    network,
    openSwap,
    owner,
    SwapConfig,
    showWalletUTXOs,
    updateSwap,
    version
} from "./swap-simulator.mjs"

const minAda = BigInt(3_500_000);
const serviceFee = BigInt(1_000_000);
const depositAda = BigInt(0);

// Create seller wallet - we add 10ADA to start
const seller = network.createWallet(BigInt(15_000_000));

// Create buyer wallet - we add 10ADA to start
const buyer = network.createWallet(BigInt(15_000_000));

// Now lets tick the network on 10 slots,
network.tick(BigInt(10));

// Create the seller token
const sellerToken = await mintUserTokens(seller, minAda);

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

// Create usda tokens in buyer wallet
const buyerUSDATokenAsset = new Assets();
buyerUSDATokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(50)
);

// Add usda token to the buyer wallet
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
const swapConfig = new SwapConfig(version,                // script version
                                  askedValueInfo.mph,
                                  askedValueInfo.tn,
                                  offeredValueInfo.mph,
                                  offeredValueInfo.tn,
                                  beaconMPH.hex,
                                  seller.pubKeyHash.hex,
                                  sellerToken.tn,
                                  false,                // escrow not enabled
                                  "",                   // escrow address n/a 
                                  sellerToken.mph,
                                  sellerToken.vHash,
                                  serviceFee,
                                  owner.pubKeyHash.hex,
                                  minAda, 
                                  depositAda,
                                  ); 

                               
// Initialize with price of 20 usda tokens with 5 product tokens
await openSwap(seller, askedAssetValue, offeredAssetValue, swapConfig);   

// Create usda tokens to for updated askedAssets
const updateUsdaTokenAsset = new Assets();
updateUsdaTokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(15)
);

const updatedAskedAssetValue  = new Value(BigInt(0), updateUsdaTokenAsset);

// Create the additional asset value to be offered
const updatedOfferedAsset = new Assets();
updatedOfferedAsset.addComponent(
    productMPH,
    productTN,
    BigInt(5)
);
const updatedOfferedAssetValue = new Value(BigInt(0), updatedOfferedAsset);

// Change price to 15 USDA and add 5 more product tokens
await updateSwap(seller, updatedAskedAssetValue, updatedOfferedAssetValue, swapConfig); 

// Create usda token for swap asset
const swapUSDATokenAsset = new Assets();
swapUSDATokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(50)
);

const swapAskedAssetValue = new Value(minAda, swapUSDATokenAsset);

// Create the buyer token
const buyerToken = await mintUserTokens(buyer, minAda);

// Swap 50 usda tokens and get as many product tokens as possible
await assetSwap(buyer, swapAskedAssetValue, swapConfig, buyerToken.tn);  

// Close the swap position
await closeSwap(seller, swapConfig);
showWalletUTXOs("Buyer", buyer);
