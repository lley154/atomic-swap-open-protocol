import { useState } from 'react'

const MintProductToken = ({ onMintProductToken } : any) => {

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [img, setImg] = useState('');
    const [id, setId] = useState('');
    const [qty, setQty] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onMintProductToken([name,
                            description,
                            img,
                            id,
                            qty])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Mint Product Token</b>
                <hr></hr>
               Product Name
               <br></br>
                <input name='name' type='text' id='name' placeholder='Enter Product Name' 
                value={name}
                onChange={(e) => setName(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
               Product Description
               <br></br>
                <input name='description' type='text' id='description' placeholder='Enter Product Description' 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
               Product Image URL
               <br></br>
                <input name='img' type='text' id='img' placeholder='Enter Product Image URL' 
                value={img}
                onChange={(e) => setImg(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
               Product Id
               <br></br>
                <input name='id' type='text' id='id' placeholder='Enter Product Id' 
                value={id}
                onChange={(e) => setId(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
               Product Quantity
               <br></br>
                <input name='qty' type='number' id='qty'  
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                />
                <p></p>                 
            </div>
            <br></br>                   
            <input type='submit' value='Mint Product Token'/>
        </form>
    )
}

export default MintProductToken