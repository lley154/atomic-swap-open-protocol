import Head from 'next/head'
import styles from '../styles/Home.module.css'
import type { NextPage } from 'next'
import { useState, useEffect } from "react";
import AssetSwap from '../components/AssetSwap';
import BeaconPolicy from '../contracts/beacon.hl';
import EscrowValidator from '../contracts/escrow.hl';
import EscrowList from '../components/EscrowList';
import EscrowDetails from '../components/EscrowDetails';
import LoadingSpinner from '../components/LoadingSpinner';
import MintUserToken from '../components/MintUserToken';
import MintProductToken from '../components/MintProductToken';
import OpenSwap from '../components/OpenSwap';
import ProductTokenPolicy from '../contracts/productTokenPolicy.hl';
import ProductTokenValidator from '../contracts/productTokenValidator.hl';
import SwapValidator from '../contracts/swap.hl';
import SwapList from '../components/SwapList';
import SwapDetails from '../components/SwapDetails';
import UserTokenPolicy from '../contracts/userTokenPolicy.hl';
import UserTokenValidator from '../contracts/userTokenValidator.hl';
import WalletInfo from '../components/WalletInfo';
import { getEscrows,
         getEscrowInfo,
         getEscrowUtxo,
         getNetworkParams,
         getSwapInfo,
         getSwapUtxo,
         getSwaps,
         signSubmitTx,
         submitTx } from '../common/network';
import { getEscrowDatumInfo,
         getRefTokenUTXO,
         getTokenNames } from '../common/utxos';
import assert from '../common/utils';
import calcOrderDetails from '../common/orders';
import {
  Assets,
  Address,
  bytesToHex,
  bytesToText,
  Cip30Handle,
  Cip30Wallet,
  config,
  Datum,
  hexToBytes,
  MintingPolicyHash,
  NetworkParams,
  PubKeyHash,
  textToBytes,
  TxOutput,
  Tx,
  UTxO,
  Value,
  WalletHelper
  } from "@hyperionbt/helios";

declare global {
  interface Window {
      cardano:any;
  }
}

// Helios config settings
config.AUTO_SET_VALIDITY_RANGE = false;

// Global variables
const version = "3.8";
const optimize = true;
const network = "preprod";
const userTokenName = "UT";
const minAda : bigint = BigInt(3_500_000); // minimum lovelace needed when sending tokens
const maxTxFee: bigint = BigInt(10_000_000); // maximum estimated transaction fee
const minChangeAmt: bigint = BigInt(1_000_000); // minimum lovelace needed to be sent back as change
const ownerPKH = new PubKeyHash(process.env.NEXT_PUBLIC_OWNER_PKH as string);
const serviceFee: bigint = BigInt(1_000_000); // service fee for a swap tx
const depositAda: bigint = BigInt(5_000_000); // buyer deposit for escrow
const ttl : number = 5; // Time to live validity interval

// Compile the Beacon minting script
const beaconProgram = new BeaconPolicy();
beaconProgram.parameters = {["VERSION"] : version};
beaconProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
const beaconCompiledProgram = beaconProgram.compile(optimize);
const beaconMPH = beaconCompiledProgram.mintingPolicyHash;

export async function getServerSideProps() {

  try {
    // Get swap address(es) using beacon MPH
    const swaps = await getSwaps(beaconMPH);
    if (swaps.length > 0 ) {
      return { props: { noSwaps : false, swaps : JSON.stringify(swaps).toString()} };
    } else {
      return { props: { noSwaps : true, swaps : JSON.stringify(swaps).toString()} }
    }
  } catch (err) {
    console.error("getServerSideProps: No swaps found");
  } 
  // No swaps found
  return { props: { noSwaps : true } };
}

