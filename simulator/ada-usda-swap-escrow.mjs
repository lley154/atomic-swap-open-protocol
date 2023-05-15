import {
    Address,
    Assets, 
    MintingPolicyHash,
    Value,
    textToBytes
} from "@hyperionbt/helios";

import {
    approveEscrow,
    beaconMPH,
    closeSwap,
    escrowProgram,
    EscrowConfig,
    initSwap,
    getMphTnQty,
    appWallet,
    minAda,
    multiAssetSwapEscrow,
    optimize,
    network,
    showWalletUTXOs,
    SwapConfig
} from "./swap-simulator.mjs"

// Create seller wallet - we add 10ADA to start
const sellerUSDA = network.createWallet(BigInt(10_000_000));

// Create seller wallet - we add 10ADA to start
const sellerProduct = network.createWallet(BigInt(10_000_000));

// Create buyer wallet - we add 10ADA to start
const buyer = network.createWallet(BigInt(10_000_000));

// Create product token to buy
const productMPH = MintingPolicyHash.fromHex(
    '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c'
    );
const productTN =  textToBytes('Product Asset Name');

// Create a usda token to use as medium of exchange
const usdaTokenMPH = MintingPolicyHash.fromHex(
    '23aa5486dab6527c4697387736ae449411c03dcd20a3950453e6777e'
    );
const usdaTokenTN =  textToBytes('USDA Token');

/******************************************************
* Step 1 - Setup Swap Ada -> USDA
*******************************************************/

// Create usda tokens and add them to the sellers wallet
const sellerUSDATokenAsset = new Assets();
sellerUSDATokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(50)
);

// Add product token to the seller wallet
network.createUtxo(sellerUSDA, minAda, sellerUSDATokenAsset);

// Create buyer wallet - add 100ADA for swap
network.createUtxo(buyer, BigInt(100_000_000));

// Now lets tick the network on 10 slots,
network.tick(BigInt(10));

// Create the asset value being asked for (1 Ada)
const askedAssetAdaValue = new Value(BigInt(1_000_000));

// Create asset value to be offered
const offeredAssetUSDA = new Assets();
offeredAssetUSDA.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(50)
);
const offeredAssetUSDAValue = new Value(BigInt(0), offeredAssetUSDA);

// Create the swap config
const askedAdaValueInfo = await getMphTnQty(askedAssetAdaValue);
const offeredUSDAValueInfo = await getMphTnQty(offeredAssetUSDAValue);
const swapConfigUSDA = new SwapConfig(askedAdaValueInfo.mph,
                                  askedAdaValueInfo.tn,
                                  offeredUSDAValueInfo.mph,
                                  offeredUSDAValueInfo.tn,
                                  beaconMPH.hex,
                                  sellerUSDA.pubKeyHash.hex,
                                  false, // escrow not enabled
                                  ""     // escrow address n/a 
                                  ); 
// Initialize with price of 1 ada with 50 usda tokens
await initSwap(buyer, sellerUSDA, askedAssetAdaValue, offeredAssetUSDAValue, swapConfigUSDA);

/******************************************************
* Step 2 - Setup Swap USDA -> Product
*******************************************************/

// Create product tokens in seller wallet
const productAsset = new Assets();
productAsset.addComponent(
    productMPH,
    productTN,
    BigInt(10)
);

// Add Product Token to the seller wallet
network.createUtxo(sellerProduct, minAda, productAsset);

// Tick the network on 10 slots
network.tick(BigInt(10));

// Create asset value to be offered
const offeredAsset = new Assets();
offeredAsset.addComponent(
    productMPH,
    productTN,
    BigInt(5)
);
const offeredAssetValue = new Value(BigInt(0), offeredAsset);

// Create usda tokens to for askedAssets
const usdaTokenAsset = new Assets();
usdaTokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(20)
);

const askedAssetValue = new Value(BigInt(0), usdaTokenAsset);

const escrowConfig = new EscrowConfig(buyer.pubKeyHash.hex,
                                      sellerProduct.pubKeyHash.hex,
                                      appWallet.pubKeyHash.hex);

// Create the escrow config parameters
escrowProgram.parameters = {["BUYER_PKH"] : escrowConfig.buyerPKH};
escrowProgram.parameters = {["SELLER_PKH"] : escrowConfig.sellerPKH};
escrowProgram.parameters = {["MEDIATOR_PKH"] : escrowConfig.appWalletPKH};
const escrowCompiledProgram = escrowProgram.compile(optimize);
const escrowAddress = Address.fromHashes(escrowCompiledProgram.validatorHash); 

// Create the swap config parameters
const askedValueInfo = await getMphTnQty(askedAssetValue);
const offeredValueInfo = await getMphTnQty(offeredAssetValue);
const swapConfigProduct = new SwapConfig(askedValueInfo.mph,
                                  askedValueInfo.tn,
                                  offeredValueInfo.mph,
                                  offeredValueInfo.tn,
                                  beaconMPH.hex,
                                  sellerProduct.pubKeyHash.hex,
                                  true, // set escrow enabled to true
                                  escrowAddress.toHex()
                                  ); 

// Initialize with price of 20 usda tokens with 5 product tokens
await initSwap(buyer, sellerProduct, askedAssetValue, offeredAssetValue, swapConfigProduct);   

const swapAskedAssetAdaValue = new Value(BigInt(50_000_000));

// Create usda token value for swap asset
const swapUSDATokenAsset = new Assets();
swapUSDATokenAsset.addComponent(
    usdaTokenMPH,
    usdaTokenTN,
    BigInt(50)
);

const swapAskedAssetUSDAValue = new Value(minAda, swapUSDATokenAsset);

// Swap 50 USDA and get as many product tokens as possible
const orderId = await multiAssetSwapEscrow(buyer, 
                     sellerUSDA,
                     swapAskedAssetAdaValue, 
                     swapConfigUSDA,
                     sellerProduct,
                     swapAskedAssetUSDAValue,
                     swapConfigProduct,
                     escrowConfig);

// Approve the escrow for a given order id
await approveEscrow(orderId, buyer, sellerProduct, escrowConfig);

// Close the swap position
await closeSwap(sellerUSDA, swapConfigUSDA);  
await closeSwap(sellerProduct, swapConfigProduct);  
await showWalletUTXOs("Buyer", buyer);
 
