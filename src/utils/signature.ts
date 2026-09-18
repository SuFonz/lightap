// HTTP 签名工具 —— 基于 Web Crypto，适配 Cloudflare Workers。
//
// 包含两套标准：
//   1. ActivityPub 主流方案：draft-cavage HTTP Signatures（`Signature` 头 + `rsa-sha256`）
//   2. RFC 9421 HTTP Message Signatures（`Signature-Input` + `Signature` 头）
//
// 密钥格式与 keypair.ts 一致：
//   公钥 = SPKI PEM（-----BEGIN PUBLIC KEY-----）
//   私钥 = PKCS8 PEM（-----BEGIN PRIVATE KEY-----）
//   算法 = RSASSA-PKCS1-v1_5 + SHA-256

/* -------------------------------------------------------------------------- */
/* 公共类型与工具                                                              */
/* -------------------------------------------------------------------------- */

/** 可参与签名的请求头来源 */
export type HeaderSource = Headers | Record<string, string>;

/** 可计算摘要的请求体 */
export type SignableBody = string | ArrayBuffer | Uint8Array | Blob;

/** 大小写不敏感地读取请求头 */
function getHeader(headers: HeaderSource, name: string): string | null {
    if (headers instanceof Headers) {
        return headers.get(name);
    }

    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lower) {
            return value;
        }
    }
    return null;
}

/** PEM -> DER(ArrayBuffer) */
function pemToDer(pem: string): ArrayBuffer {
    const base64 = pem
        .replace(/-----BEGIN [^-]+-----/g, "")
        .replace(/-----END [^-]+-----/g, "")
        .replace(/\s+/g, "");

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "spki",
        pemToDer(pem),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
    );
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "pkcs8",
        pemToDer(pem),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
    );
}

function bytesToBase64(bytes: Uint8Array<ArrayBufferLike>): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function bodyToBytes(body: SignableBody): Promise<Uint8Array<ArrayBuffer>> {
    if (typeof body === "string") {
        return new TextEncoder().encode(body);
    }
    if (body instanceof ArrayBuffer) {
        return new Uint8Array(body);
    }
    if (body instanceof Uint8Array) {
        return new Uint8Array(body);
    }
    if (typeof Blob !== "undefined" && body instanceof Blob) {
        return new Uint8Array(await body.arrayBuffer());
    }
    throw new TypeError("Unsupported body type for digest");
}

/** draft-cavage Digest 头（RFC 3230 风格）：`SHA-256=xxxx` */
export async function createDigestHeader(body: SignableBody): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", await bodyToBytes(body));
    return `SHA-256=${bytesToBase64(new Uint8Array(hash))}`;
}

/** RFC 9421/9530 Content-Digest 头：`sha-256=:xxxx:` */
export async function createContentDigest(body: SignableBody): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", await bodyToBytes(body));
    return `sha-256=:${bytesToBase64(new Uint8Array(hash))}:`;
}

/* -------------------------------------------------------------------------- */
/* 版本一：ActivityPub 主流方案（draft-cavage HTTP Signatures）                */
/* -------------------------------------------------------------------------- */

export interface ActivityPubSignInput {
    method: string;
    url: string;
    headers: HeaderSource;
    /** PKCS8 PEM 私钥 */
    privateKey: string;
    /** 公钥地址，例如 `https://example.com/users/alice#main-key` */
    keyId: string;
    /** 参与签名的头，默认取 (request-target) host date [digest] [content-type] */
    headerNames?: string[];
    /** 仅当 headerNames 含 `(created)` 时使用，Unix 秒 */
    created?: number;
    /** 仅当 headerNames 含 `(expires)` 时使用，Unix 秒 */
    expires?: number;
}

export interface ActivityPubSignResult {
    /** 直接写入 `Signature` 请求头的值 */
    signature: string;
    headerNames: string[];
    /** 签名原文，调试用 */
    signingString: string;
}