const Home: NextPage = (props : any) => {

  const [escrowInfo, setEscrowInfo] = useState<undefined | any>(undefined);
  const [escrowList, setEscrowList] = useState<undefined | any>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [swapList, setSwapList] = useState<undefined | any>(undefined);
  const [swapInfo, setSwapInfo] = useState<undefined | any>(undefined);
  const [tx, setTx] = useState({ txId : '' });
  const [walletInfo, setWalletInfo] = useState({ pkh : '', balance : []});
  const [walletIsEnabled, setWalletIsEnabled] = useState(false);
  const [whichWalletSelected, setWhichWalletSelected] = useState(undefined);
  const [walletAPI, setWalletAPI] = useState<undefined | any>(undefined);
  const [walletHelper, setWalletHelper] = useState<undefined | any>(undefined);
  
  useEffect(() => {
    const checkWallet = async () => {
      //const walletEnabled = await checkIfWalletFound();
      let walletFound = false;
      if (whichWalletSelected === "nami") {
          walletFound = !!window?.cardano?.nami;
      } else if (whichWalletSelected === "eternl") {
          walletFound = !!window?.cardano?.eternl;
      }
      setWalletIsEnabled(walletFound);
    }
    checkWallet();
  }, [whichWalletSelected]);


  useEffect(() => {
    const enableSelectedWallet = async () => {
      await enableWallet(whichWalletSelected!);
    }
    if (whichWalletSelected && walletIsEnabled) {
      enableSelectedWallet();
    }
  }, [walletIsEnabled, whichWalletSelected]);


  useEffect(() => {
    const updateWalletInfo = async () => {
        if (walletIsEnabled) {
            if (walletAPI) {
              const wallet = new WalletHelper(walletAPI);
              setWalletHelper(wallet);
              const changeAddr = await wallet.changeAddress;
              const walletBalance = await getBalance(wallet) as [];
              setWalletInfo({
                ...walletInfo,
                pkh : changeAddr.pubKeyHash.hex,
                balance : walletBalance
              });
          }
        }
    }
    updateWalletInfo();
  }, [walletAPI, walletInfo, walletIsEnabled]);

  useEffect(() => {
    const updateSwapList = async () => {
        if (!props.noSwaps) {
            setSwapList(JSON.parse(props.swaps));
        }
    }
    updateSwapList();
  }, [walletAPI, props.noSwaps, props.swaps]);

  useEffect(() => {
      const updateEscrowList = async () => {

      // Create the escrow script
      const escrowProgram = new EscrowValidator();
      escrowProgram.parameters = {["VERSION"] : version};
      escrowProgram.parameters = {["SELLER_PKH"] : hexToBytes(swapInfo.sellerPKH)};
      escrowProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
      const escrowCompiledProgram = escrowProgram.compile(optimize);
      const escrowValAddr = Address.fromHashes(escrowCompiledProgram.validatorHash);

      try {
        if (swapInfo.escrowEnabled) {
          const escrows = await getEscrows(escrowValAddr);
          setEscrowList(escrows);
        }
      } catch (e) {
        console.error("no escrows found");
      }
    }
    if (walletAPI && swapInfo) {  // avoid rendering on first render
      if (swapInfo.escrowEnabled) {
        updateEscrowList();
      }  
    }
  }, [swapInfo, walletAPI]);

  // user selects what wallet to connect to
  const handleWalletSelect = (obj : any) => {
    const whichWalletSelected = obj.target.value
    setWhichWalletSelected(whichWalletSelected);
  }

  /*
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
  */

  const enableWallet = async (walletChoice : string) => {

      try {
        //const walletChoice = whichWalletSelected;
        if (walletChoice === "nami") {
            const handle: Cip30Handle = await window.cardano.nami.enable();
            const walletAPI = new Cip30Wallet(handle);
            const walletHelper = new WalletHelper(walletAPI);
            setWalletAPI(walletAPI);
            setWalletHelper(walletHelper);

          } else if (walletChoice === "eternl") {
            const handle: Cip30Handle = await window.cardano.eternl.enable();
            const walletAPI = new Cip30Wallet(handle);
            const walletHelper = new WalletHelper(walletAPI);
            setWalletAPI(walletAPI);
            setWalletHelper(walletHelper);
          }
    } catch (err) {
        console.error('enableWallet error', err);
    }
  }
/*
  const getPkh = async () => {

    const changeAddr = await walletHelper.changeAddress;
    return changeAddr.pubKeyHash.hex;
  }
*/
  const getBalance = async (wallet : WalletHelper) => {

    let walletBalance = [];
    try {
        //const balanceAmountValue  = await walletHelper.calcBalance();
        const balanceAmountValue  = await wallet.calcBalance();
        const adaAmount = BigInt(balanceAmountValue.lovelace);
        walletBalance.push({ mph: "", tn: "lovelace", qty: adaAmount.toLocaleString()});
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
        console.error('getBalance error: ', err);
    }
  }

  // Get swap info for a swap that has been selected
  const updateSwapDetails  = async (params : any) => {

    const beaconAsset = params.target.value;
    const swapInfo = await getSwapInfo(beaconAsset);
    setSwapInfo(swapInfo);
  }

  // Get escrow info for an escaroe that has been selected
  const updateEscrowDetails  = async (params : any) => {

    const txHash = params.target.value;
    const txId = txHash.split('#')[0];
    const txIdx = txHash.split('#')[1];
    const escrowInfo = await getEscrowInfo(beaconMPH.hex, txId, txIdx);
    setEscrowInfo(escrowInfo);
  }

  const mintUserToken = async (params : any) => {

    setIsLoading(true);
    const userInfo = (params[0] as string).trim();
    // Do something with user info if needed
    console.log("userInfo: ", userInfo);

    // Re-enable wallet API since wallet account may have been changed
    await enableWallet(whichWalletSelected!);

    const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));

    try {
      // Get change address
      const changeAddr = await walletHelper.changeAddress;
      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Compile the user token validator script
      const userTokenValProgram = new UserTokenValidator();
      userTokenValProgram.parameters = {["VERSION"] : version};
      userTokenValProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
      userTokenValProgram.parameters = {["USER_PKH"] : changeAddr.pubKeyHash.hex};
      const userTokenValCompiledProgram = userTokenValProgram.compile(optimize);  
      const userTokenValHash = userTokenValCompiledProgram.validatorHash;

      // Compile the user token policy script
      const userTokenPolicyProgram = new UserTokenPolicy();
      userTokenPolicyProgram.parameters = {["VERSION"] : version};
      userTokenPolicyProgram.parameters = {["TOKEN_NAME"] : textToBytes(userTokenName)};
      userTokenPolicyProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
      userTokenPolicyProgram.parameters = {["MIN_ADA"] : minAda};
      const userTokenPolicyCompiledProgram = userTokenPolicyProgram.compile(optimize);  
      const userTokenMPH = userTokenPolicyCompiledProgram.mintingPolicyHash;
  
      // Get the UTxOs in User wallet
      const utxos = await walletHelper.pickUtxos(minUTXOVal);

      // Start building the transaction
      const tx = new Tx();

      // Add the user UTXOs as inputs
      tx.addInputs(utxos[0]);

      // Add the user token policy script as a witness to the transaction
      tx.attachScript(userTokenPolicyCompiledProgram);

      // Construct the user token
      const now = new Date()
      const before = new Date(now.getTime())
      before.setMinutes(now.getMinutes() - ttl)
      const after = new Date(now.getTime())
      after.setMinutes(now.getMinutes() + ttl)
      const userTokenTN = textToBytes(userTokenName + "|" + now.getTime().toString());
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

      // Create a user token
      const userToken: [number[], bigint][] = [[userTokenTN, BigInt(1)]];
      const userTokenAsset = new Assets([[userTokenMPH, userToken]]);
      const userTokenValue = new Value(BigInt(minAda), userTokenAsset);
      
      // Construct the reference token datum
      const userTokenDatum = new (userTokenValProgram.types.Datum)(
        changeAddr.pubKeyHash.hex
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
      tx.addSigner(ownerPKH);  // app owner signature

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
    await enableWallet(whichWalletSelected!);

    const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));

    try {
      const productName = (params[0] as string).trim();
      const productDescription = (params[1] as string).trim();
      const productImg = (params[2] as string).trim();
      const productId = (params[3] as string).trim();
      const qty = params[4] as string;
      
      // Get change address & network params
      const changeAddr = await walletHelper.changeAddress;
      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

       // Compile the user token validator script
       const productTokenValProgram = new ProductTokenValidator();
       productTokenValProgram.parameters = {["VERSION"] : version};
       productTokenValProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
       productTokenValProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
       productTokenValProgram.parameters = {["PRODUCT_ID"] : productId};
       const productTokenValCompiledProgram = productTokenValProgram.compile(optimize);  
       const productTokenValHash = productTokenValCompiledProgram.validatorHash;

      // Compile the product token policy script
      const productTokenPolicyProgram = new ProductTokenPolicy();
      productTokenPolicyProgram.parameters = {["VERSION"] : version};
      productTokenPolicyProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
      productTokenPolicyProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
      productTokenPolicyProgram.parameters = {["PRODUCT_ID"] : productId};
      const productTokenPolicyCompiledProgram = productTokenPolicyProgram.compile(optimize);  
      const productTokenMPH = productTokenPolicyCompiledProgram.mintingPolicyHash;

      // Get the UTxOs in User wallet
      const utxos = await walletHelper.pickUtxos(minUTXOVal);

      // Start building the transaction
      const tx = new Tx();

      // Add the user UTXOs as inputs
      tx.addInputs(utxos[0]);

      // Add the user token policy script as a witness to the transaction
      tx.attachScript(productTokenPolicyCompiledProgram);

      // Construct the product token
      const now = new Date()
      const before = new Date(now.getTime())
      before.setMinutes(now.getMinutes() - ttl)
      const after = new Date(now.getTime())
      after.setMinutes(now.getMinutes() + ttl)
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

      // Create a product reference token
      const productToken: [number[], bigint][] = [[productTokenTN, BigInt(1)]];
      const productTokenAsset = new Assets([[productTokenMPH, productToken]]);
      const productTokenValue = new Value(BigInt(minAda), productTokenAsset);
      
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
      tx.addSigner(ownerPKH);  // app owner signature

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

      const askedMPH = (params[0] as string).trim();
      const askedTN = textToBytes((params[1] as string).trim());
      const askedQty = params[2] as string;
      const offeredMPH = (params[3] as string).trim();
      const offeredTN = textToBytes((params[4] as string).trim());
      const offeredQty = params[5] as string;
      const escrowEnabled = params[6] as boolean;
      const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));    

      // Re-enable wallet API since wallet account may have been changed
      await enableWallet(whichWalletSelected!);

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      // Get network parameters
      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Compile the user token validator script
      const userTokenValProgram = new UserTokenValidator();
      userTokenValProgram.parameters = {["VERSION"] : version};
      userTokenValProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
      userTokenValProgram.parameters = {["USER_PKH"] : changeAddr.pubKeyHash.hex};
      const userTokenValCompiledProgram = userTokenValProgram.compile(optimize);  
      const userTokenValHash = userTokenValCompiledProgram.validatorHash;

      // Compile the user token policy script
      const userTokenPolicyProgram = new UserTokenPolicy();
      userTokenPolicyProgram.parameters = {["VERSION"] : version};
      userTokenPolicyProgram.parameters = {["TOKEN_NAME"] : textToBytes(userTokenName)};
      userTokenPolicyProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
      userTokenPolicyProgram.parameters = {["MIN_ADA"] : minAda};
      const userTokenPolicyCompiledProgram = userTokenPolicyProgram.compile(optimize);  
      const userTokenMPH = userTokenPolicyCompiledProgram.mintingPolicyHash;

      // Create the escrow script
      const escrowProgram = new EscrowValidator();
      escrowProgram.parameters = {["VERSION"] : version};
      escrowProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
      escrowProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
      const escrowCompiledProgram = escrowProgram.compile(optimize);
      const escrowHash = escrowCompiledProgram.validatorHash;
   
      // Get the UTxOs in Seller wallet
      const utxos = await walletHelper.pickUtxos(minUTXOVal);

      // Get the Seller Token Name
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
          
      // Compile the swap script
      const swapProgram = new SwapValidator();
      swapProgram.parameters = {["VERSION"] : version};
      swapProgram.parameters = {["ASKED_MPH"] : askedMPH};
      swapProgram.parameters = {["ASKED_TN"] : askedTN};
      swapProgram.parameters = {["OFFERED_MPH"] : offeredMPH};
      swapProgram.parameters = {["OFFERED_TN"] : offeredTN};
      swapProgram.parameters = {["BEACON_MPH"] : beaconMPH.hex};
      swapProgram.parameters = {["SELLER_PKH"] : changeAddr.pubKeyHash.hex};
      swapProgram.parameters = {["SELLER_TN"] : textToBytes(sellerTokenName)};
      swapProgram.parameters = {["ESCROW_ENABLED"] : escrowEnabled.toString()};
      swapProgram.parameters = {["ESCROW_HASH"] : escrowHash.hex};
      swapProgram.parameters = {["USER_TOKEN_MPH"] : userTokenMPH.hex};
      swapProgram.parameters = {["USER_TOKEN_VHASH"] : userTokenValHash.hex};
      swapProgram.parameters = {["SERVICE_FEE"] : serviceFee};
      swapProgram.parameters = {["OWNER_PKH"] : ownerPKH.hex};
      swapProgram.parameters = {["MIN_ADA"] : minAda};
      swapProgram.parameters = {["DEPOSIT_ADA"] : depositAda};
      const swapCompiledProgram = swapProgram.compile(optimize); 
      
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
          offeredAssetValue
        )
      
      // Attach the output with product asset, beacon token
      // and the swap datum to the swap script address
      const swapValue = (new Value(minAda))
                          .add(offeredAssetValue)
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
      before.setMinutes(now.getMinutes() - ttl);
      const after = new Date(now.getTime());
      after.setMinutes(now.getMinutes() + ttl);
 
      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add app wallet pkh as a signer which is required to mint beacon
      tx.addSigner(ownerPKH);
      tx.addSigner(changeAddr.pubKeyHash);

      tx.addMetadata(2000, {"map": [[beaconMPH.hex, {"map": [[beaconTN,
                {
                  "map": [["VERSION", version],
                          ["ASKED_MPH", askedMPH],
                          ["ASKED_TN", bytesToText(askedTN)],
                          ["ASKED_PRICE", askedQty],
                          ["OFFERED_MPH", offeredMPH],
                          ["OFFERED_TN", bytesToText(offeredTN)],
                          ["OFFERED_QTY", offeredQty],
                          ["BEACON_MPH", beaconMPH.hex],
                          ["SELLER_PKH", changeAddr.pubKeyHash.hex],
                          ["SELLER_TN", sellerTokenName],
                          ["ESCROW_ENABLED", escrowEnabled.toString()],
                          ["ESCROW_HASH", escrowHash.hex],
                          ["USER_TOKEN_MPH", userTokenMPH.hex],
                          ["USER_TOKEN_VHASH", userTokenValHash.hex],
                          ["SERVICE_FEE", serviceFee.toString()],
                          ["OWNER_PKH", ownerPKH.hex],
                          ["MIN_ADA", minAda.toString()],
                          ["DEPOSIT_ADA", depositAda.toString()],
                          ["TX", "open"]
                        ]
                  } 
              ]]}
          ]]
      });

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

