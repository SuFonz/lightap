import { JwtPayload } from "@/lib/types/http"

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (data: Uint8Array) =>
    btoa(String.fromCharCode(...data))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

const unb64url = (s: string) =>
    new Uint8Array(
        [...atob(s.replace(/-/g, "+").replace(/_/g, "/"))].map((c) =>
            c.charCodeAt(0)
        )
    );

const key = (secret: string, usages: KeyUsage[]) =>
    crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        usages
    );

export async function sign<T extends JwtPayload>(
    payload: T,
    secret: string,
    expiresIn = 3600
): Promise<string> {
    const body = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expiresIn,
    };
    const head = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const data = `${head}.${b64url(enc.encode(JSON.stringify(body)))}`;
    const sig = await crypto.subtle.sign("HMAC", await key(secret, ["sign"]), enc.encode(data));
    return `${data}.${b64url(new Uint8Array(sig))}`;
}

export async function verify<T extends JwtPayload = JwtPayload>(
    token: string,
    secret: string
): Promise<T> {
    const [head, body, sig] = token.split(".");
    if (!head || !body || !sig) throw new Error("Invalid token");
    const payload = JSON.parse(dec.decode(unb64url(body))) as T;
    const valid = await crypto.subtle.verify(
        "HMAC",
        await key(secret, ["verify"]),
        unb64url(sig).buffer as ArrayBuffer,
        enc.encode(`${head}.${body}`)
    );
    if (!valid) throw new Error("Invalid signature");
    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000)
        throw new Error("Token expired");
    return payload;
}

export function decode<T extends JwtPayload = JwtPayload>(
    token: string
): T | null {
    try {
        return JSON.parse(dec.decode(unb64url(token.split(".")[1]))) as T;
    } catch {
        return null;
    }
}
