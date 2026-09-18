// JWT 工具 —— 基于 Web Crypto 的 HS256 实现，无需第三方依赖，
// 可直接在 Cloudflare Workers / Vinext 运行时使用。

const ALGORITHM = "HS256";

/**
 * JWT 标准声明 + 自定义声明。
 * `sub` 为签发主体，通常存用户 id。
 */
export interface JwtPayload {
    /** 签发主体，通常是用户 id */
    sub: string;
    /** 签发者 */
    iss?: string;
    /** 签发时间（Unix 秒） */
    iat?: number;
    /** 生效时间（Unix 秒） */
    nbf?: number;
    /** 过期时间（Unix 秒） */
    exp?: number;
    /** 其它自定义声明 */
    [claim: string]: unknown;
}

export interface SignJwtOptions {
    /** 过期时间，单位秒（从当前时间起算），不传则永不过期 */
    expiresIn?: number;
    /** 签发者（iss） */
    issuer?: string;
}

export interface VerifyJwtOptions {
    /** 校验签发者（iss），不传则不校验 */
    issuer?: string;
    /** 时钟容差，单位秒，默认 0 */
    clockTolerance?: number;
}

/**
 * 生成 JWT。
 * @param payload 载荷，必须包含 `sub`
 * @param secret  签名密钥（HS256），一般来自环境变量/secret
 * @param options 过期时间、签发者等
 */
export async function signJwt(
    payload: JwtPayload,
    secret: string,
    options: SignJwtOptions = {},
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const claims: JwtPayload = { ...payload };
    claims.iat ??= now;
    if (options.issuer !== undefined) {
        claims.iss ??= options.issuer;
    }
    if (options.expiresIn !== undefined) {
        claims.exp = now + options.expiresIn;
    }

    const header = { alg: ALGORITHM, typ: "JWT" };
    const signingInput = `${encodeSegment(header)}.${encodeSegment(claims)}`;
    const signature = await hmacSign(signingInput, secret);

    return `${signingInput}.${signature}`;
}

/**
 * 校验 JWT 并返回载荷。
 * 签名错误、格式错误、已过期或未生效时返回 `null`。
 */
export async function verifyJwt<T extends JwtPayload = JwtPayload>(
    token: string,
    secret: string,
    options: VerifyJwtOptions = {},
): Promise<T | null> {
    const parts = token.split(".");
    if (parts.length !== 3) {
        return null;
    }

    const [headerSegment, payloadSegment, signatureSegment] = parts;
    if (!headerSegment || !payloadSegment || !signatureSegment) {
        return null;
    }

    let header: { alg?: string };
    try {
        header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerSegment)));
    } catch {
        return null;
    }
    if (header.alg !== ALGORITHM) {
        return null;
    }

    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        base64UrlToBytes(signatureSegment),
        new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
    );
    if (!valid) {
        return null;
    }

    const payload = decodeJwt<T>(token);
    if (!payload) {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const tolerance = options.clockTolerance ?? 0;

    if (typeof payload.exp === "number" && now > payload.exp + tolerance) {
        return null;
    }
    if (typeof payload.nbf === "number" && now + tolerance < payload.nbf) {
        return null;
    }
    if (options.issuer !== undefined && payload.iss !== options.issuer) {
        return null;
    }

    return payload;
}

/**
 * 仅解码 JWT 载荷，不校验签名。
 * 仅用于读取非敏感信息（如前端展示），不要用它做鉴权。
 */
export function decodeJwt<T extends JwtPayload = JwtPayload>(token: string): T | null {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) {
        return null;
    }

    try {
        return JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1]))) as T;
    } catch {
        return null;
    }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
}

async function hmacSign(data: string, secret: string): Promise<string> {
    const key = await importHmacKey(secret);
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(data),
    );

    return bytesToBase64Url(new Uint8Array(signature));
}

function encodeSegment(value: unknown): string {
    return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function base64UrlToBytes(segment: string): Uint8Array<ArrayBuffer> {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64.length % 4)) % 4;
    const binary = atob(base64.padEnd(base64.length + padding, "="));

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}