export interface ActivityPubVerifyInput {
    method: string;
    url: string;
    headers: HeaderSource;
    /** SPKI PEM 公钥 */
    publicKey: string;
    /** 若提供，则校验 keyId 必须一致 */
    expectedKeyId?: string;
    /** 必须包含在已签名头里的头名（小写） */
    requiredHeaderNames?: string[];
    /** 最大允许时间，单位秒（基于 created 或 date 头） */
    maxAge?: number;
    /** 时钟容差，单位秒，默认 0 */
    clockSkew?: number;
}

export interface ActivityPubVerifyResult {
    valid: boolean;
    keyId?: string;
    algorithm?: string;
    headerNames?: string[];
    signingString?: string;
    error?: string;
}

const ACTIVITYPUB_ALGORITHM = "rsa-sha256";

function defaultActivityPubHeaderNames(headers: HeaderSource): string[] {
    const names = ["(request-target)", "host", "date"];
    if (getHeader(headers, "digest")) {
        names.push("digest");
    }
    if (getHeader(headers, "content-type")) {
        names.push("content-type");
    }
    return names;
}

/** 按 draft-cavage 规则拼签名原文 */
function buildActivityPubSigningString(
    method: string,
    url: string,
    headers: HeaderSource,
    headerNames: string[],
    params: { created?: number; expires?: number },
): string {
    const target = new URL(url);

    return headerNames
        .map((name) => {
            const lower = name.toLowerCase();

            if (lower === "(request-target)") {
                return `(request-target): ${method.toLowerCase()} ${target.pathname}${target.search}`;
            }
            if (lower === "(created)") {
                if (params.created === undefined) {
                    throw new Error("Missing created timestamp");
                }
                return `(created): ${params.created}`;
            }
            if (lower === "(expires)") {
                if (params.expires === undefined) {
                    throw new Error("Missing expires timestamp");
                }
                return `(expires): ${params.expires}`;
            }

            const value =
                lower === "host"
                    ? getHeader(headers, "host") ?? target.host
                    : getHeader(headers, lower);

            if (value === null) {
                throw new Error(`Missing signed header: ${lower}`);
            }
            return `${lower}: ${value.trim()}`;
        })
        .join("\n");
}

/** 解析 draft-cavage `Signature` 头（同时支持带引号与不带引号的值） */
function parseActivityPubSignatureHeader(value: string): Record<string, string> {
    const result: Record<string, string> = {};
    const re = /([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,]+))/g;

    let match: RegExpExecArray | null;
    while ((match = re.exec(value)) !== null) {
        result[match[1]] = (match[2] ?? match[3] ?? "").trim();
    }
    return result;
}

/**
 * 生成 ActivityPub 请求签名。
 * 把返回的 `signature` 写入请求头 `Signature` 即可。
 */
export async function signActivityPubRequest(
    input: ActivityPubSignInput,
): Promise<ActivityPubSignResult> {
    const headerNames = input.headerNames ?? defaultActivityPubHeaderNames(input.headers);
    const signingString = buildActivityPubSigningString(
        input.method,
        input.url,
        input.headers,
        headerNames,
        { created: input.created, expires: input.expires },
    );

    const key = await importPrivateKey(input.privateKey);
    const signatureBytes = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(signingString),
    );

    const parts = [
        `keyId="${input.keyId}"`,
        `algorithm="${ACTIVITYPUB_ALGORITHM}"`,
        `headers="${headerNames.join(" ")}"`,
    ];
    if (input.created !== undefined) {
        parts.push(`created=${input.created}`);
    }
    if (input.expires !== undefined) {
        parts.push(`expires=${input.expires}`);
    }
    parts.push(`signature="${bytesToBase64(new Uint8Array(signatureBytes))}"`);

    return {
        signature: parts.join(","),
        headerNames,
        signingString,
    };
}

/**
 * 校验 ActivityPub 请求签名。
 * 传入的 `headers` 需包含远端发来的 `Signature` 头。
 */
