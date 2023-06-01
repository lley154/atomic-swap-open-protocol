import { 
    Value } from "@hyperionbt/helios";


export default class SwapInfo {
    public address : string
    public askedAssetMPH : string
    public askedAssetTN : string
    public askedAssetPrice: number
    public offeredAssetMPH : string
    public offeredAssetTN : string
    public offeredAssetQty : number
   
     constructor(address : string,
                 askedAssetMPH : string,
                 askedAssetTN: string,
                 askedAssetPrice : number, 
                 offeredAssetMPH : string,
                 offeredAssetTN : string,
                 offeredAssetQty : number) {
         this.address = address;
         this.askedAssetMPH = askedAssetMPH;
         this.askedAssetTN = askedAssetTN;
         this.askedAssetPrice = askedAssetPrice;
         this.offeredAssetMPH = offeredAssetMPH;
         this.offeredAssetTN = offeredAssetTN;
         this.offeredAssetQty = offeredAssetQty;
     }
}