class someObj {
    public why;
    constructor(why: string) {
        this.why = why;
    }
    showMe() {
        return this.why;
    }
}

/*
export const lockAda = async (params : any) => {
		
	const alice = params[0] as object;
	const adaQty = params[1] as number;
    console.log("adaQty", adaQty);
    console.log("alice", alice.showMe());

}
*/


export const lockAda = async (alice: someObj, qty: number) => {
		
	//const alice = params[0] as object;
	//const adaQty = params[1] as number;
    console.log("adaQty", qty);
    console.log("alice", alice.showMe());

}