const updateSwap = async (params : any) => {
    
  setIsLoading(true);

  try {
      const askedQty = params[0] as string;
      const offeredQty = params[1] as string;
      const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));    

      // Re-enable wallet API since wallet account may have been changed
      await enableWallet(whichWalletSelected!);

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      // Get network parameters
      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Compile the swap script
      const swapProgram = new SwapValidator();
      swapProgram.parameters = {["VERSION"] : swapInfo.version};
      swapProgram.parameters = {["ASKED_MPH"] : swapInfo.askedAssetMPH};
      swapProgram.parameters = {["ASKED_TN"] : textToBytes(swapInfo.askedAssetTN)};
      swapProgram.parameters = {["OFFERED_MPH"] : swapInfo.offeredAssetMPH};
      swapProgram.parameters = {["OFFERED_TN"] : textToBytes(swapInfo.offeredAssetTN)};
      swapProgram.parameters = {["BEACON_MPH"] : swapInfo.beaconMPH};
      swapProgram.parameters = {["SELLER_PKH"] : swapInfo.sellerPKH};
      swapProgram.parameters = {["SELLER_TN"] : textToBytes(swapInfo.sellerTokenTN)};
      swapProgram.parameters = {["ESCROW_ENABLED"] : swapInfo.escrowEnabled.toString()};
      swapProgram.parameters = {["ESCROW_HASH"] : swapInfo.escrowHash};
      swapProgram.parameters = {["USER_TOKEN_MPH"] : swapInfo.userTokenMPH};
      swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapInfo.userTokenValHash};
      swapProgram.parameters = {["SERVICE_FEE"] : swapInfo.serviceFee};
      swapProgram.parameters = {["OWNER_PKH"] : swapInfo.ownerPKH};
      swapProgram.parameters = {["MIN_ADA"] : swapInfo.minAda};
      swapProgram.parameters = {["DEPOSIT_ADA"] : swapInfo.depositAda};
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
      const swapUtxo = await getSwapUtxo(Address.fromHashes(swapValHash), MintingPolicyHash.fromHex(swapInfo.beaconMPH));

      // Create the swap redeemer
      const swapRedeemer = (new swapProgram.types.Redeemer.Update())._toUplcData();
      
      tx.addInput(swapUtxo, swapRedeemer);  
      
      // Create updated offered asset value
      var offeredAssetValue;
      if (swapInfo.offeredAssetMPH === "") {
        offeredAssetValue = new Value(BigInt(offeredQty));
      } else {
        const offeredAsset = new Assets();
        offeredAsset.addComponent(
          MintingPolicyHash.fromHex(swapInfo.offeredAssetMPH),
          textToBytes(swapInfo.offeredAssetTN),
          BigInt(offeredQty)
        );
        offeredAssetValue = new Value(BigInt(0), offeredAsset);
      }
 
      // Confirm that the updated offeredAssetValue is positive
      offeredAssetValue.assertAllPositive();

      // Construct the asked asset value
      var askedAssetValue;
      if (swapInfo.askedAssetMPH === "") {
        askedAssetValue = new Value(BigInt(askedQty));
      } else {
        const askedAsset = new Assets();
        askedAsset.addComponent(
          MintingPolicyHash.fromHex(swapInfo.askedAssetMPH),
          textToBytes(swapInfo.askedAssetTN),
          BigInt(askedQty)
        );
        askedAssetValue = new Value(BigInt(0), askedAsset);
      }

      askedAssetValue.assertAllPositive();
      
      // Construct the swap datum
      const swapDatum = new (swapProgram.types.Datum)(
          askedAssetValue,
          offeredAssetValue
        )

      // Construct the Beacon value
      const beaconToken : [number[], bigint][] = [[hexToBytes(swapInfo.beaconTN), BigInt(1)]];
      const beaconAsset = new Assets([[MintingPolicyHash.fromHex(swapInfo.beaconMPH), beaconToken]]);
      const beaconValue = new Value(BigInt(0), beaconAsset);

      // Construct the Seller Token value
      const sellerToken : [number[], bigint][]  = [[textToBytes(swapInfo.sellerTokenTN), BigInt(1)]];
      const sellerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapInfo.userTokenMPH), sellerToken]]);
      const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);
      
      const swapValue = (new Value(minAda))
                          .add(offeredAssetValue)
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
      before.setMinutes(now.getMinutes() - ttl);
      const after = new Date(now.getTime());
      after.setMinutes(now.getMinutes() + ttl);
 
      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add seller wallet pkh as a signer which is required for an update
      tx.addSigner(changeAddr.pubKeyHash);

      tx.addMetadata(2000, {"map": [[swapInfo.beaconMPH, {"map": [[swapInfo.beaconTN,
        {
          "map": [["VERSION", swapInfo.version],
                  ["ASKED_MPH", swapInfo.askedAssetMPH],
                  ["ASKED_TN", swapInfo.askedAssetTN],
                  ["ASKED_PRICE", askedQty],
                  ["OFFERED_MPH", swapInfo.offeredAssetMPH],
                  ["OFFERED_TN", swapInfo.offeredAssetTN],
                  ["OFFERED_QTY", offeredQty],
                  ["BEACON_MPH", swapInfo.beaconMPH],
                  ["SELLER_PKH", swapInfo.sellerPKH],
                  ["SELLER_TN", swapInfo.sellerTokenTN],
                  ["ESCROW_ENABLED", swapInfo.escrowEnabled.toString()],
                  ["ESCROW_HASH", swapInfo.escrowHash],
                  ["USER_TOKEN_MPH", swapInfo.userTokenMPH],
                  ["USER_TOKEN_VHASH", swapInfo.userTokenValHash],
                  ["SERVICE_FEE", swapInfo.serviceFee.toString()],
                  ["OWNER_PKH", swapInfo.ownerPKH],
                  ["MIN_ADA", swapInfo.minAda.toString()],
                  ["DEPOSIT_ADA", swapInfo.depositAda.toString()],
                  ["TX", "update"]]} 
            ]]}
        ]]
      });

      console.log("tx before final", tx.dump());
      await tx.finalize(networkParams, changeAddr, utxos[1]);
      console.log("tx after final", tx.dump());
 
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
      throw console.error("Update Swap tx failed", err);
    }
}

