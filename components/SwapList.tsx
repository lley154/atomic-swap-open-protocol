

/**
 * @param { asset, swapInfo }
 */
const Item = ({ asset, swapInfo } : any) => {

    console.log("SwapList: asset: ", asset);
    return(
        <tr>
            <td><input type="radio" id="beacon" name="asset" value={asset} onChange={swapInfo}/>&nbsp;{asset}</td>
        </tr>
    );
}

const SwapList = ({ swapList, onSwapInfo } : any) => {

    return (
        <div style={{ width: '100%'}}>
            <b>List Of Swaps</b><hr></hr>
            <table style={{ width: '100%' }}>
            <thead>
                <tr>
                    <th>Beacon Asset Key</th>
                </tr>
            </thead>
            <tbody>
            {swapList.map((item : any) => (
                    <Item
                        asset={item.asset}
                        swapInfo={onSwapInfo}
                        key={item.asset + item.quantity}
                    />
                ))}   
            </tbody>
            </table>
        </div>
    )
}

export default SwapList