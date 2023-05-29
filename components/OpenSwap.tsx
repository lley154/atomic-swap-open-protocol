import { useState } from 'react'

const openSwap = ({ onOpenSwap } : any) => {

    const [version, setVersion] = useState('');
    const [askedMPH, setAskedMPH] = useState('');
    const [askedTN, setAskedTN] = useState('');
    const [askedQty, setAskedQty] = useState('');
    const [offeredMPH, setOfferedMPH] = useState('');
    const [offeredTN, setOfferedTN] = useState('');
    const [offeredQty, setOfferedQty] = useState('');
    const [escrowEnabled, setEscrowEnabled] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onOpenSwap([version,
                    askedMPH,
                    askedTN,
                    askedQty,
                    offeredMPH,
                    offeredTN,
                    offeredQty,
                    escrowEnabled])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Open Swap</b>
                <hr></hr>
                Version
                <br></br>
                <input name='version' type='text' id='version' placeholder='0' 
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                Asked MPH
                <br></br>
                <input name='askedMPH' type='text' id='askedMPH' placeholder='Enter Asked MPH' 
                value={askedMPH}
                onChange={(e) => setAskedMPH(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                Asked Token Name
                <br></br>
                <input name='askedTN' type='text' id='askedTN' placeholder='Enter Asked Token Name' 
                value={askedTN}
                onChange={(e) => setAskedTN(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                Asked Token Quantity
                <br></br>
                <input name='askedQty' type='number' id='askedQty' placeholder='Enter Asked Token Quantity' 
                value={askedQty}
                onChange={(e) => setAskedQty(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                Offered Token MPH
                <br></br>
                <input name='offeredMPH' type='text' id='offeredMPH' placeholder='Enter Offered MPH' 
                value={offeredMPH}
                onChange={(e) => setOfferedMPH(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                Offered Token Name
                <br></br>
                <input name='offeredTN' type='text' id='offeredTN' placeholder='Enter Offered Token Name' 
                value={offeredTN}
                onChange={(e) => setOfferedTN(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                Offered Token Quantity
                <br></br>
                <input name='offeredQty' type='number' id='offeredQty' placeholder='Enter Offered Token Quantity' 
                value={offeredQty}
                onChange={(e) => setOfferedQty(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                Escrow Enabled
                <br></br>
                <input name='escrowEnabled' type='checkbox' id='escrowEnabled'  
                value={escrowEnabled}
                onChange={(e) => setEscrowEnabled(e.target.value)}
                />
                <p></p>                 
            </div>
            <br></br>                   
            <input type='submit' value='Open Swap'/>
        </form>
    )
}

export default openSwap