const assetSwap = async (params : any) => {

  try {
      setIsLoading(true);
      
      const buyQty = params[0] as number;
      const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt + serviceFee));    

      // Re-enable wallet API since wallet account may have been changed
      await enableWallet(whichWalletSelected!);

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Compile the swap script
      const swapProgram = new SwapValidator();
      swapProgram.parameters = {["VERSION"] : swapInfo.version};
      swapProgram.parameters = {["ASKED_MPH"] : swapInfo.askedAssetMPH};
      swapProgram.parameters = {["ASKED_TN"] : textToBytes(swapInfo.askedAssetTN)};
      swapProgram.parameters = {["OFFERED_MPH"] : swapInfo.offeredAssetMPH};
      swapProgram.parameters = {["OFFERED_TN"] : textToBytes(swapInfo.offeredAssetTN)};
      swapProgram.parameters = {["BEACON_MPH"] : swapInfo.beaconMPH};
      swapProgram.parameters = {["SELLER_PKH"] : swapInfo.sellerPKH};
      swapProgram.parameters = {["SELLER_TN"] : textToBytes(swapInfo.sellerTokenTN)};
      swapProgram.parameters = {["ESCROW_ENABLED"] : swapInfo.escrowEnabled.toString()};
      swapProgram.parameters = {["ESCROW_HASH"] : swapInfo.escrowHash};
      swapProgram.parameters = {["USER_TOKEN_MPH"] : swapInfo.userTokenMPH};
      swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapInfo.userTokenValHash};
      swapProgram.parameters = {["SERVICE_FEE"] : swapInfo.serviceFee};
      swapProgram.parameters = {["OWNER_PKH"] : swapInfo.ownerPKH};
      swapProgram.parameters = {["MIN_ADA"] : swapInfo.minAda};
      swapProgram.parameters = {["DEPOSIT_ADA"] : swapInfo.depositAda};
      const swapCompiledProgram = swapProgram.compile(optimize);
      const swapValHash = swapCompiledProgram.validatorHash;

      // Now we are able to get the UTxOs in Buyer Wallet
      const utxos = await await walletHelper.pickUtxos(minUTXOVal);

      // Start building the transaction
      const tx = new Tx();

      // Add the Buyer UTXOs as inputs
      tx.addInputs(utxos[0]);

      // Add the script as a witness to the transaction
      tx.attachScript(swapCompiledProgram);
      
      // Find the buyer token
      var utxosAll : UTxO[];
      if (utxos[1].length > 0) {
        utxosAll = utxos[0].concat(utxos[1]);
      } else {
        utxosAll = utxos[0];
      }
  
      // Get the buyer user token name 
      const buyerTokenTN = await getTokenNames(MintingPolicyHash.fromHex(swapInfo.userTokenMPH), utxosAll);

      // Check that there exist only 1 user token
      assert(buyerTokenTN.length == 1);

      // Construct the Buyer Token value
      const buyerToken : [number[], bigint][] = [[textToBytes(buyerTokenTN[0]), BigInt(1)]];
      const buyerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapInfo.userTokenMPH), buyerToken]]);
      const buyerTokenValue = new Value(BigInt(0), buyerTokenAsset);

      // Get the UTXO that has the swap datum
      const swapUtxo = await getSwapUtxo(Address.fromHashes(swapValHash), MintingPolicyHash.fromHex(swapInfo.beaconMPH));

      // Create the swap redeemer
      const swapRedeemer = (new swapProgram.types.Redeemer.Swap(changeAddr.pubKeyHash,
                                                                buyerTokenValue))._toUplcData();

      tx.addInput(swapUtxo, swapRedeemer); 

      // Add the buyer & seller reference user tokens
      const buyerRefTokenUtxo = await getRefTokenUTXO(changeAddr.pubKeyHash.hex, buyerTokenTN[0], swapInfo, optimize);
      tx.addRefInput(buyerRefTokenUtxo);
      const sellerRefTokenUtxo = await getRefTokenUTXO(swapInfo.sellerPKH, swapInfo.sellerTokenTN, swapInfo, optimize);
      tx.addRefInput(sellerRefTokenUtxo);
      
      // Create the asked asset
      // Construct the asked asset value
      var swapAskedAssetValue;
      if (swapInfo.askedAssetMPH === "") {
        swapAskedAssetValue = new Value(BigInt(buyQty));
      } else {
        const askedAsset = new Assets();
        askedAsset.addComponent(
          MintingPolicyHash.fromHex(swapInfo.askedAssetMPH),
          textToBytes(swapInfo.askedAssetTN),
          BigInt(buyQty)
        );
        swapAskedAssetValue = new Value(BigInt(0), askedAsset);
      }
      
      // Calc the amount of products remaining
      const orderDetails = await calcOrderDetails(swapUtxo, swapAskedAssetValue, swapInfo);

      // Construct the swap datum
      const swapDatum = new (swapProgram.types.Datum)(
          orderDetails.askedAssetVal,     // askedAsset
          orderDetails.offeredAssetVal    // offeredAsset
        )
      
      // Construct the Beacon value
      const beaconToken : [number[], bigint][] = [[hexToBytes(swapInfo.beaconTN), BigInt(1)]];
      const beaconAsset = new Assets([[MintingPolicyHash.fromHex(swapInfo.beaconMPH), beaconToken]]);
      const beaconValue = new Value(BigInt(0), beaconAsset);

      // Construct the Seller Token value
      const sellerToken : [number[], bigint][] = [[textToBytes(swapInfo.sellerTokenTN), BigInt(1)]];
      const sellerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapInfo.userTokenMPH), sellerToken]]);
      const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);
      
      const swapValue = (new Value(BigInt(swapInfo.minAda)))
                          .add(orderDetails.offeredAssetVal)
                          .add(beaconValue)
                          .add(sellerTokenValue);

      // Create the output that goes back to the swap address
      tx.addOutput(new TxOutput(
          Address.fromHashes(swapCompiledProgram.validatorHash),
          swapValue,
          Datum.inline(swapDatum._toUplcData())
      ));

      // Use timestamp for order id for now
      const orderId = Date.now().toString();
      
      if (!swapInfo.escrowEnabled) {

        // Create the output to send the askedAsset to the seller address
        // and check if asked Asset is in lovelace
        if (swapAskedAssetValue.lovelace == BigInt(0)) {
            if (orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(new PubKeyHash(swapInfo.sellerPKH)),
                    (new Value(BigInt(swapInfo.minAda))).add(swapAskedAssetValue)
                ));
            } else {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(new PubKeyHash(swapInfo.sellerPKH)),
                    (new Value(BigInt(swapInfo.minAda))).add(swapAskedAssetValue.sub(orderDetails.changeAssetVal))
                ));
            }
        } else {
            if (orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(new PubKeyHash(swapInfo.sellerPKH)),
                    swapAskedAssetValue
                ));
            } else {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(new PubKeyHash(swapInfo.sellerPKH)),
                    swapAskedAssetValue.sub(orderDetails.changeAssetVal)
                ));
            }
        }

        // Create the output that goes to the buyer
        tx.addOutput(new TxOutput(
            changeAddr,
            (new Value(BigInt(swapInfo.minAda))).add(orderDetails.buyAssetVal).add(buyerTokenValue)
        ));

        // Create the output to send to the buyer address for the change
        if (orderDetails.changeAssetVal.lovelace == BigInt(0))
        {
            if (!orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    changeAddr,
                    (new Value(BigInt(swapInfo.minAda))).add(orderDetails.changeAssetVal)
                ));
            }
        } else {
            if (!orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    changeAddr,
                    orderDetails.changeAssetVal
                ));
            }
        }
      } else { 
        // Return the buyer token to the buyer
        tx.addOutput(new TxOutput(
          changeAddr,
          (new Value(BigInt(swapInfo.minAda))).add(buyerTokenValue)
        ));

        // Create deposit value use for escrow
        const depositVal = new Value(BigInt(swapInfo.depositAda)); 

        var orderVal;
        if (orderDetails.noChange) {
            orderVal = swapAskedAssetValue;
        } else {
            orderVal = swapAskedAssetValue.sub(orderDetails.changeAssetVal);
        }

        // Create the escrow script
        const escrowProgram = new EscrowValidator();
        escrowProgram.parameters = {["VERSION"] : swapInfo.version};
        escrowProgram.parameters = {["SELLER_PKH"] : swapInfo.sellerPKH};
        escrowProgram.parameters = {["OWNER_PKH"] : swapInfo.ownerPKH};
        const escrowCompiledProgram = escrowProgram.compile(optimize);

        // Construct the escrow datum
        const escrowDatum = new (escrowProgram.types.Datum)(
            textToBytes(orderId),
            changeAddr.pubKeyHash.hex,
            depositVal,
            orderVal,
            orderDetails.buyAssetVal,
            swapInfo.sellerPKH,
            textToBytes(swapInfo.version)
            )

        // Create the output to send the askedAsset to the escrow address
        // Check if asked Asset is in lovelace
        if (swapAskedAssetValue.lovelace == BigInt(0)) {
            if (orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(escrowCompiledProgram.validatorHash),
                    (new Value(BigInt(swapInfo.minAda)))
                        .add(swapAskedAssetValue)
                        .add(depositVal),
                    Datum.inline(escrowDatum._toUplcData()) 
                ));
            } else {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(escrowCompiledProgram.validatorHash),
                    (new Value(BigInt(swapInfo.minAda)))
                        .add(swapAskedAssetValue)
                        .sub(orderDetails.changeAssetVal)
                        .add(depositVal),
                    Datum.inline(escrowDatum._toUplcData())
                ));
            }
        } else {
            if (orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(escrowCompiledProgram.validatorHash),
                    swapAskedAssetValue.add(depositVal)
                                       .add(orderDetails.buyAssetVal),
                    Datum.inline(escrowDatum._toUplcData())
                ));
            } else {
                tx.addOutput(new TxOutput(
                    Address.fromHashes(escrowCompiledProgram.validatorHash),
                    swapAskedAssetValue.sub(orderDetails.changeAssetVal)
                                       .add(depositVal)
                                       .add(orderDetails.buyAssetVal),
                    Datum.inline(escrowDatum._toUplcData())
                ));
            }
        }

        // Create the output to send to the buyer address for the change
        if (orderDetails.changeAssetVal.lovelace == BigInt(0))
        {
            if (!orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    changeAddr,
                    (new Value(BigInt(swapInfo.minAda))).add(orderDetails.changeAssetVal)
                ));
            }
        } else {
            if (!orderDetails.noChange) {
                tx.addOutput(new TxOutput(
                    changeAddr,
                    orderDetails.changeAssetVal
                ));
            }
        }
      }

      // Create the output for the service fee
      tx.addOutput(new TxOutput(
        Address.fromHashes(new PubKeyHash(swapInfo.ownerPKH)),
          new Value(BigInt(swapInfo.serviceFee))
      ));

      // Construct the time validity interval
      const now = new Date();
      const before = new Date(now.getTime());
      before.setMinutes(now.getMinutes() - ttl);
      const after = new Date(now.getTime());
      after.setMinutes(now.getMinutes() + ttl);
 
      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add buyer wallet pkh as a signer which is required the swap
      tx.addSigner(changeAddr.pubKeyHash);
      tx.addMetadata(2000, {"map": [[swapInfo.beaconMPH, {"map": [[swapInfo.beaconTN,
        {
          "map": [["VERSION", swapInfo.version],
                  ["ASKED_MPH", swapInfo.askedAssetMPH],
                  ["ASKED_TN", swapInfo.askedAssetTN],
                  ["ASKED_PRICE", swapInfo.askedAssetPrice.toString()],
                  ["OFFERED_MPH", swapInfo.offeredAssetMPH],
                  ["OFFERED_TN", swapInfo.offeredAssetTN],
                  ["OFFERED_QTY", swapInfo.offeredAssetQty.toString()],
                  ["BEACON_MPH", swapInfo.beaconMPH],
                  ["SELLER_PKH", swapInfo.sellerPKH],
                  ["SELLER_TN", swapInfo.sellerTokenTN],
                  ["ESCROW_ENABLED", swapInfo.escrowEnabled.toString()],
                  ["ESCROW_HASH", swapInfo.escrowHash],
                  ["USER_TOKEN_MPH", swapInfo.userTokenMPH],
                  ["USER_TOKEN_VHASH", swapInfo.userTokenValHash],
                  ["SERVICE_FEE", swapInfo.serviceFee.toString()],
                  ["OWNER_PKH", swapInfo.ownerPKH],
                  ["MIN_ADA", swapInfo.minAda.toString()],
                  ["DEPOSIT_ADA", swapInfo.depositAda.toString()],
                  ["TX", "swap"]]} 
            ]]}
        ]]
      });

      console.log("tx before final", tx.dump());
      await tx.finalize(networkParams, changeAddr, utxos[1]);
      console.log("tx after final", tx.dump());
 
      // Sign tx with buyer signature
      const signatures = await walletAPI.signTx(tx);
      tx.addSignatures(signatures);
      console.log("tx cbor: ", bytesToHex(tx.toCbor()));

      console.log("Submitting transaction...");

      try {
        const txHash = await submitTx(tx);
        setIsLoading(false); 
        console.log("txHash", txHash);
        setTx({ txId: txHash });
      } catch (error) {
        setIsLoading(false); 
        console.error("Escrow Swap Assets Tx Failed: " + error);
      }

    } catch (err) {
      setIsLoading(false);
      throw console.error("Escrow Swap Assets tx failed", err);
    }
  }
  
