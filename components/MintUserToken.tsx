import { useState } from 'react'

const MintUserToken = ({ onMintUserToken } : any) => {

    const [info, setInfo] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onMintUserToken([info])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Mint User Token</b> 
                <hr></hr>
                Enter User Info
                <br></br>
                <input name='info' type='text' id='info' placeholder='User Info' 
                value={info}
                onChange={(e) => setInfo(e.target.value)}
                />
                <p></p>                 
            </div>
            <br></br>                   
            <input type='submit' value='Mint User Token'/>
        </form>
    )
}

export default MintUserToken