export async function verifyActivityPubRequest(
    input: ActivityPubVerifyInput,
): Promise<ActivityPubVerifyResult> {
    const signatureHeader = getHeader(input.headers, "signature");
    if (!signatureHeader) {
        return { valid: false, error: "Missing Signature header" };
    }

    const params = parseActivityPubSignatureHeader(signatureHeader);
    if (!params.signature) {
        return { valid: false, error: "Missing signature parameter" };
    }

    const algorithm = params.algorithm?.toLowerCase();
    if (algorithm && algorithm !== ACTIVITYPUB_ALGORITHM) {
        return {
            valid: false,
            algorithm: params.algorithm,
            error: `Unsupported algorithm: ${params.algorithm}`,
        };
    }

    if (input.expectedKeyId && params.keyId !== input.expectedKeyId) {
        return {
            valid: false,
            keyId: params.keyId,
            error: "keyId does not match",
        };
    }

    const headerNames = params.headers
        ? params.headers.split(/\s+/).filter(Boolean)
        : ["date"];

    if (input.requiredHeaderNames) {
        const missing = input.requiredHeaderNames.filter(
            (name) => !headerNames.includes(name.toLowerCase()),
        );
        if (missing.length > 0) {
            return {
                valid: false,
                keyId: params.keyId,
                headerNames,
                error: `Missing required signed headers: ${missing.join(", ")}`,
            };
        }
    }

    const created = params.created !== undefined ? Number(params.created) : undefined;
    const expires = params.expires !== undefined ? Number(params.expires) : undefined;
    const now = Math.floor(Date.now() / 1000);
    const skew = input.clockSkew ?? 0;

    if (expires !== undefined && Number.isFinite(expires) && now > expires + skew) {
        return { valid: false, keyId: params.keyId, headerNames, error: "Signature expired" };
    }

    if (input.maxAge !== undefined) {
        if (created !== undefined && Number.isFinite(created)) {
            if (now - created > input.maxAge + skew) {
                return {
                    valid: false,
                    keyId: params.keyId,
                    headerNames,
                    error: "Signature too old",
                };
            }
        } else {
            const dateHeader = getHeader(input.headers, "date");
            const date = dateHeader ? Date.parse(dateHeader) : NaN;
            if (Number.isFinite(date) && now - Math.floor(date / 1000) > input.maxAge + skew) {
                return {
                    valid: false,
                    keyId: params.keyId,
                    headerNames,
                    error: "Signature too old",
                };
            }
        }
    }

    let signingString: string;
    try {
        signingString = buildActivityPubSigningString(
            input.method,
            input.url,
            input.headers,
            headerNames,
            { created, expires },
        );
    } catch (error) {
        return {
            valid: false,
            keyId: params.keyId,
            headerNames,
            error: (error as Error).message,
        };
    }

    const key = await importPublicKey(input.publicKey);
    const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        base64ToBytes(params.signature),
        new TextEncoder().encode(signingString),
    );

    return {
        valid,
        keyId: params.keyId,
        algorithm: params.algorithm,
        headerNames,
        signingString,
        error: valid ? undefined : "Signature verification failed",
    };
}

/* -------------------------------------------------------------------------- */
/* 版本二：RFC 9421 HTTP Message Signatures                                    */
/* -------------------------------------------------------------------------- */

const RFC9421_ALGORITHM = "rsa-v1_5-sha256";

export interface Rfc9421SignInput {
    method: string;
    url: string;
    headers: HeaderSource;
    /** PKCS8 PEM 私钥 */
    privateKey: string;
    /** keyid 参数，例如 `https://example.com/users/alice#main-key` */
    keyId: string;
    /** 被覆盖的组件，默认 @method @target-uri [content-digest] */
    components?: string[];
    /** 创建时间，Unix 秒，默认当前时间 */
    created?: number;
    /** 过期时间，Unix 秒 */
    expires?: number;
    /** 随机数 */
    nonce?: string;
    /** 签名标签，默认 `sig1` */
    label?: string;
    /** 算法，默认 `rsa-v1_5-sha256` */
    algorithm?: string;
}