const approveEscrow = async (params : any) => {

  try {
      setIsLoading(true);
      const orderId = (params as string).trim();
      const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt + serviceFee));    

      // Re-enable wallet API since wallet account may have been changed
      await enableWallet(whichWalletSelected!);

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      // Get network parameters
      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Now we are able to get the UTxOs in Buyer Wallet
      const utxos = await await walletHelper.pickUtxos(minUTXOVal);

       // Create the escrow script
       const escrowProgram = new EscrowValidator();
       escrowProgram.parameters = {["VERSION"] : escrowInfo.version};
       escrowProgram.parameters = {["SELLER_PKH"] : escrowInfo.sellerPKH};
       escrowProgram.parameters = {["OWNER_PKH"] : escrowInfo.ownerPKH};
       const escrowCompiledProgram = escrowProgram.compile(optimize);
       const escrowValAddr = Address.fromHashes(escrowCompiledProgram.validatorHash);

       // Start building the transaction
      const tx = new Tx();

      // Add the seller UTXOs as inputs
      tx.addInputs(utxos[0]);

      // Add the script as a witness to the transaction
      tx.attachScript(escrowCompiledProgram);

      // Create the swap redeemer
      const escrowRedeemer = (new escrowProgram.types.Redeemer.Approve())._toUplcData();
        
      // Get the UTXO that has the swap datum
      const escrowUtxo = await getEscrowUtxo(escrowValAddr, orderId);
      tx.addInput(escrowUtxo, escrowRedeemer);  

      // Get the datum info from the UTXO locked at the escrow script address
      const escrowDatumInfo = await getEscrowDatumInfo(escrowUtxo);

      assert(escrowDatumInfo.orderId === orderId);

      // Create the output that will go to the buyer
      tx.addOutput(new TxOutput(
          Address.fromPubKeyHash(escrowDatumInfo.buyerPkh),
          escrowDatumInfo.depositVal.add(escrowDatumInfo.productVal)
      ));

      // Create the output that will go to the seller
      tx.addOutput(new TxOutput(
          Address.fromPubKeyHash(escrowDatumInfo.sellerPKH),
          escrowDatumInfo.orderVal
      ));

      // Construct the time validity interval
      const now = new Date();
      const before = new Date(now.getTime());
      before.setMinutes(now.getMinutes() - ttl);
      const after = new Date(now.getTime());
      after.setMinutes(now.getMinutes() + ttl);
 
      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add buyer wallet pkh as a signer which is required for an update
      tx.addSigner(escrowDatumInfo.buyerPkh);
      tx.addSigner(escrowDatumInfo.sellerPKH);

      console.log("tx before final", tx.dump());
      await tx.finalize(networkParams, changeAddr, utxos[1]);
      console.log("tx after final", tx.dump());
 
      // Sign tx with buyer and seller signatures
      alert('Sign with buyer wallet');
      await enableWallet(whichWalletSelected!);
      const buyerSignatures = await walletAPI.signTx(tx);
      tx.addSignatures(buyerSignatures);

      alert('Sign with seller wallet');
      await enableWallet(whichWalletSelected!);
      const sellerSignatures = await walletAPI.signTx(tx);
      tx.addSignatures(sellerSignatures);
    
      console.log("Submitting transaction...");

      // Sign tx with owner signature and submit tx
      try {
        const txHash = await submitTx(tx);
        setIsLoading(false); 
        console.log("txHash", txHash);
        setTx({ txId: txHash });
      } catch (error) {
        setIsLoading(false); 
        console.error("Swap Assets Tx Failed: " + error);
      }

    } catch (err) {
      setIsLoading(false);
      throw console.error("Swap Assets tx failed", err);
    }
  }

