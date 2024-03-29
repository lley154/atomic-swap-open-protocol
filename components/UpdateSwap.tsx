import { useState } from 'react'

const UpdateSwap = ({ onUpdateSwap } : any) => {

    const [askedQty, setAskedQty] = useState('');
    const [offeredQty, setOfferedQty] = useState('');
 
    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onUpdateSwap([askedQty,
                      offeredQty])
    }

    return (

        <form onSubmit={onSubmit}>
            <b>Update Swap</b>
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
    )
}

export default UpdateSwap