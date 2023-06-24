const Item = ({ txHash, escrowInfo } : any) => {

    return(
        <tr>
            <td><input type="radio" id="escrow" name="txHash" value={txHash} onChange={escrowInfo}/>&nbsp;{txHash}</td>
        </tr>
    );
}

const EscrowList = ({ escrowList, onEscrowInfo } : any) => {

    return (
        <div style={{ width: '100%'}}>
            <b>List Of Escrows</b><hr></hr>
            <table style={{ width: '100%' }}>
            <thead>
                <tr>
                    <th>Escrow Key</th>
                </tr>
            </thead>
            <tbody>
            {escrowList.map((item : any) => (
                    <Item
                        txHash={item.txHash}
                        escrowInfo={onEscrowInfo}
                        key={item.txHash}
                    />
                ))}   
            </tbody>
            </table>
        </div>
    )
}

export default EscrowList