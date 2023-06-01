import Head from 'next/head'
import OpenSwap from '@/components/OpenSwap';
import UpdateSwap from '@/components/UpdateSwap';
import MintUserToken from '../components/MintUserToken';
import MintProductToken from '../components/MintProductToken';
import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import { useState, useEffect } from "react";
import WalletInfo from '../components/WalletInfo';
import SwapList from '../components/SwapList';
import SwapDetails from '../components/SwapDetails';
import LoadingSpinner from '../components/LoadingSpinner';
import UserTokenPolicy from '../contracts/userTokenPolicy.hl';
import UserTokenValidator from '../contracts/userTokenValidator.hl';
import SwapValidator from '../contracts/swap.hl';
import BeaconPolicy from '../contracts/beacon.hl';
import EscrowValidator from '../contracts/escrow.hl';
import ProductTokenPolicy from '../contracts/productTokenPolicy.hl';
import ProductTokenValidator from '../contracts/productTokenValidator.hl';

import { getNetworkParams,
         getSwapInfo,
         getSwaps,
         getSwapUtxo,
         signSubmitTx } from '../utils/network';

import { getTokenNames,
         getSwapDatumInfo,
         tokenCount } from '../utils/utxos';

import SwapInfo from '../utils/swaps';

import {
  Assets,
  Address,
  bytesToText,
  Cip30Handle,
  Cip30Wallet,
  config,
  Datum,
  hexToBytes,
  NetworkParams,
  Value,
  textToBytes,
  TxOutput,
  Tx,
  UTxO,
  WalletHelper,
  PubKeyHash,
  MintingPolicyHash} from "@hyperionbt/helios";
import { fromJSON } from 'postcss';
 

declare global {
  interface Window {
      cardano:any;
  }
}

// Helios config settings
config.AUTO_SET_VALIDITY_RANGE = false;

// Global variables
const minAda : bigint = BigInt(2_500_000); // minimum lovelace needed to send an NFT
const maxTxFee: bigint = BigInt(500_000); // maximum estimated transaction fee
const minChangeAmt: bigint = BigInt(1_000_000); // minimum lovelace needed to be sent back as change
const ownerPkh = new PubKeyHash(process.env.NEXT_PUBLIC_OWNER_PKH as string);
const serviceFee: bigint = BigInt(1_000_000); // service fee for a swap tx
const depositAda: bigint = BigInt(5_000_000); // buyer deposit for escrow
const optimize = false;
const network = "preview";
const version = "1.0";

// Compile the Beacon minting script
const beaconProgram = new BeaconPolicy();
beaconProgram.parameters = {["VERSION"] : version};
beaconProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
const beaconCompiledProgram = beaconProgram.compile(optimize);
const beaconMPH = beaconCompiledProgram.mintingPolicyHash;


export async function getServerSideProps() {

  try {
    
    // Get swap address(es) using beacon MPH
    const swaps = await getSwaps(beaconMPH);
    //console.log("swapInfo: ", JSON.stringify(swapInfo).toString());
    return { props: { swaps : JSON.stringify(swaps).toString()} };
    //return { props: {} };

  } catch (err) {
    console.log('getServerSideProps error: ', err);
  } 
  // No swaps found
  return { props: {} };
}

