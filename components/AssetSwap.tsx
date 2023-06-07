import { ChangeEvent, useState } from 'react'

const assetSwap = ({ onAssetSwap, swapInfo } : any) => {

    const [buyQty, setBuyQty] = useState('');
    let amtToBuy = Number(buyQty) *  Number(swapInfo.askedAssetPrice);

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onAssetSwap([amtToBuy])
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const inputValue = event.target.value;
        // Check if the input is a positive number
        if (/^\d+$/.test(inputValue) || inputValue === '') {
          setBuyQty(inputValue);
        }
      };

    return (

        <form onSubmit={onSubmit}>
            <b>Asset Swap</b>
            <hr></hr>
            <div>
                Buy Quantity
                <br></br>
                <input name='buyQty' type='number' id='buyQty' placeholder='Enter Amount To Buy' 
                value={buyQty}
                onChange={(e) => handleChange(e)}
                />
                <p></p>                 
            </div>
            <div>
                Order Amount
                <table style={{ width: '100%' }}>
                <tbody>
                    <tr><td>Asked Asset Minting Policy Hash</td><td>{swapInfo.askedAssetMPH}</td></tr>
                    <tr><td>Asked Asset Token Name</td><td>{swapInfo.askedAssetTN === "" ? "lovelace" : swapInfo.askedAssetTN}</td></tr>
                    <tr><td>Asked Asset Price</td><td>{swapInfo.askedAssetPrice.toLocaleString()}</td></tr>
                    <tr><td>Total Cost</td><td>{amtToBuy.toLocaleString()}</td></tr>
                </tbody>    
                </table>            
            </div>
            <br></br>                   
            <input type='submit' value='Asset Swap'/>
        </form>
    )
}

export default assetSwap