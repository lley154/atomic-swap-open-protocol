
const SwapInfo = ({ swapInfo } : any) => {

    console.log("swapInfo: ", swapInfo);

    return (
        <div style={{ width: '100%'}}>
            <b>Swap Info</b>
            <hr></hr>
            <table style={{ width: '100%' }}>
            <tbody>
                <tr><td>Swap Address</td><td>{swapInfo.address}</td></tr>
                <tr><td>Asked Asset Minting Policy Hash</td><td>{swapInfo.askedAssetMPH}</td></tr>
                <tr><td>Asked Asset Token Name</td><td>{swapInfo.askedAssetTN}</td></tr>
                <tr><td>Asked Asset Price</td><td>{swapInfo.askedAssetPrice}</td></tr>
                <tr><td>Offered Asset Minting Policy Hash</td><td>{swapInfo.offeredAssetMPH}</td></tr>
                <tr><td>Offered Asset Token Name</td><td>{swapInfo.offeredAssetTN}</td></tr>
                <tr><td>Offered Asset Quantity</td><td>{swapInfo.offeredAssetQty}</td></tr>
            </tbody>
            </table>
        </div>
    )
}

export default SwapInfo