const Home: NextPage = (props : any) => {

  console.log("props: ", props);
  //const swapsList = JSON.parse(props);
  const optimize = false;
  const [walletInfo, setWalletInfo] = useState({ balance : []});
  const [walletIsEnabled, setWalletIsEnabled] = useState(false);
  const [whichWalletSelected, setWhichWalletSelected] = useState(undefined);
  const [walletAPI, setWalletAPI] = useState<undefined | any>(undefined);
  const [walletHelper, setWalletHelper] = useState<undefined | any>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [tx, setTx] = useState({ txId : '' });
  const [swapList, setSwapList] = useState(JSON.parse(props.swaps));
  //const [swapInfo, setSwapInfo] = useState(new SwapInfo('','','',0,'','',0));
  const [swapInfo, setSwapInfo] = useState<undefined | any>(undefined);

  useEffect(() => {
    const checkWallet = async () => {

      setWalletIsEnabled(await checkIfWalletFound());
    }
    checkWallet();
  }, [whichWalletSelected]);

  useEffect(() => {
    const enableSelectedWallet = async () => {
      if (walletIsEnabled) {
        await enableWallet();
      }
    }
    enableSelectedWallet();
  }, [walletIsEnabled]);

  useEffect(() => {
    const updateWalletInfo = async () => {

        if (walletIsEnabled) {
            const _balance = await getBalance() as [];
            setWalletInfo({
              ...walletInfo,
              balance : _balance
            });
        }
    }
    updateWalletInfo();
  }, [walletAPI]);

  // user selects what wallet to connect to
  const handleWalletSelect = (obj : any) => {
    const whichWalletSelected = obj.target.value
    setWhichWalletSelected(whichWalletSelected);
  }

  const checkIfWalletFound = async () => {

    let walletFound = false;

    const walletChoice = whichWalletSelected;
    if (walletChoice === "nami") {
        walletFound = !!window?.cardano?.nami;
    } else if (walletChoice === "eternl") {
        walletFound = !!window?.cardano?.eternl;
    }
    return walletFound;
  }

  const enableWallet = async () => {

      try {
        const walletChoice = whichWalletSelected;
        if (walletChoice === "nami") {
            const handle: Cip30Handle = await window.cardano.nami.enable();
            const walletAPI = new Cip30Wallet(handle);
            const walletHelper = new WalletHelper(walletAPI);
            setWalletHelper(walletHelper);
            setWalletAPI(walletAPI);
          } else if (walletChoice === "eternl") {
            const handle: Cip30Handle = await window.cardano.eternl.enable();
            const walletAPI = new Cip30Wallet(handle);
            const walletHelper = new WalletHelper(walletAPI);
            setWalletHelper(walletHelper);
            setWalletAPI(walletAPI);
          }
    } catch (err) {
        console.log('enableWallet error', err);
    }
  }

  const getBalance = async () => {
    let walletBalance = [];
    try {
        const balanceAmountValue  = await walletHelper.calcBalance();
        const adaAmount = BigInt(balanceAmountValue.lovelace);
        walletBalance.push({ mph: "", tn: "lovelace", qty: adaAmount.toLocaleString()});
        console.log("getBalance: ", balanceAmountValue.assets.dump());
        const values = balanceAmountValue.assets.dump();
        Object.entries(values).forEach(([keyMph, valueMph]) => {
          Object.entries(valueMph as {}).forEach(([tokenName, tokenQty]) => {            
            walletBalance.push({ mph: keyMph,
                                 tn: bytesToText(hexToBytes(tokenName)),
                                 qty: BigInt(tokenQty as bigint).toLocaleString()});
          })
        });
        return walletBalance;

    } catch (err) {
        console.log('getBalance error: ', err);
    }
  }

  // user selects the swap for more info
  const updateSwapDetails  = async (params : any) => {

    const beaconAsset = params.target.value;
    console.log("updateSwapDetail: ", beaconAsset);
    const swapInfo = await getSwapInfo(beaconAsset);

    setSwapInfo(swapInfo);

  }



  const mintUserToken = async (params : any) => {

    setIsLoading(true);

    // Re-enable wallet API since wallet account may have been changed
    await enableWallet();

    const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));

    try {

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Compile the user token validator script
      const userTokenValProgram = new UserTokenValidator();
      userTokenValProgram.parameters = {["VERSION"] : version};
      userTokenValProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      userTokenValProgram.parameters = {["USER_PKH"] : changeAddr.pubKeyHash.hex};
      const userTokenValCompiledProgram = userTokenValProgram.compile(optimize);  
      const userTokenValHash = userTokenValCompiledProgram.validatorHash;

      // Compile the user token policy script
      const userTokenPolicyProgram = new UserTokenPolicy();
      userTokenPolicyProgram.parameters = {["VERSION"] : version};
      userTokenPolicyProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      userTokenPolicyProgram.parameters = {["MIN_ADA"] : minAda};
      const userTokenPolicyCompiledProgram = userTokenPolicyProgram.compile(optimize);  
      const userTokenMPH = userTokenPolicyCompiledProgram.mintingPolicyHash;
      //console.log("IR: ", userTokenPolicyCompiledProgram.toString());

      // Get the UTxOs in User wallet
      const utxos = await walletHelper.pickUtxos(minUTXOVal);

      // Start building the transaction
      const tx = new Tx();

      console.log("utxos", utxos);
      // Add the user UTXOs as inputs
      tx.addInputs(utxos[0]);

      // Add the user token policy script as a witness to the transaction
      tx.attachScript(userTokenPolicyCompiledProgram);

      // Construct the user token
      const now = new Date()
      const before = new Date(now.getTime())
      before.setMinutes(now.getMinutes() - 5)
      const after = new Date(now.getTime())
      after.setMinutes(now.getMinutes() + 5)
      const userTokenTN = textToBytes("User Token|" + now.getTime().toString());
      const userTokens: [number[], bigint][] = [[userTokenTN, BigInt(2)]];

      // Create the user token poicy redeemer 
      const userTokenPolicyRedeemer = (new userTokenPolicyProgram
          .types.Redeemer
          .Mint(userTokenTN))
          ._toUplcData();
      
      // Add the mint to the tx
      tx.mintTokens(
          userTokenMPH,
          userTokens,
          userTokenPolicyRedeemer
      )

      // Create 1 user token
      const userToken: [number[], bigint][] = [[userTokenTN, BigInt(1)]];
      const userTokenAsset = new Assets([[userTokenMPH, userToken]]);
      const userTokenValue = new Value(BigInt(minAda), userTokenAsset);
      console.log("userTokenValue: ", userTokenValue.toSchemaJson());

      // Construct the reference token datum
      const userTokenDatum = new (userTokenValProgram.types.Datum)(
        changeAddr.pubKeyHash
      )
      
      // Create the output for the reference user token
      tx.addOutput(new TxOutput(
          Address.fromHashes(userTokenValHash),
          userTokenValue,
          Datum.inline(userTokenDatum)
      ));
      
      // Create the output for the user token
      tx.addOutput(new TxOutput(
          changeAddr,
          userTokenValue
      ));

      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add app wallet & user pkh as a signer which is required to mint user token
      tx.addSigner(changeAddr.pubKeyHash);
      tx.addSigner(ownerPkh);  // app owner signature

      console.log("tx before final", tx.dump());
      await tx.finalize(networkParams, changeAddr, utxos[1]);
      console.log("tx after final", tx.dump());
      

      // Sign tx with user signature
      const signatureUserWallet = await walletAPI.signTx(tx);
      tx.addSignatures(signatureUserWallet);

      console.log("Submitting transaction...");

      // Sign tx with owner signature and submit tx
      try {
        const txHash = await signSubmitTx(tx);
        setIsLoading(false); 
        console.log("txHash", txHash);
        setTx({ txId: txHash });
      } catch (error) {
        setIsLoading(false); 
        console.error("Mint User Token Failed: " + error);
      }

    } catch (err) {
        setIsLoading(false);
        throw console.error("mintUserToken tx failed", err);
    }

  }

  const mintProductToken = async (params : any) => {

    setIsLoading(true);

    // Re-enable wallet API since wallet account may have been changed
    await enableWallet();

    const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));

    try {

      const productName = params[0] as string;
      const productDescription = params[1] as string;
      const productImg = params[2] as string;
      const productId = params[3] as string;
      const qty = params[4] as string;
      
      // Get change address & network params
      const changeAddr = await walletHelper.changeAddress;
      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

       // Compile the user token validator script
       const productTokenValProgram = new ProductTokenValidator();
       productTokenValProgram.parameters = {["VERSION"] : version};
       productTokenValProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
       productTokenValProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
       productTokenValProgram.parameters = {["PRODUCT_ID"] : productId};
       const productTokenValCompiledProgram = productTokenValProgram.compile(optimize);  
       const productTokenValHash = productTokenValCompiledProgram.validatorHash;
 
      // Compile the product token policy script
      const productTokenPolicyProgram = new ProductTokenPolicy();
      productTokenPolicyProgram.parameters = {["VERSION"] : version};
      productTokenPolicyProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      productTokenPolicyProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
      productTokenPolicyProgram.parameters = {["PRODUCT_ID"] : productId};
      const productTokenPolicyCompiledProgram = productTokenPolicyProgram.compile(optimize);  
      const productTokenMPH = productTokenPolicyCompiledProgram.mintingPolicyHash;

      // Get the UTxOs in User wallet
      const utxos = await walletHelper.pickUtxos(minUTXOVal);

      // Start building the transaction
      const tx = new Tx();

      console.log("utxos", utxos);
      // Add the user UTXOs as inputs
      tx.addInputs(utxos[0]);

      // Add the user token policy script as a witness to the transaction
      tx.attachScript(productTokenPolicyCompiledProgram);

      // Construct the product token
      const now = new Date()
      const before = new Date(now.getTime())
      before.setMinutes(now.getMinutes() - 5)
      const after = new Date(now.getTime())
      after.setMinutes(now.getMinutes() + 5)
      const productTN = productName.slice(0,31);  // truncate to 32 chars 
      const productTokenTN = textToBytes(productTN);
      const productTokens: [number[], bigint][] = [[productTokenTN, BigInt(qty)]];
      const productTokensAsset = new Assets([[productTokenMPH, productTokens]]);
      const productTokensValue = new Value(BigInt(minAda), productTokensAsset);

      // Create the product token poicy redeemer 
      const productTokenPolicyRedeemer = (new productTokenPolicyProgram
          .types.Redeemer
          .Mint())
          ._toUplcData();
      
      // Add the mint to the tx
      tx.mintTokens(
          productTokenMPH,
          productTokens,
          productTokenPolicyRedeemer
      )

      // Create 1 product reference token
      const productToken: [number[], bigint][] = [[productTokenTN, BigInt(1)]];
      const productTokenAsset = new Assets([[productTokenMPH, productToken]]);
      const productTokenValue = new Value(BigInt(minAda), productTokenAsset);
      console.log("productTokenValue: ", productTokenValue.toSchemaJson());

      
      // Create the output for the product reference token
      tx.addOutput(new TxOutput(
          Address.fromHashes(productTokenValHash),
          productTokenValue
      ));
      
      // Create the output for the product tokens to be in circulation
      tx.addOutput(new TxOutput(
          changeAddr,
          productTokensValue.sub(productTokenValue)
      ));

      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add app wallet & user pkh as a signer which is required to mint user token
      tx.addSigner(changeAddr.pubKeyHash);
      tx.addSigner(ownerPkh);  // app owner signature

      // Attached the metadata for the minting transaction
      tx.addMetadata(721, {"map": [[productTokenMPH.hex, {"map": [[productName,
                                        {
                                          "map": [["name", productName],
                                                  ["description", productDescription],
                                                  ["image", productImg],
                                                  ["productId", productId]
                                                ]
                                        }
                                    ]]}
                                  ]]
                          }
                    );

      console.log("tx before final", tx.dump());
      await tx.finalize(networkParams, changeAddr, utxos[1]);
      console.log("tx after final", tx.dump());
      

      // Sign tx with user signature
      const signatureUserWallet = await walletAPI.signTx(tx);
      tx.addSignatures(signatureUserWallet);

      console.log("Submitting transaction...");

      // Sign tx with owner signature and submit tx
      try {
        const txHash = await signSubmitTx(tx);
        setIsLoading(false); 
        console.log("txHash", txHash);
        setTx({ txId: txHash });
      } catch (error) {
        setIsLoading(false); 
        console.error("Mint Product Token Failed: " + error);
      }

    } catch (err) {
        setIsLoading(false);
        throw console.error("Mint Product Token failed", err);
    }

  }

  const openSwap = async (params : any) => {

    setIsLoading(true);
    
    try {

      const askedMPH = params[0] as string;
      const askedTN = textToBytes(params[1] as string);
      const askedQty = params[2] as string;
      const offeredMPH = params[3] as string;
      const offeredTN = textToBytes(params[4] as string);
      const offeredQty = params[5] as string;
      const escrowEnabled = params[6] as string;
      const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));    

      // Re-enable wallet API since wallet account may have been changed
      await enableWallet();

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Compile the user token validator script
      const userTokenValProgram = new UserTokenValidator();
      userTokenValProgram.parameters = {["VERSION"] : version};
      userTokenValProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      userTokenValProgram.parameters = {["USER_PKH"] : changeAddr.pubKeyHash.hex};
      const userTokenValCompiledProgram = userTokenValProgram.compile(optimize);  
      const userTokenValHash = userTokenValCompiledProgram.validatorHash;

      // Compile the user token policy script
      const userTokenPolicyProgram = new UserTokenPolicy();
      userTokenPolicyProgram.parameters = {["VERSION"] : version};
      userTokenPolicyProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      userTokenPolicyProgram.parameters = {["MIN_ADA"] : minAda};
      const userTokenPolicyCompiledProgram = userTokenPolicyProgram.compile(optimize);  
      const userTokenMPH = userTokenPolicyCompiledProgram.mintingPolicyHash;

      // Create the escrow script
      const escrowProgram = new EscrowValidator();
      escrowProgram.parameters = {["VERSION"] : version};
      escrowProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
      escrowProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      const escrowCompiledProgram = escrowProgram.compile(optimize);
          
      // Compile the swap script
      const swapProgram = new SwapValidator();
      swapProgram.parameters = {["VERSION"] : version};
      swapProgram.parameters = {["ASKED_MPH"] : askedMPH};
      swapProgram.parameters = {["ASKED_TN"] : askedTN};
      swapProgram.parameters = {["OFFERED_MPH"] : offeredMPH};
      swapProgram.parameters = {["OFFERED_TN"] : offeredTN};
      swapProgram.parameters = {["BEACON_MPH"] : beaconMPH.hex};
      swapProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
      swapProgram.parameters = {["ESCROW_ENABLED"] : (escrowEnabled === "true")};
      swapProgram.parameters = {["ESCROW_HASH"] : escrowCompiledProgram.validatorHash.hex};
      swapProgram.parameters = {["USER_TOKEN_MPH"] : userTokenMPH.hex};
      swapProgram.parameters = {["USER_TOKEN_VHASH"] : userTokenValHash.hex};
      swapProgram.parameters = {["SERVICE_FEE"] : serviceFee};
      swapProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      swapProgram.parameters = {["MIN_ADA"] : minAda};
      swapProgram.parameters = {["DEPOSIT_ADA"] : depositAda};
      const swapCompiledProgram = swapProgram.compile(optimize);  

      // Now we are able to get the UTxOs in Seller wallet
      const utxos = await walletHelper.pickUtxos(minUTXOVal);

      // Start building the transaction
      const tx = new Tx();

      // Add the Seller UTXOs as inputs
      tx.addInputs(utxos[0]);

      // Add the beacon minting script as a witness to the transaction
      tx.attachScript(beaconCompiledProgram);

      // Create an Beacon Minting Init Redeemer because we must always send a Redeemer with
      // a plutus script transaction even if we don't actually use it.
      const beaconRedeemer = (new beaconProgram.types.Redeemer.Mint())._toUplcData();

      // Construct the Beacon asset & value
      const beaconTN = swapCompiledProgram.validatorHash.hex;
      const beaconToken: [number[], bigint][] = [[hexToBytes(beaconTN), BigInt(1)]];
      const beaconAsset = new Assets([[beaconMPH, beaconToken]]);
      const beaconValue = new Value(BigInt(0), beaconAsset);
      
      // Add the mint to the tx
      tx.mintTokens(
          beaconMPH,
          beaconToken,
          beaconRedeemer
      )

      // Construct the Seller Token value
      let sellerTokenTN: string[] = await getTokenNames(userTokenMPH, utxos[0]);
      var sellerTokenName;
      if (sellerTokenTN.length > 0) {
        sellerTokenName = sellerTokenTN.pop()!; // grab the first token name found
      } else {
        // If the seller token was not in the first set of UTXOs, look in the spares
        let sellerTokenTN: string[] = await getTokenNames(userTokenMPH, utxos[1]);
        
        if (sellerTokenTN.length > 0) {
          sellerTokenName = sellerTokenTN.pop()!; // grab the first token name found
        } else {
          throw console.error("No user token found");
        }
      }

      const sellerToken: [number[], bigint][] = [[textToBytes(sellerTokenName), BigInt(1)]];
      const sellerTokenAsset = new Assets([[userTokenMPH, sellerToken]]);
      const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);

      // Construct the asked asset value
      var askedAssetValue;
      if (askedMPH === "") {
        askedAssetValue = new Value(BigInt(askedQty));
      } else {
        const askedAsset = new Assets();
        askedAsset.addComponent(
          MintingPolicyHash.fromHex(askedMPH),
          askedTN,
          BigInt(askedQty)
        );
        askedAssetValue = new Value(BigInt(0), askedAsset);
      }

      // Create offered asset value
      var offeredAssetValue;
      if (offeredMPH === "") {
        offeredAssetValue = new Value(BigInt(offeredQty));
      } else {
        const offeredAsset = new Assets();
        offeredAsset.addComponent(
          MintingPolicyHash.fromHex(offeredMPH),
          offeredTN,
          BigInt(offeredQty)
        );
        offeredAssetValue = new Value(BigInt(0), offeredAsset);
      }
      
      // Construct the swap datum
      const swapDatum = new (swapProgram.types.Datum)(
          askedAssetValue,
          offeredAssetValue,
          (escrowEnabled === "true"),
          textToBytes(sellerTokenName),
          changeAddr.pubKeyHash.bytes,
          textToBytes(version)
        )
      
      // Attach the output with product asset, beacon token
      // and the swap datum to the swap script address
      const swapValue = (new Value(minAda))
                          .add(offeredAssetValue)
                          .add(beaconValue)
                          .add(sellerTokenValue);
  
      console.log("openSwap: swapValue: ", swapValue.toSchemaJson());
      tx.addOutput(new TxOutput(
          Address.fromHashes(swapCompiledProgram.validatorHash),
          swapValue,
          Datum.inline(swapDatum)
      ));

      // Construct the time validity interval
      const now = new Date();
      const before = new Date(now.getTime());
      before.setMinutes(now.getMinutes() - 5);
      const after = new Date(now.getTime());
      after.setMinutes(now.getMinutes() + 5);
 
      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add app wallet pkh as a signer which is required to mint beacon
      tx.addSigner(ownerPkh);

      console.log("tx before final", tx.dump());
      await tx.finalize(networkParams, changeAddr, utxos[1]);
      console.log("tx after final", tx.dump());
      
      // Sign tx with user signature
      const signatureOwnerWallet = await walletAPI.signTx(tx);
      tx.addSignatures(signatureOwnerWallet);

      console.log("Submitting transaction...");

      // Sign tx with owner signature and submit tx
      try {
        const txHash = await signSubmitTx(tx);
        setIsLoading(false); 
        console.log("txHash", txHash);
        setTx({ txId: txHash });
      } catch (error) {
        setIsLoading(false); 
        console.error("Open Swap Tx Failed: " + error);
      }

    } catch (err) {
      setIsLoading(false);
      throw console.error("Open Swap tx failed", err);
    }
  }

  
