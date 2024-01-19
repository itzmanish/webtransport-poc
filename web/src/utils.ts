
export function isEmpty(obj: Object) {
    return Object.keys(obj).length === 0;
}

export function decimalToBytes(decimalNumber: number) {
    // Create a buffer with enough space to store the 32-bit integer
    const buffer = new ArrayBuffer(4);

    // Create a DataView to work with the buffer
    const dataView = new DataView(buffer);

    // Set the 32-bit integer value in little-endian format
    dataView.setUint32(0, decimalNumber, true);

    // Extract the bytes from the DataView
    const byteArray = new Uint8Array(buffer);

    return byteArray;
}

export function bytesToDecimal(byteArray: number[]) {
    // Create an ArrayBuffer and copy the bytes to it
    const buffer = new ArrayBuffer(byteArray.length);
    const dataView = new DataView(buffer);

    // Copy the bytes to the buffer
    byteArray.forEach((byte, index) => {
        dataView.setUint8(index, byte);
    });

    // Read the 32-bit integer value from the DataView
    const decimalNumber = dataView.getUint32(0, true);

    return decimalNumber;
}

export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}