
export default class SwapInfo {
    public beaconMph : string
    public beaconTN : string
    public address : string
    public askedAssetMPH : string
    public askedAssetTN : string
    public askedAssetPrice: number
    public offeredAssetMPH : string
    public offeredAssetTN : string
    public offeredAssetQty : number
    public escrowEnabled : boolean
    public escrowValHash : string
    public sellerTN : string
    public sellerPkh : string
    public userTokenMph : string
    public userTokenValHash: string
    public serviceFee : number
    public ownerPkh : string
    public minAda : number
    public depositAda : number
    public version : string

    constructor(beaconMph : string,
                beaconTN : string,
                address : string,
                askedAssetMPH : string,
                askedAssetTN: string,
                askedAssetPrice : number, 
                offeredAssetMPH : string,
                offeredAssetTN : string,
                offeredAssetQty : number,
                escrowEnabled : boolean,
                escrowValHash : string,
                sellerTN : string,
                sellerPkh : string,
                userTokenMph : string,
                userTokenValHash : string,
                serviceFee : number,
                ownerPkh : string,
                minada : number,
                depositAda : number,
                version : string) {
        this.beaconMph = beaconMph;
        this.beaconTN = beaconTN;
        this.address = address;
        this.askedAssetMPH = askedAssetMPH;
        this.askedAssetTN = askedAssetTN;
        this.askedAssetPrice = askedAssetPrice;
        this.offeredAssetMPH = offeredAssetMPH;
        this.offeredAssetTN = offeredAssetTN;
        this.offeredAssetQty = offeredAssetQty;
        this.escrowEnabled = escrowEnabled;
        this.escrowValHash = escrowValHash;
        this.sellerTN = sellerTN;
        this.sellerPkh = sellerPkh;
        this.userTokenMph = userTokenMph;
        this.userTokenValHash = userTokenValHash;
        this.serviceFee = serviceFee;
        this.ownerPkh = ownerPkh;
        this.minAda = minada;
        this.depositAda = depositAda;
        this.version = version;
    }
}