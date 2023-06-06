export { SwapInfo }

/**
 * SwapInfo class to capture all of the script parameters related to a swap
 */

export default class SwapInfo {
    public beaconMPH : string
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
    public sellerTokenTN : string
    public sellerPKH : string
    public userTokenMPH : string
    public userTokenValHash: string
    public serviceFee : number
    public ownerPKH : string
    public minAda : number
    public depositAda : number
    public version : string

    /**
     * Create SwapInfo
     * @param {string} beaconMPH
     * @param {string} beaconTN
     * @param {string} address
     * @param {string} askedAssetMPH
     * @param {string} askedAssetTN
     * @param {string} askedAssetPrice
     * @param {string} offeredAssetMPH
     * @param {string} offeredAssetTN
     * @param {string} offeredAssetQty
     * @param {string} escrowEnabled
     * @param {string} escrowValHash
     * @param {string} sellerTokenTN
     * @param {string} sellerPKH
     * @param {string} userTokenMPH
     * @param {string} userTokenValHash
     * @param {string} serviceFee
     * @param {string} ownerPKH
     * @param {string} minAda
     * @param {string} version
     * 
     */

    constructor(beaconMPH : string,
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
                sellerTokenTN : string,
                sellerPKH : string,
                userTokenMPH : string,
                userTokenValHash : string,
                serviceFee : number,
                ownerPKH : string,
                minAda : number,
                depositAda : number,
                version : string) {
        this.beaconMPH = beaconMPH;
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
        this.sellerTokenTN = sellerTokenTN;
        this.sellerPKH = sellerPKH;
        this.userTokenMPH = userTokenMPH;
        this.userTokenValHash = userTokenValHash;
        this.serviceFee = serviceFee;
        this.ownerPKH = ownerPKH;
        this.minAda = minAda;
        this.depositAda = depositAda;
        this.version = version;
    }
}