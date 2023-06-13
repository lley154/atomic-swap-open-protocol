
const EscrowInfo = ({ escrowInfo } : any) => {

    //console.log("escrowInfo: ", escrowInfo);

    return (
        <div style={{ width: '100%'}}>
            <b>Escrow Info</b>
            <hr></hr>
            <table style={{ width: '100%' }}>
            <tbody>
                <tr><td>Order Id</td><td>{escrowInfo.orderId}</td></tr>
                <tr><td>Escrow Address</td><td>{escrowInfo.address}</td></tr>
                <tr><td>Asked Asset Minting Policy Hash</td><td>{escrowInfo.askedAsset}</td></tr>
                <tr><td>Asked Asset Token Name</td><td>{escrowInfo.askedAssetTN === "" ? "lovelace" : escrowInfo.askedAssetTN}</td></tr>
                <tr><td>Asked Asset Qty</td><td>{escrowInfo.askedAssetQty}</td></tr>
                <tr><td>Offered Asset Minting Policy Hash</td><td>{escrowInfo.offeredAssetMPH}</td></tr>
                <tr><td>Offered Asset Token Name</td><td>{escrowInfo.offeredAssetTN === "" ? "lovelace" : escrowInfo.offeredAssetTN}</td></tr>
                <tr><td>Offered Asset Quantity</td><td>{escrowInfo.offeredAssetQty}</td></tr>
                <tr><td>Seller PKH</td><td>{escrowInfo.sellerPKH}</td></tr>
                <tr><td>Buyer PKH</td><td>{escrowInfo.buyerPKH}</td></tr>
                <tr><td>Owner PKH</td><td>{escrowInfo.ownerPKH}</td></tr>
                <tr><td>Min Ada</td><td>{escrowInfo.minAda}</td></tr>
                <tr><td>Deposit Ada</td><td>{escrowInfo.depositAda}</td></tr>
                <tr><td>Version</td><td>{escrowInfo.version}</td></tr>
            </tbody>
            </table>
        </div>
    )
}

export default EscrowInfo