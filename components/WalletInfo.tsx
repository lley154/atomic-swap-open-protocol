import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faPaste } from '@fortawesome/free-solid-svg-icons';


const copyToClipboard = ({ text } : any) => {
    navigator.clipboard.writeText(text);
}; 

/**
 * @param {string} mph
 * @param {string} tn
 * @param {string} qty
*/
const Item = ({ mph, tn, qty} : any) => {
    
    const copyToClipboard = () => {
        console.log("mph: ", mph);
        const text = mph as unknown as string;
        navigator.clipboard.writeText(text);
    }; 
    return(
    <tr>
        <td>{mph} 
            <span onClick={copyToClipboard}>
                <FontAwesomeIcon icon={faCopy} />
            </span>
            </td>
        <td>{tn}</td>
        <td>{qty}</td>
    </tr>
  );
}
const WalletInfo = ({ walletInfo } : any) => {

    console.log("walletInfo: ", walletInfo);

    return (
        <div style={{ width: '100%'}}>
            <b>Wallet Balance In Lovelace</b><hr></hr>
            <table style={{ width: '100%' }}>
            <thead>
                <tr>
                    <th>Minting Policy Hash</th>
                    <th>Token Name</th>
                    <th>Token Quantity</th>
                </tr>
            </thead>
            <tbody>
                {walletInfo.balance.map((item: any) => (
                    <Item
                        mph={item.mph}
                        tn={item.tn}
                        qty={item.qty}
                        key={item.key}
                    />
                ))}
                </tbody>
            </table>
        </div>
    )
}

export default WalletInfo