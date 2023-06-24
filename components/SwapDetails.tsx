import { useState } from 'react'

const SwapInfo = ({ swapInfo, onUpdateSwap, onCloseSwap } : any) => {

    const [askedQty, setAskedQty] = useState('');
    const [offeredQty, setOfferedQty] = useState('');

    const onSubmitUpdate = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onUpdateSwap([askedQty,
                      offeredQty])
    }

    const onSubmitClose = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onCloseSwap();
    }

    return (
        <div style={{ width: '100%'}}>
            <b>Swap Info</b>
            <hr></hr>
            <table style={{ width: '100%' }}>
            <tbody>
                <tr><td>Swap Address</td><td>{swapInfo.address}</td></tr>
                <tr><td>Asked Asset Minting Policy Hash</td><td>{swapInfo.askedAssetMPH}</td></tr>
                <tr><td>Asked Asset Token Name</td><td>{swapInfo.askedAssetTN === "" ? "lovelace" : swapInfo.askedAssetTN}</td></tr>
                <tr><td>Asked Asset Price</td><td>{swapInfo.askedAssetPrice}</td></tr>
                <tr><td>Offered Asset Minting Policy Hash</td><td>{swapInfo.offeredAssetMPH}</td></tr>
                <tr><td>Offered Asset Token Name</td><td>{swapInfo.offeredAssetTN === "" ? "lovelace" : swapInfo.offeredAssetTN}</td></tr>
                <tr><td>Offered Asset Quantity</td><td>{swapInfo.offeredAssetQty}</td></tr>
                <tr><td>Seller Token</td><td>{swapInfo.sellerTokenTN}</td></tr>
                <tr><td>Seller PKH</td><td>{swapInfo.sellerPKH}</td></tr>
                <tr><td>Owner PKH</td><td>{swapInfo.ownerPKH}</td></tr>
                <tr><td>Escrow Enabled</td><td>{swapInfo.escrowEnabled.toString()}</td></tr>
                <tr><td>Escrow Validator Hash</td><td>{swapInfo.escrowHash}</td></tr>
                <tr><td>User Token MPH</td><td>{swapInfo.userTokenMPH}</td></tr>
                <tr><td>User Token Validator Hash</td><td>{swapInfo.userTokenValHash}</td></tr>
                <tr><td>Min Ada</td><td>{swapInfo.minAda}</td></tr>
                <tr><td>Deposit Ada</td><td>{swapInfo.depositAda}</td></tr>
                <tr><td>Service Fee</td><td>{swapInfo.serviceFee}</td></tr>
                <tr><td>Version</td><td>{swapInfo.version}</td></tr>
            </tbody>
            </table>
            <form onSubmit={onSubmitUpdate}>
                <hr></hr>
                <div>
                    Asked Asset Price
                    <br></br>
                    <input name='askedQty' type='number' id='askedQty' placeholder='Enter Asked Token Quantity' 
                    value={askedQty}
                    onChange={(e) => setAskedQty(e.target.value)}
                    />
                    <p></p>                 
                </div>
                <div>
                    Offered Asset Quantity
                    <br></br>
                    <input name='offeredQty' type='number' id='offeredQty' placeholder='Enter Offered Token Quantity' 
                    value={offeredQty}
                    onChange={(e) => setOfferedQty(e.target.value)}
                    />
                    <p></p>                 
                </div>
                <br></br>                   
                <input type='submit' value='Update Swap'/>
            </form>
            <hr></hr>
            <form onSubmit={onSubmitClose}>
                <input type='submit' value='Close Swap'/>
            </form>
        </div>
    )
}

export default SwapInfo