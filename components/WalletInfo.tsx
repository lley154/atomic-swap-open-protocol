const Item = ({ mph, tn, qty} : any) => {
     
    return(
    <tr>
        <td>{mph}</td>
        <td>{tn}</td>
        <td>{qty}</td>
    </tr>
  );
}

const WalletInfo = ({ walletInfo } : any) => {

    return (
        <div style={{ width: '100%'}}>
            <b>Wallet Public Key Hash</b> {walletInfo.pkh}<br></br><br></br>
            <b>Wallet Balance</b><hr></hr>
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
                        key={item.mph + item.tn}
                    />
                ))}
                </tbody>
            </table>
        </div>
    )
}

export default WalletInfo