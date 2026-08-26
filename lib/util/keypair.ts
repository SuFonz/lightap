function arrayBufferToPem(
  buffer: ArrayBuffer,
  type: "PRIVATE KEY" | "PUBLIC KEY"
): string {
  const bytes = new Uint8Array(buffer);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 = btoa(binary);

  const lines = base64.match(/.{1,64}/g)?.join("\n") ?? "";

  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}


export async function generateActivityPubKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );


  const privateKeyDer = await crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );

  const publicKeyDer = await crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );


  return {
    privateKeyPem: arrayBufferToPem(
      privateKeyDer,
      "PRIVATE KEY"
    ),

    publicKeyPem: arrayBufferToPem(
      publicKeyDer,
      "PUBLIC KEY"
    ),
  };
}