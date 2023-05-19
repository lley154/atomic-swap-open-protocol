import {
    Assets, 
    MintingPolicyHash,
    Value,
    textToBytes
} from "@hyperionbt/helios";

import {
    approveEscrow,
    assetSwapEscrow,
    beaconMPH,
    closeSwap,
    escrowProgram,
    EscrowConfig,
    initSwap,
    getMphTnQty,
    owner,
    minAda,
    mintUserTokens,
    network,
    optimize,
    SwapConfig,
    showWalletUTXOs,
    updateSwap
} from "./swap-simulator.mjs"

// Create seller wallet - we add 10ADA to start
const seller = network.createWallet(BigInt(20_000_000));

// Create buyer wallet - we add 10ADA to start
const buyer = network.createWallet(BigInt(20_000_000));

// Now lets tick the network on 10 slots,
network.tick(BigInt(10));

// Create the seller token
const sellerToken = await mintUserTokens(seller, 2);

// Create the asset value being asked for
const askedAssetValue = new Value(BigInt(15_000_000));

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

// Add product token to the seller wallet
network.createUtxo(seller, minAda, productAsset);

// Add 100ADA in buyer wallet for swap
network.createUtxo(buyer, BigInt(100_000_000));

// Now lets tick the network on 10 slots
network.tick(BigInt(10));

// Create asset value to be offered
const offeredAsset = new Assets();
offeredAsset.addComponent(
    productMPH,
    productTN,
    BigInt(5)
);
const offeredAssetValue = new Value(BigInt(0), offeredAsset);

const escrowConfig = new EscrowConfig(buyer.pubKeyHash.hex,
                                      seller.pubKeyHash.hex,
                                      owner.pubKeyHash.hex);

// Create the escrow config parameters
escrowProgram.parameters = {["BUYER_PKH"] : escrowConfig.buyerPkh};
escrowProgram.parameters = {["SELLER_PKH"] : escrowConfig.sellerPkh};
escrowProgram.parameters = {["OWNER_PKH"] : escrowConfig.ownerPkh};
const escrowCompiledProgram = escrowProgram.compile(optimize);
//const escrowAddress = Address.fromHashes(escrowCompiledProgram.validatorHash);                                   

// Create the swap config parameters
const askedValueInfo = await getMphTnQty(askedAssetValue);
const offeredValueInfo = await getMphTnQty(offeredAssetValue);
const swapConfig = new SwapConfig(askedValueInfo.mph,
                                  askedValueInfo.tn,
                                  offeredValueInfo.mph,
                                  offeredValueInfo.tn,
                                  beaconMPH.hex,
                                  seller.pubKeyHash.hex,
                                  true, // set escrow enabled to true
                                  escrowCompiledProgram.validatorHash.hex,
                                  sellerToken.mph,
                                  1_000_000, // 1 Ada service fee
                                  owner.pubKeyHash.hex,
                                  2_500_000, // minAda amt
                                  5_000_000  // deposit
                                  );


// Initialize with price of 15 Ada and 5 product tokens
await initSwap(buyer, seller, askedAssetValue, offeredAssetValue, swapConfig, sellerToken.tn);   

// Create the updated asset value being asked for
const updatedAskedAssetValue = new Value(BigInt(10_000_000));

// Create the additional asset (value) to be offered
const updatedOfferedAsset = new Assets();
updatedOfferedAsset.addComponent(
    productMPH,
    productTN,
    BigInt(5)
);
const updatedOfferedAssetValue = new Value(BigInt(0), updatedOfferedAsset);

// Change price to 10 Ada and add 5 more product tokens
await updateSwap(buyer, seller, updatedAskedAssetValue, updatedOfferedAssetValue, swapConfig, sellerToken.tn); 


const swapAskedAssetValue = new Value(BigInt(25_000_000));

// Create the buyer token
const buyerToken = await mintUserTokens(buyer, 2);

// Swap 25 Ada and get as many product tokens as possible
const orderId = await assetSwapEscrow(buyer, seller, swapAskedAssetValue, swapConfig, escrowConfig, sellerToken.tn, buyerToken.tn);

// Approve the escrow for a given order id
await approveEscrow(orderId, buyer, seller, escrowConfig);   

// Close the swap position
await closeSwap(seller, swapConfig, sellerToken.tn);
showWalletUTXOs("Buyer", buyer);