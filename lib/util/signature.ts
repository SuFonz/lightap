
function pemToArrayBuffer(pem: string): ArrayBuffer {
    const body = pem
        .replace(/-----BEGIN[^-]+-----/, "")
        .replace(/-----END[^-]+-----/, "")
        .replace(/\s+/g, "");

    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer as ArrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

export interface SigningRequest {
    method: string;
    pathname: string;
    getHeader(name: string): string | null;
}

function buildSigningString(
    signingRequest: SigningRequest,
    headerNames: string[],
    created: string | null,
): string | null {
    const lines: string[] = [];
    for (const name of headerNames) {
        const lower = name.toLowerCase();
        if (lower === "(request-target)") {
            lines.push(
                `(request-target): ${signingRequest.method.toLowerCase()} ${signingRequest.pathname}`
            );
        } else if (lower === "(created)") {
            if (!created) return null;
            lines.push(`(created): ${created}`);
        } else {
            lines.push(`${lower}: ${signingRequest.getHeader(lower) ?? ""}`);
        }
    }
    return lines.join("\n");
}

export async function createDigest(body: string): Promise<string> {
    const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(body)
    );

    const base64 = btoa(
        String.fromCharCode(...new Uint8Array(hash))
    );

    return `SHA-256=${base64}`;
}

export async function verifyHttpSignature(
    publicKeyPem: string,
    signatureHeader: string,
    signingRequest: SigningRequest,
): Promise<boolean> {
    const params: Record<string, string> = {};
    for (const part of signatureHeader.split(",")) {
        const idx = part.indexOf("=");
        if (idx === -1) continue;
        params[part.slice(0, idx).trim()] = part
            .slice(idx + 1)
            .trim()
            .replace(/^"|"$/g, "");
    }

    const signature = params.signature;
    if (!signature) return false;

    const headerNames = (params.headers ?? "(request-target) host date")
        .split(" ")
        .filter(Boolean);

    const signingString = buildSigningString(signingRequest, headerNames, params.created ?? null);
    if (!signingString) return false;

    try {
        const key = await crypto.subtle.importKey(
            "spki",
            pemToArrayBuffer(publicKeyPem),
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["verify"]
        );

        return await crypto.subtle.verify(
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            key,
            Uint8Array.from(atob(signature), (c) => c.charCodeAt(0)),
            new TextEncoder().encode(signingString)
        );
    } catch {
        return false;
    }
}

export async function signHttpSignature(
    privateKeyPem: string,
    keyId: string,
    signingRequest: SigningRequest,
    headerNames: string[] = ["(request-target)", "(created)", "host", "date"],
): Promise<string | null> {
    const created = Math.floor(Date.now() / 1000).toString();

    const signingString = buildSigningString(signingRequest, headerNames, created);
    if (!signingString) return null;

    try {
        const key = await crypto.subtle.importKey(
            "pkcs8",
            pemToArrayBuffer(privateKeyPem),
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const sig = await crypto.subtle.sign(
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            key,
            new TextEncoder().encode(signingString)
        );

        return `keyId="${keyId}",algorithm="rsa-sha256",created="${created}",headers="${headerNames.join(" ")}",signature="${toBase64(new Uint8Array(sig))}"`;
    } catch {
        return null;
    }
}
