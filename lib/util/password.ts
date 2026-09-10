const enc = new TextEncoder();

const ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const SCHEME = "pbkdf2-sha256";

const toB64Url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

const fromB64Url = (s: string) =>
    new Uint8Array(
        [...atob(s.replace(/-/g, "+").replace(/_/g, "/"))].map((c) =>
            c.charCodeAt(0)
        )
    );

async function derive(
    password: string,
    salt: Uint8Array,
    iterations: number
): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: salt as BufferSource,
            iterations,
        },
        key,
        KEY_LENGTH * 8
    );

    return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const hash = await derive(password, salt, ITERATIONS);
    return `${SCHEME}$${ITERATIONS}$${toB64Url(salt)}$${toB64Url(hash)}`;
}

export async function verifyPassword(
    password: string,
    stored: string
): Promise<boolean> {
    const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
    if (scheme !== SCHEME || !iterStr || !saltB64 || !hashB64) {
        return false;
    }

    const iterations = Number(iterStr);
    if (!Number.isInteger(iterations) || iterations <= 0) {
        return false;
    }

    const actual = await derive(
        password,
        fromB64Url(saltB64),
        iterations
    );
    const expected = fromB64Url(hashB64);

    if (actual.length !== expected.length) {
        return false;
    }

    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
        diff |= actual[i] ^ expected[i];
    }

    return diff === 0;
}

export function getDummyHash(): Promise<string> {
    const dummyHashPromise = hashPassword("dummy-password");
    return dummyHashPromise;
}
