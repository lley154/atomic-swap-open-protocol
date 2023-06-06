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

   assert(utxo.origOutput.datum.data.list.length == 2, "calcOrderDetails: invalid datum");

   // Get Values from the swap datum
   const askedAssetValue = Value.fromUplcData(utxo.origOutput.datum.data.list[0]);
   const offeredAssetValue = Value.fromUplcData(utxo.origOutput.datum.data.list[1]);

   const askedAssetMP = askedAssetValue.assets.mintingPolicies;
   var askedAssetMPH;
   var askedAssetTN;
   var askedAssetQty;

   // Check if the askedAsset is lovelace
   if (askedAssetMP.length == 0) {
       askedAssetMPH = MintingPolicyHash.fromHex("");
       askedAssetTN = askedAssetValue.assets.getTokenNames(askedAssetMPH)[0];
       askedAssetQty = askedAssetValue.lovelace;
   } else { 
       // The askedAsset is a native token and should only contain 1 MPH
       assert((askedAssetMP.length == 1), "calcOrderDetails: Invalid MPH found in asked Asset");  
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
       offeredAssetMPH = MintingPolicyHash.fromHex("");
       offeredAssetTN = offeredAssetValue.assets.getTokenNames(offeredAssetMPH)[0];
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
       swapAskedAssetMPH = MintingPolicyHash.fromHex("");
       swapAskedAssetTN = swapAskedAssetValue.assets.getTokenNames(swapAskedAssetMPH)[0];
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
       if (changeAmt < BigInt(swapInfo.minAda)) {
           changeAmt = BigInt(0);
       }
   } else if (changeAmt < 1) {
       changeAmt = BigInt(0);  
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
   if (changeAmt == BigInt(0)) {
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
           changeAmt
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