export interface Rfc9421SignResult {
    /** 直接写入 `Signature-Input` 请求头的值 */
    signatureInput: string;
    /** 直接写入 `Signature` 请求头的值 */
    signature: string;
    /** 签名原文，调试用 */
    signatureBase: string;
    label: string;
}

export interface Rfc9421VerifyInput {
    method: string;
    url: string;
    headers: HeaderSource;
    /** SPKI PEM 公钥 */
    publicKey: string;
    /** 指定要校验的签名标签；不传则尝试所有 */
    label?: string;
    /** 必须被覆盖的组件 */
    requiredComponents?: string[];
    /** 最大允许时间，单位秒（基于 created） */
    maxAge?: number;
    /** 时钟容差，单位秒，默认 0 */
    clockSkew?: number;
}

export interface Rfc9421VerifyResult {
    valid: boolean;
    label?: string;
    keyId?: string;
    algorithm?: string;
    components?: string[];
    created?: number;
    expires?: number;
    signatureBase?: string;
    error?: string;
}

interface ParsedSignatureInput {
    label: string;
    components: string[];
    /** 原始内层列表，含括号，用于精确重建签名原文 */
    innerListRaw: string;
    /** 原始参数串，含前导分号，用于精确重建签名原文 */
    paramsRaw: string;
    params: Record<string, string>;
}

function defaultRfc9421Components(headers: HeaderSource): string[] {
    const components = ["@method", "@target-uri"];
    if (getHeader(headers, "content-digest")) {
        components.push("content-digest");
    }
    return components;
}

/** 计算 RFC 9421 派生组件的值 */
function derivedComponentValue(name: string, method: string, url: string): string | null {
    const target = new URL(url);

    switch (name) {
        case "@method":
            return method.toUpperCase();
        case "@target-uri":
            return target.href;
        case "@authority":
            return target.host;
        case "@scheme":
            return target.protocol.replace(/:$/, "");
        case "@request-target":
            return `${method.toLowerCase()} ${target.pathname}${target.search}`;
        case "@path":
            return target.pathname;
        case "@query":
            return target.search || "?";
        default:
            return null;
    }
}

function componentValue(
    name: string,
    method: string,
    url: string,
    headers: HeaderSource,
): string | null {
    if (name.startsWith("@")) {
        return derivedComponentValue(name, method, url);
    }
    return getHeader(headers, name);
}