/**
 * Update swap askedAsset and/or offeredAsset
 * @package
 * @param {number} askedQty
 * @param {number} offeredQty
 */
const updateSwap = async (params : any) => {
    
  setIsLoading(true);
  console.log("params: ", params);
  
  try {

      const askedQty = params[0] as string;
      const offeredQty = params[1] as string;
      const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));    

      // Re-enable wallet API since wallet account may have been changed
      await enableWallet();

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Compile the user token validator script
      const userTokenValProgram = new UserTokenValidator();
      userTokenValProgram.parameters = {["VERSION"] : bytesToText(swapInfo.version)};
      userTokenValProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      userTokenValProgram.parameters = {["USER_PKH"] : changeAddr.pubKeyHash.hex};
      const userTokenValCompiledProgram = userTokenValProgram.compile(optimize);  
      const userTokenValHash = userTokenValCompiledProgram.validatorHash;

      // Compile the user token policy script
      const userTokenPolicyProgram = new UserTokenPolicy();
      userTokenPolicyProgram.parameters = {["VERSION"] : bytesToText(swapInfo.version)};
      userTokenPolicyProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      userTokenPolicyProgram.parameters = {["MIN_ADA"] : minAda};
      const userTokenPolicyCompiledProgram = userTokenPolicyProgram.compile(optimize);  
      const userTokenMPH = userTokenPolicyCompiledProgram.mintingPolicyHash;

      // Create the escrow script
      const escrowProgram = new EscrowValidator();
      escrowProgram.parameters = {["VERSION"] : bytesToText(swapInfo.version)};
      escrowProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
      escrowProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      const escrowCompiledProgram = escrowProgram.compile(optimize);

      // Compile the swap script
      const swapProgram = new SwapValidator();
      swapProgram.parameters = {["VERSION"] : swapInfo.version};
      swapProgram.parameters = {["ASKED_MPH"] : swapInfo.askedMPH};
      swapProgram.parameters = {["ASKED_TN"] : swapInfo.askedTN};
      swapProgram.parameters = {["OFFERED_MPH"] : swapInfo.offeredMPH};
      swapProgram.parameters = {["OFFERED_TN"] : swapInfo.offeredTN};
      swapProgram.parameters = {["BEACON_MPH"] : beaconMPH.hex};
      swapProgram.parameters = {["SELLER_PKH"] : swapInfo.sellerPkh};
      swapProgram.parameters = {["ESCROW_ENABLED"] : swapInfo.escrowEnabled};
      swapProgram.parameters = {["ESCROW_HASH"] : escrowCompiledProgram.validatorHash.hex};
      swapProgram.parameters = {["USER_TOKEN_MPH"] : userTokenMPH.hex};
      swapProgram.parameters = {["USER_TOKEN_VHASH"] : userTokenValHash.hex};
      swapProgram.parameters = {["SERVICE_FEE"] : serviceFee};
      swapProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      swapProgram.parameters = {["MIN_ADA"] : minAda};
      swapProgram.parameters = {["DEPOSIT_ADA"] : depositAda};
      const swapCompiledProgram = swapProgram.compile(optimize);
      const swapValHash = swapCompiledProgram.validatorHash;

      // Now we are able to get the UTxOs in Seller wallet
      const utxos = await walletHelper.pickUtxos(minUTXOVal);

      // Start building the transaction
      const tx = new Tx();

      // Add the Seller UTXOs as inputs
      tx.addInputs(utxos[0]);

      // Add the script as a witness to the transaction
      tx.attachScript(swapCompiledProgram);

      // Get the UTXO that has the swap datum
      const swapUtxo = await getSwapUtxo(Address.fromHashes(swapValHash), beaconMPH);

      // Create the swap redeemer
      const swapRedeemer = (new swapProgram.types.Redeemer
                              .Update(textToBytes(swapInfo.sellerTokenTN))
                           )._toUplcData();
      
      tx.addInput(swapUtxo, swapRedeemer);  
      
      // Get the qty of the offeredAssetValue from the datum
      const datumInfo = await getSwapDatumInfo(swapUtxo);

      // Create updated offered asset value
      var offeredAssetValue;
      if (swapInfo.offeredMPH === "") {
        offeredAssetValue = new Value(BigInt(offeredQty));
      } else {
        const offeredAsset = new Assets();
        offeredAsset.addComponent(
          MintingPolicyHash.fromHex(swapInfo.offeredMPH),
          swapInfo.offeredTN,
          BigInt(offeredQty)
        );
        offeredAssetValue = new Value(BigInt(0), offeredAsset);
      }

      // Now calculate the new updated offerAssetValue
      const updatedOfferedAssetValue = datumInfo.offeredAssetValue
                                                .add(offeredAssetValue);
      
      // Confirm that the updated offeredAssetValue is positive
      updatedOfferedAssetValue.assertAllPositive();

      // Construct the asked asset value
      var askedAssetValue;
      if (swapInfo.askedMPH === "") {
        askedAssetValue = new Value(BigInt(askedQty));
      } else {
        const askedAsset = new Assets();
        askedAsset.addComponent(
          MintingPolicyHash.fromHex(swapInfo.askedMPH),
          swapInfo.askedTN,
          BigInt(askedQty)
        );
        askedAssetValue = new Value(BigInt(0), askedAsset);
      }

      // Construct the swap datum
      const swapDatum = new (swapProgram.types.Datum)(
          askedAssetValue,
          updatedOfferedAssetValue,
          swapInfo.escrowEnabled,
          textToBytes(swapInfo.sellerTokenName),
          textToBytes(swapInfo.sellerPkh),
          textToBytes(version)
        )

      // Construct the Beacon value
      const beaconTN = swapCompiledProgram.validatorHash.hex;
      const beaconToken : [number[], bigint][] = [[hexToBytes(beaconTN), BigInt(1)]];
      const beaconAsset = new Assets([[beaconMPH, beaconToken]]);
      const beaconValue = new Value(BigInt(0), beaconAsset);

      // Construct the Seller Token value
      const sellerToken : [number[], bigint][]  = [[textToBytes(swapInfo.sellerTokenTN), BigInt(1)]];
      const sellerTokenAsset = new Assets([[userTokenMPH, sellerToken]]);
      const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);
      
      const swapValue = (new Value(minAda))
                          .add(updatedOfferedAssetValue)
                          .add(beaconValue)
                          .add(sellerTokenValue);

      tx.addOutput(new TxOutput(
          Address.fromHashes(swapCompiledProgram.validatorHash),
          swapValue,
          Datum.inline(swapDatum)
      ));

      // Construct the time validity interval
      const now = new Date();
      const before = new Date(now.getTime());
      before.setMinutes(now.getMinutes() - 5);
      const after = new Date(now.getTime());
      after.setMinutes(now.getMinutes() + 5);
 
      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add seller wallet pkh as a signer which is required for an update
      tx.addSigner(changeAddr.pubKeyHash);

      console.log("");
      console.log("************ EXECUTE SWAP VALIDATOR CONTRACT ************");
      await tx.finalize(networkParams, changeAddr, utxos[1]);
      console.log("Tx Fee", tx.body.fee);
      console.log("Tx Execution Units", tx.witnesses.dump().redeemers);

      // Sign tx with sellers signature
      const signatures = await walletAPI.signTx(tx);
      tx.addSignatures(signatures);

      console.log("Submitting transaction...");

      // Sign tx with owner signature and submit tx
      try {
        const txHash = await signSubmitTx(tx);
        setIsLoading(false); 
        console.log("txHash", txHash);
        setTx({ txId: txHash });
      } catch (error) {
        setIsLoading(false); 
        console.error("Update Swap Tx Failed: " + error);
      }

    } catch (err) {
      setIsLoading(false);
      throw console.error("Open Swap tx failed", err);
    }
}



  return (
    <div className={styles.container}>
      <Head>
        <title>Atomic Swap Open Protocol</title>
        <meta name="description" content="Atomic Swap Open Protocol" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h3 className={styles.title}>
          Atomic Swap Open Protocol
        </h3>

        <div className={styles.borderwallet}>
            <p>
              Connect to your wallet
            </p>
            <p className={styles.borderwallet}>
              <input type="radio" id="nami" name="wallet" value="nami" onChange={handleWalletSelect}/>
                <label>Nami</label>
            </p>
            <p className={styles.borderwallet}>
                <input type="radio" id="eternl" name="wallet" value="eternl" onChange={handleWalletSelect}/>
                <label>Eternl</label>
            </p>
          </div>
            {!tx.txId && walletIsEnabled && <div className={styles.border}><WalletInfo walletInfo={walletInfo}/></div>}
            {isLoading && <LoadingSpinner />}
            {tx.txId && <div className={styles.border}><b>Transaction Success!!!</b>
            <p>TxId &nbsp;&nbsp;<a href={"https://preview.cexplorer.io/tx/" + tx.txId} target="_blank" rel="noopener noreferrer" >{tx.txId}</a></p>
            <p>Please wait until the transaction is confirmed on the blockchain and reload this page before doing another transaction</p>
          </div>}
          {walletIsEnabled && !tx.txId && <div className={styles.border}><SwapList swapList={swapList} onSwapInfo={updateSwapDetails}/></div>}
          {walletIsEnabled && !tx.txId && swapInfo && <div className={styles.border}><SwapDetails swapInfo={swapInfo}/></div>}
          {walletIsEnabled && !tx.txId && <div className={styles.border}><MintUserToken onMintUserToken={mintUserToken}/></div>}
          {walletIsEnabled && !tx.txId && <div className={styles.border}><MintProductToken onMintProductToken={mintProductToken}/></div>}
          {walletIsEnabled && !tx.txId && <div className={styles.border}><OpenSwap onOpenSwap={openSwap}/></div>}
          {walletIsEnabled && !tx.txId && <div className={styles.border}><UpdateSwap onUpdateSwap={updateSwap}/></div>}

      </main>

      <footer className={styles.footer}>

      </footer>
    </div>
  )
}

export default Home