const closeSwap = async () => {
    
  setIsLoading(true);

  try {
      const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));    

      // Re-enable wallet API since wallet account may have been changed
      await enableWallet(whichWalletSelected!);

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      // Get network parameters
      const networkParamsPreview = await getNetworkParams(network);
      const networkParams = new NetworkParams(networkParamsPreview);

      // Compile the swap script
      const swapProgram = new SwapValidator();
      swapProgram.parameters = {["VERSION"] : swapInfo.version};
      swapProgram.parameters = {["ASKED_MPH"] : swapInfo.askedAssetMPH};
      swapProgram.parameters = {["ASKED_TN"] : textToBytes(swapInfo.askedAssetTN)};
      swapProgram.parameters = {["OFFERED_MPH"] : swapInfo.offeredAssetMPH};
      swapProgram.parameters = {["OFFERED_TN"] : textToBytes(swapInfo.offeredAssetTN)};
      swapProgram.parameters = {["BEACON_MPH"] : swapInfo.beaconMPH};
      swapProgram.parameters = {["SELLER_PKH"] : swapInfo.sellerPKH};
      swapProgram.parameters = {["SELLER_TN"] : textToBytes(swapInfo.sellerTokenTN)};
      swapProgram.parameters = {["ESCROW_ENABLED"] : swapInfo.escrowEnabled.toString()};
      swapProgram.parameters = {["ESCROW_HASH"] : swapInfo.escrowHash};
      swapProgram.parameters = {["USER_TOKEN_MPH"] : swapInfo.userTokenMPH};
      swapProgram.parameters = {["USER_TOKEN_VHASH"] : swapInfo.userTokenValHash};
      swapProgram.parameters = {["SERVICE_FEE"] : swapInfo.serviceFee};
      swapProgram.parameters = {["OWNER_PKH"] : swapInfo.ownerPKH};
      swapProgram.parameters = {["MIN_ADA"] : swapInfo.minAda};
      swapProgram.parameters = {["DEPOSIT_ADA"] : swapInfo.depositAda};
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
      const swapUtxo = await getSwapUtxo(Address.fromHashes(swapValHash), MintingPolicyHash.fromHex(swapInfo.beaconMPH));

      // Create the swap redeemer
      const swapRedeemer = (new swapProgram.types.Redeemer.Close())._toUplcData();
      
      tx.addInput(swapUtxo, swapRedeemer);  
      
      // Create updated offered asset value
      var offeredAssetValue;
      if (swapInfo.offeredAssetMPH === "") {
        offeredAssetValue = new Value(BigInt(swapInfo.offeredAssetQty));
      } else {
        const offeredAsset = new Assets();
        offeredAsset.addComponent(
          MintingPolicyHash.fromHex(swapInfo.offeredAssetMPH),
          textToBytes(swapInfo.offeredAssetTN),
          BigInt(swapInfo.offeredAssetQty)
        );
        offeredAssetValue = new Value(BigInt(0), offeredAsset);
      }
 
      // Confirm that the updated offeredAssetValue is positive
      offeredAssetValue.assertAllPositive();

      // Add the beacon minting script as a witness to the transaction
      tx.attachScript(beaconCompiledProgram);

      // Construct the Beacon token
      const beaconToken : [number[], bigint][] = [[hexToBytes(swapInfo.beaconTN), BigInt(-1)]];
   
      // Create an Beacon Minting Init Redeemer because we must always send a Redeemer with
      // a plutus script transaction even if we don't actually use it.
      const beaconRedeemer = (new beaconProgram.types.Redeemer.Burn())._toUplcData();

      // Add the mint to the tx
      tx.mintTokens(
          beaconMPH,
          beaconToken,
          beaconRedeemer
      )

      // Construct the Seller Token value
      const sellerToken : [number[], bigint][]  = [[textToBytes(swapInfo.sellerTokenTN), BigInt(1)]];
      const sellerTokenAsset = new Assets([[MintingPolicyHash.fromHex(swapInfo.userTokenMPH), sellerToken]]);
      const sellerTokenValue = new Value(BigInt(0), sellerTokenAsset);
      
      tx.addOutput(new TxOutput(
        changeAddr,
        offeredAssetValue.add(sellerTokenValue)
      ));

      // Construct the time validity interval
      const now = new Date();
      const before = new Date(now.getTime());
      before.setMinutes(now.getMinutes() - ttl);
      const after = new Date(now.getTime());
      after.setMinutes(now.getMinutes() + ttl);
 
      // Set a valid time interval
      tx.validFrom(before);
      tx.validTo(after);

      // Add seller wallet pkh as a signer which is required for closing swap
      tx.addSigner(changeAddr.pubKeyHash);
      tx.addSigner(ownerPKH);

      tx.addMetadata(2000, {"map": [[swapInfo.beaconMPH, {"map": [[swapInfo.beaconTN,
        {
          "map": [["VERSION", swapInfo.version],
                  ["ASKED_MPH", swapInfo.askedAssetMPH],
                  ["ASKED_TN", swapInfo.askedAssetTN],
                  ["ASKED_PRICE", swapInfo.askedAssetPrice.toString()],
                  ["OFFERED_MPH", swapInfo.offeredAssetMPH],
                  ["OFFERED_TN", swapInfo.offeredAssetTN],
                  ["OFFERED_QTY", swapInfo.offeredAssetQty.toString()],
                  ["BEACON_MPH", swapInfo.beaconMPH],
                  ["SELLER_PKH", swapInfo.sellerPKH],
                  ["SELLER_TN", swapInfo.sellerTokenTN],
                  ["ESCROW_ENABLED", swapInfo.escrowEnabled.toString()],
                  ["ESCROW_HASH", swapInfo.escrowHash],
                  ["USER_TOKEN_MPH", swapInfo.userTokenMPH],
                  ["USER_TOKEN_VHASH", swapInfo.userTokenValHash],
                  ["SERVICE_FEE", swapInfo.serviceFee.toString()],
                  ["OWNER_PKH", swapInfo.ownerPKH],
                  ["MIN_ADA", swapInfo.minAda.toString()],
                  ["DEPOSIT_ADA", swapInfo.depositAda.toString()],
                  ["TX", "close"]]} 
            ]]}
        ]]
      });

      console.log("tx before final", tx.dump());
      await tx.finalize(networkParams, changeAddr, utxos[1]);
      console.log("tx after final", tx.dump());
 
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
        console.error("Close Swap Tx Failed: " + error);
      }

    } catch (err) {
      setIsLoading(false);
      throw console.error("Close Swap tx failed", err);
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
            <p>TxId &nbsp;&nbsp;<a href={"https://"+network+".cexplorer.io/tx/" + tx.txId} target="_blank" rel="noopener noreferrer" >{tx.txId}</a></p>
            <p>Please wait until the transaction is confirmed on the blockchain and reload this page before doing another transaction</p>
          </div>}
          {walletIsEnabled && !tx.txId && !isLoading && swapList && <div className={styles.border}><SwapList swapList={swapList} onSwapInfo={updateSwapDetails}/></div>}
          {walletIsEnabled && !tx.txId && !isLoading && swapInfo && <div className={styles.border}><SwapDetails swapInfo={swapInfo} onUpdateSwap={updateSwap} onCloseSwap={closeSwap}/></div>}
          {walletIsEnabled && !tx.txId && !isLoading && escrowList && <div className={styles.border}><EscrowList escrowList={escrowList} onEscrowInfo={updateEscrowDetails}/></div>}
          {walletIsEnabled && !tx.txId && !isLoading && escrowInfo && <div className={styles.border}><EscrowDetails escrowInfo={escrowInfo} onApproveEscrow={approveEscrow}/></div>}
          {walletIsEnabled && !tx.txId && !isLoading && swapInfo && <div className={styles.border}><AssetSwap onAssetSwap={assetSwap} swapInfo={swapInfo}/></div>}
          {walletIsEnabled && !tx.txId && !isLoading && <div className={styles.border}><MintUserToken onMintUserToken={mintUserToken}/></div>}
          {walletIsEnabled && !tx.txId && !isLoading && <div className={styles.border}><MintProductToken onMintProductToken={mintProductToken}/></div>}
          {walletIsEnabled && !tx.txId && !isLoading && <div className={styles.border}><OpenSwap onOpenSwap={openSwap}/></div>}
      </main>

      <footer className={styles.footer}>
      </footer>
    </div>
  )
}

export default Home