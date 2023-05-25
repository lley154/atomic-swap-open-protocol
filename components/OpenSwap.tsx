import { useState } from 'react'

const openSwap = ({ onOpenSwap } : any) => {

    const [version, setVersion] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onInitSwap([version])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Open Swap</b> 
                <br></br>
                <input name='version' type='text' id='version' placeholder='Enter Swap Script Version' 
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                />
                <p></p>                 
            </div>
            <br></br>                   
            <input type='submit' value='Open Swap'/>
        </form>
    )
}

export default openSwap