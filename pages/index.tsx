import axios from 'axios';
import Head from 'next/head'
import MintUserToken from '../components/MintUserToken';
import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import { useState, useEffect } from "react";
import WalletInfo from '../components/WalletInfo';
import LoadingSpinner from '../components/LoadingSpinner';
import UserTokenPolicy from '../contracts/userTokenPolicy.hl';
import UserTokenValidator from '../contracts/userTokenValidator.hl';
import {
  Assets,
  Address,
  bytesToHex,
  ByteArrayData,
  Cip30Handle,
  Cip30Wallet,
  config,
  ConstrData,
  Datum,
  hexToBytes,
  NetworkParams,
  Value,
  textToBytes,
  TxOutput,
  Tx,
  WalletHelper,
  PubKeyHash} from "@hyperionbt/helios";
 

declare global {
  interface Window {
      cardano:any;
  }
}

config.AUTO_SET_VALIDITY_RANGE = false;

const ownerPkh = new PubKeyHash(process.env.NEXT_PUBLIC_OWNER_PKH as string);

const signSubmitTx = async (tx: Tx) : Promise<string> => {
  const payload = bytesToHex(tx.toCbor());
  const urlAPI = "/api/getSignature";

  try {
    let res = await axios({
          url: urlAPI,
          data: payload,
          method: 'post',
          timeout: 8000,
          headers: {
              'Content-Type': 'application/cbor'
          }
      })
      if(res.status == 200){
          return res.data;
      } else {
        console.error("signSumitTx API Error: ", res);
        throw res.data;
      }   
  }
  catch (err) {
      console.error("signSubmitTx Failed: ", err);
      throw err;
  }
}

const Home: NextPage = () => {

  const optimize = false;
  //const networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preprod.json";
  const networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preview.json";
  const [walletInfo, setWalletInfo] = useState({ balance : ''});
  const [walletIsEnabled, setWalletIsEnabled] = useState(false);
  const [whichWalletSelected, setWhichWalletSelected] = useState(undefined);
  const [walletAPI, setWalletAPI] = useState<undefined | any>(undefined);
  const [walletHelper, setWalletHelper] = useState<undefined | any>(undefined);
  
  const [isLoading, setIsLoading] = useState(false);
  const [tx, setTx] = useState({ txId : '' });

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
            const _balance = await getBalance() as string;
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
    try {
        const balanceAmountValue  = await walletHelper.calcBalance();
        const balanceAmount = balanceAmountValue.lovelace;
        const walletBalance : BigInt = BigInt(balanceAmount);
        return walletBalance.toLocaleString();
    } catch (err) {
        console.log('getBalance error: ', err);
    }
  }

  const mintUserToken = async (params : any) => {

    setIsLoading(true);

    // Re-enable wallet API since wallet account may have been changed
    await enableWallet();

    const minAda : number = 2_500_000; // minimum lovelace needed to send an NFT
    const maxTxFee: number = 500_000; // maximum estimated transaction fee
    const minChangeAmt: number = 1_000_000; // minimum lovelace needed to be sent back as change
    const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));

    try {

      // Get change address
      const changeAddr = await walletHelper.changeAddress;

      const networkParams = new NetworkParams(
        await fetch(networkParamsUrl)
            .then(response => response.json())
      )
      // Compile the user token validator script
      const userTokenValProgram = new UserTokenValidator();
      userTokenValProgram.parameters = {["VERSION"] : "1.0"};
      userTokenValProgram.parameters = {["OWNER_PKH"] : ownerPkh.hex};
      userTokenValProgram.parameters = {["USER_PKH"] : changeAddr.pubKeyHash.hex};
      const userTokenValCompiledProgram = userTokenValProgram.compile(optimize);  
      const userTokenValHash = userTokenValCompiledProgram.validatorHash;

      // Compile the user token policy script
      const userTokenPolicyProgram = new UserTokenPolicy();
      userTokenPolicyProgram.parameters = {["VERSION"] : "1.0"};
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

      return {
          mph: userTokenMPH.hex,
          tn: userTokenTN,
          vHash: userTokenValHash.hex
      }

    } catch (err) {
        setIsLoading(false);
        throw console.error("mintUserToken tx failed", err);
    }

  }


  return (
    <div className={styles.container}>
      <Head>
        <title>Helios Tx Builder</title>
        <meta name="description" content="Littercoin web tools page" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h3 className={styles.title}>
          Helios Tx Builder
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
          {walletIsEnabled && !tx.txId && !isLoading && <div className={styles.border}><MintUserToken onMintUserToken={mintUserToken}/></div>}

      </main>

      <footer className={styles.footer}>

      </footer>
    </div>
  )
}

export default Home