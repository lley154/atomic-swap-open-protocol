
export default class SwapInfo {
    public beacon : string
    public address : string
    public askedAssetMPH : string
    public askedAssetTN : string
    public askedAssetPrice: number
    public offeredAssetMPH : string
    public offeredAssetTN : string
    public offeredAssetQty : number
    public escrowEnabled : boolean
    public sellerTokenTN : string
    public sellerPkh : string
    public serviceFee : number
    public minAda : number
    public depositAda : number
    public version : string

    constructor(beacon : string,
                address : string,
                askedAssetMPH : string,
                askedAssetTN: string,
                askedAssetPrice : number, 
                offeredAssetMPH : string,
                offeredAssetTN : string,
                offeredAssetQty : number,
                escrowEnabled : boolean,
                sellerTokenTN : string,
                sellerPkh : string,
                serviceFee : number,
                minada : number,
                depositAda : number,
                version : string) {
        this.beacon = beacon;
        this.address = address;
        this.askedAssetMPH = askedAssetMPH;
        this.askedAssetTN = askedAssetTN;
        this.askedAssetPrice = askedAssetPrice;
        this.offeredAssetMPH = offeredAssetMPH;
        this.offeredAssetTN = offeredAssetTN;
        this.offeredAssetQty = offeredAssetQty;
        this.escrowEnabled = escrowEnabled;
        this.sellerTokenTN = sellerTokenTN;
        this.sellerPkh = sellerPkh;
        this.serviceFee = serviceFee;
        this.minAda = minada;
        this.depositAda = depositAda;
        this.version = version;
    }
}