import { Assets,
         bytesToHex,
         MintingPolicyHash,
         UTxO,
         Value } from "@hyperionbt/helios";  
         
import { assert } from "../common/utils";

import { SwapInfo } from "../common/types"

export { calcOrderDetails }


/**
 * Determine the quantity of a product a buyer can purchase
 * given the amount he is willing to pay.
 * @param {UTxO} utxo
 * @param {Value} swapAskedAssetValue
 * @return {askedAssetVal: Value, 
 *            buyAssetVal: Value,
 *            offeredAssetVal: Value,
 *            changeAssetVal: Value,
 *            noChange : Boolean } 
 */
export default async function calcOrderDetails (utxo : UTxO, 
                                                swapAskedAssetValue : Value,
                                                swapInfo : SwapInfo ) : Promise<({
                                                                                    askedAssetVal: Value;
                                                                                    buyAssetVal: Value;
                                                                                    offeredAssetVal: Value;
                                                                                    changeAssetVal: Value;
                                                                                    noChange: Boolean;
                                                                                })> {

   // swapAskedAssetValue can't have any negative values
   swapAskedAssetValue.assertAllPositive();

   // Check the datum that it contains both the askedAsset and offeredAsset
   assert(utxo.origOutput.datum.data.list.length == 2, "calcOrderDetails: invalid datum");

   // Get Values from the swap datum
   const askedAssetValue = Value.fromUplcData(utxo.origOutput.datum.data.list[0]);
   const offeredAssetValue = Value.fromUplcData(utxo.origOutput.datum.data.list[1]);

   const askedAssetMP = askedAssetValue.assets.mintingPolicies;
   let askedAssetlovelace = false;
   var askedAssetMPH;
   var askedAssetTN;
   var askedAssetQty;


   // Check if the askedAsset is lovelace
   if (askedAssetMP.length == 0) {
       askedAssetlovelace = true;
       //askedAssetMPH "";
       //askedAssetTN = lovelaceTN;
       askedAssetQty = askedAssetValue.lovelace;
   } else { 
       // The askedAsset is a native token and should only contain 1 MPH
       assert((askedAssetMP.length == 1), "calcOrderDetails: Invalid MPH found in asked Asset");  
       askedAssetMPH = askedAssetValue.assets.mintingPolicies[0];
       askedAssetTN = askedAssetValue.assets.getTokenNames(askedAssetMPH)[0];
       askedAssetQty = askedAssetValue.assets.get(askedAssetMPH, askedAssetTN);
   }

   const offeredAssetMP = offeredAssetValue.assets.mintingPolicies;
   let offeredAssetlovelace = false;
   var offeredAssetMPH;
   var offeredAssetTN;
   var offeredAssetQty;

   // Check if the offeredAsset is lovelace
   if (offeredAssetMP.length == 0) {
       offeredAssetlovelace = true;
       //offeredAssetMPH = offeredAssetMP;
       //offeredAssetTN = lovelaceTN;
       offeredAssetQty = offeredAssetValue.lovelace;
   } else { 
       // The offeredAsset is a native token and should only contain 1 MPH
       assert(offeredAssetMP.length == 1);
       offeredAssetMPH = offeredAssetValue.assets.mintingPolicies[0];
       offeredAssetTN = offeredAssetValue.assets.getTokenNames(offeredAssetMPH)[0];
       offeredAssetQty = offeredAssetValue.assets.get(offeredAssetMPH, offeredAssetTN);
   }

   const swapAskedAssetMP = swapAskedAssetValue.assets.mintingPolicies;
   let swapAskedAssetlovelace = false;
   var swapAskedAssetMPH;
   var swapAskedAssetTN;
   var swapAskedAssetQty;

   // Check if the swapAskedAsset is lovelace
   if (swapAskedAssetMP.length == 0) {
        swapAskedAssetlovelace = true;
        //swapAskedAssetMPH = swapAskedAssetMP;
        //swapAskedAssetTN = lovelaceTN;
       swapAskedAssetQty = swapAskedAssetValue.lovelace;
   } else { 
       // The swapAskedAsset is a native token and should only contain 1 MPH
       assert(swapAskedAssetMP.length == 1);
       swapAskedAssetMPH = swapAskedAssetValue.assets.mintingPolicies[0];
       swapAskedAssetTN = swapAskedAssetValue.assets.getTokenNames(swapAskedAssetMPH)[0];
       swapAskedAssetQty = swapAskedAssetValue.assets.get(swapAskedAssetMPH, swapAskedAssetTN);
   }

   // If asked assets is not lovelace and asked and swap assets MPHs & TNs exist
   if (!askedAssetlovelace && 
        askedAssetMPH && 
        swapAskedAssetMPH &&
        askedAssetTN &&
        swapAskedAssetTN) {
        // Check that the askedAssets match
        if (askedAssetMPH.hex === swapAskedAssetMPH.hex &&
            bytesToHex(askedAssetTN) === bytesToHex(swapAskedAssetTN)) {
            console.log("");
            console.log("calcQtyToBuy: swap assets match");
        } else {
            throw console.error("calcQtyToBuy: swap assets don't match")
        }
   }
   
   var qtyToBuy : bigint;
   var qtyRemainder : bigint;
   var changeAmt : bigint;
   
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
       qtyRemainder = BigInt(0);
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
       if (changeAmt < BigInt(swapInfo.minAda)) {
           changeAmt = BigInt(0);
       }
   } else if (changeAmt < 1) {
       changeAmt = BigInt(0);  
   } 
   
   // Create the updated offeredAsset
   const updatedOfferedAsset = new Assets();
   var updatedOfferAssetValue;
   if (!offeredAssetlovelace && offeredAssetMPH && offeredAssetTN) {
        updatedOfferedAsset.addComponent(
            offeredAssetMPH,
            offeredAssetTN,
            qtyRemainder
        );
        updatedOfferAssetValue = new Value(BigInt(0), updatedOfferedAsset);
    
   } else {
        updatedOfferAssetValue = new Value(qtyRemainder);
   }

   // Create the offeredAsset that is being bought
   const buyOfferedAsset = new Assets();
   var buyOfferAssetValue;
   if (!offeredAssetlovelace && offeredAssetMPH && offeredAssetTN) {
        buyOfferedAsset.addComponent(
            offeredAssetMPH,
            offeredAssetTN,
            qtyToBuy
        );
        buyOfferAssetValue = new Value(BigInt(0), buyOfferedAsset);
   } else {
        buyOfferAssetValue = new Value(qtyToBuy);
   }

   // Create the change for the asked asset
   var noChangeAmt;
   var changeAskedAssetValue;
   if (changeAmt == BigInt(0)) {
       noChangeAmt = true;
   } else {
       noChangeAmt = false;
   }

   if (!swapAskedAssetlovelace && askedAssetMPH && askedAssetTN) {
        // Change is a native asset
       const changeAskedAsset = new Assets();
       changeAskedAsset.addComponent(
           askedAssetMPH,
           askedAssetTN,
           changeAmt
       );
       changeAskedAssetValue = new Value(BigInt(0), changeAskedAsset);   

   } else {
        // Change is in lovelace
        changeAskedAssetValue = new Value(changeAmt);
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