/** 按顶层逗号切分结构化字段，忽略引号内与字节序列内的逗号 */
function splitTopLevel(value: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inString = false;
    let inByteSequence = false;

    for (let i = 0; i < value.length; i++) {
        const char = value[i];

        if (inString) {
            current += char;
            if (char === "\\") {
                i++;
                current += value[i] ?? "";
            } else if (char === '"') {
                inString = false;
            }
        } else if (inByteSequence) {
            current += char;
            if (char === ":") {
                inByteSequence = false;
            }
        } else if (char === '"') {
            inString = true;
            current += char;
        } else if (char === ":") {
            inByteSequence = true;
            current += char;
        } else if (char === ",") {
            if (current.trim()) {
                parts.push(current.trim());
            }
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        parts.push(current.trim());
    }
    return parts;
}

function findClosingParen(value: string, start: number): number {
    let depth = 0;
    let inString = false;

    for (let i = start; i < value.length; i++) {
        const char = value[i];
        if (inString) {
            if (char === "\\") {
                i++;
            } else if (char === '"') {
                inString = false;
            }
        } else if (char === '"') {
            inString = true;
        } else if (char === "(") {
            depth++;
        } else if (char === ")") {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function parseInnerList(raw: string): string[] {
    const inner = raw.slice(1, -1);
    const components: string[] = [];

    let i = 0;
    while (i < inner.length) {
        if (inner[i] === '"') {
            let value = "";
            i++;
            while (i < inner.length && inner[i] !== '"') {
                if (inner[i] === "\\") {
                    value += inner[i + 1] ?? "";
                    i += 2;
                    continue;
                }
                value += inner[i];
                i++;
            }
            i++;
            components.push(value);
        } else {
            i++;
        }
    }
    return components;
}

function parseParams(raw: string): Array<[string, string]> {
    const params: Array<[string, string]> = [];
    const re = /;\s*([A-Za-z0-9_-]+)\s*=\s*("[^"]*"|[^;]+)/g;

    let match: RegExpExecArray | null;
    while ((match = re.exec(raw)) !== null) {
        const key = match[1].toLowerCase();
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1).replace(/\\(.)/g, "$1");
        }
        params.push([key, value]);
    }
    return params;
}

function parseSignatureInput(headerValue: string): ParsedSignatureInput[] {
    const parsed: ParsedSignatureInput[] = [];

    for (const item of splitTopLevel(headerValue)) {
        const eq = item.indexOf("=");
        if (eq === -1) {
            continue;
        }

        const label = item.slice(0, eq).trim().toLowerCase();
        const rest = item.slice(eq + 1).trim();
        if (!rest.startsWith("(")) {
            continue;
        }

        const close = findClosingParen(rest, 0);
        if (close === -1) {
            continue;
        }

        const innerListRaw = rest.slice(0, close + 1);
        const paramsRaw = rest.slice(close + 1).trim();
        const paramsOrder = parseParams(paramsRaw);
        const params: Record<string, string> = {};
        for (const [key, value] of paramsOrder) {
            params[key] = value;
        }

        parsed.push({
            label,
            components: parseInnerList(innerListRaw).map((c) => c.toLowerCase()),
            innerListRaw,
            paramsRaw,
            params,
        });
    }
    return parsed;
}

function extractSignatureValue(
    headerValue: string,
    label: string,
): Uint8Array<ArrayBuffer> | null {
    for (const item of splitTopLevel(headerValue)) {
        const eq = item.indexOf("=");
        if (eq === -1) {
            continue;
        }
        if (item.slice(0, eq).trim().toLowerCase() !== label) {
            continue;
        }

        const value = item.slice(eq + 1).trim();
        if (value.startsWith(":") && value.endsWith(":")) {
            return base64ToBytes(value.slice(1, -1));
        }
    }
    return null;
}

/** 按 RFC 9421 §2.5 重建签名原文（含 @signature-params 行） */
function buildRfc9421Base(
    item: ParsedSignatureInput,
    method: string,
    url: string,
    headers: HeaderSource,
): string {
    const lines = item.components.map((name) => {
        const value = componentValue(name, method, url, headers);
        if (value === null) {
            throw new Error(`Missing covered component: ${name}`);
        }
        return `"${name}": ${value.trim()}`;
    });

    const signatureParams = `${item.innerListRaw}${item.paramsRaw}`;
    lines.push(`"@signature-params": ${signatureParams}`);

    return lines.join("\n");
}

/** 生成 RFC 9421 签名，返回 `Signature-Input` 与 `Signature` 两个头的值 */
export async function signRfc9421(input: Rfc9421SignInput): Promise<Rfc9421SignResult> {
    const label = input.label ?? "sig1";
    const components = (input.components ?? defaultRfc9421Components(input.headers)).map((c) =>
        c.toLowerCase(),
    );
    const created = input.created ?? Math.floor(Date.now() / 1000);
    const algorithm = input.algorithm ?? RFC9421_ALGORITHM;

    const innerList = `(${components.map((c) => `"${c}"`).join(" ")})`;

    const params: string[] = [`created=${created}`];
    if (input.expires !== undefined) {
        params.push(`expires=${input.expires}`);
    }
    if (input.nonce) {
        params.push(`nonce="${input.nonce}"`);
    }
    params.push(`keyid="${input.keyId}"`);
    params.push(`alg="${algorithm}"`);

    const signatureParams = `${innerList}${params.map((p) => `;${p}`).join("")}`;

    const lines = components.map((name) => {
        const value = componentValue(name, input.method, input.url, input.headers);
        if (value === null) {
            throw new Error(`Missing covered component: ${name}`);
        }
        return `"${name}": ${value.trim()}`;
    });
    lines.push(`"@signature-params": ${signatureParams}`);
    const signatureBase = lines.join("\n");

    const key = await importPrivateKey(input.privateKey);
    const signatureBytes = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(signatureBase),
    );

    return {
        signatureInput: `${label}=${signatureParams}`,
        signature: `${label}=:${bytesToBase64(new Uint8Array(signatureBytes))}:`,
        signatureBase,
        label,
    };
}

/** 校验 RFC 9421 签名 */
export async function verifyRfc9421(
    input: Rfc9421VerifyInput,
): Promise<Rfc9421VerifyResult> {
    const signatureInputHeader = getHeader(input.headers, "signature-input");
    const signatureHeader = getHeader(input.headers, "signature");
    if (!signatureInputHeader || !signatureHeader) {
        return { valid: false, error: "Missing Signature-Input or Signature header" };
    }

    const all = parseSignatureInput(signatureInputHeader);
    const wantedLabel = input.label?.toLowerCase();
    const candidates = wantedLabel
        ? all.filter((item) => item.label === wantedLabel)
        : all;

    if (candidates.length === 0) {
        return { valid: false, error: "No matching signature found" };
    }

    const now = Math.floor(Date.now() / 1000);
    const skew = input.clockSkew ?? 0;
    let lastError = "Signature verification failed";

    for (const item of candidates) {
        const algorithm = item.params.alg;
        if (algorithm && algorithm.toLowerCase() !== RFC9421_ALGORITHM) {
            lastError = `Unsupported algorithm: ${algorithm}`;
            continue;
        }

        const created = item.params.created !== undefined ? Number(item.params.created) : undefined;
        const expires = item.params.expires !== undefined ? Number(item.params.expires) : undefined;

        if (created === undefined && expires === undefined) {
            lastError = "Signature must contain created or expires";
            continue;
        }
        if (expires !== undefined && Number.isFinite(expires) && now > expires + skew) {
            lastError = "Signature expired";
            continue;
        }
        if (created !== undefined && Number.isFinite(created)) {
            if (created - skew > now) {
                lastError = "Signature created in the future";
                continue;
            }
            if (input.maxAge !== undefined && now - created > input.maxAge + skew) {
                lastError = "Signature too old";
                continue;
            }
        }

        if (input.requiredComponents) {
            const missing = input.requiredComponents.filter(
                (name) => !item.components.includes(name.toLowerCase()),
            );
            if (missing.length > 0) {
                lastError = `Missing required components: ${missing.join(", ")}`;
                continue;
            }
        }

        const signatureBytes = extractSignatureValue(signatureHeader, item.label);
        if (!signatureBytes) {
            lastError = `Missing signature for label: ${item.label}`;
            continue;
        }

        let signatureBase: string;
        try {
            signatureBase = buildRfc9421Base(item, input.method, input.url, input.headers);
        } catch (error) {
            lastError = (error as Error).message;
            continue;
        }

        const key = await importPublicKey(input.publicKey);
        const valid = await crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            key,
            signatureBytes,
            new TextEncoder().encode(signatureBase),
        );

        if (valid) {
            return {
                valid: true,
                label: item.label,
                keyId: item.params.keyid,
                algorithm,
                components: item.components,
                created,
                expires,
                signatureBase,
            };
        }

        lastError = "Signature verification failed";
    }

    return { valid: false, error: lastError };
}
