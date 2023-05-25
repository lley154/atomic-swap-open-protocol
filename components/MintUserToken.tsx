import { useState } from 'react'

const mintUserToken = ({ onMintUserToken } : any) => {

    const [address, setAddress] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onMintUserToken([address])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Mint User Token</b> 
                <br></br>
                <input name='address' type='text' id='address' placeholder='Enter Destination Wallet Address' 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                />
                <p></p>                 
            </div>
            <br></br>                   
            <input type='submit' value='Mint User Token'/>
        </form>
    )
}

export default mintUserToken