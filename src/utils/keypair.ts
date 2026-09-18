export async function generateRSAKeyPair() {
    return await crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        [
            "sign",
            "verify"
        ]
    );
}

function bufferToPem(
    buffer: ArrayBuffer,
    type: string
) {
    const base64 =
        btoa(
            String.fromCharCode(
                ...new Uint8Array(buffer)
            )
        );

    return `-----BEGIN ${type}-----\n${
        base64.match(/.{1,64}/g)?.join("\n")
    }\n-----END ${type}-----`;
}

export async function exportPublicKey(key: CryptoKey) {
    const buffer =
        await crypto.subtle.exportKey(
            "spki",
            key
        );

    return bufferToPem(
        buffer,
        "PUBLIC KEY"
    );
}

export async function exportPrivateKey(key: CryptoKey) {
    const buffer =
        await crypto.subtle.exportKey(
            "pkcs8",
            key
        );

    return bufferToPem(
        buffer,
        "PRIVATE KEY"
    );
}

