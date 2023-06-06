export { assert }

/**
 * Throws an error if 'cond' is false.
 * @param {boolean} cond 
 * @param {string} msg 
 */
export default function assert(cond : Boolean, msg: string = "assertion failed") {
	if (!cond) {
		throw new Error(msg);
	}
}