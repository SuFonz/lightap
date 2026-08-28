
/**
 * 将 PEM 格式的密钥字符串（公钥/私钥）解析为 ArrayBuffer，
 * 可直接用于 WebCrypto 的 importKey。
 */
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

/** 将字节数组编码为 Base64 字符串（摘要值、签名值都用它表示）。 */
function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

/** RFC 8941（Structured Fields）String 转义。 */
function escapeSfString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** 用 PKCS8 私钥做 RSA-SHA256 签名，返回 Base64 签名值；失败返回 null。 */
async function rsaSha256Sign(privateKeyPem: string, data: string): Promise<string | null> {
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
            new TextEncoder().encode(data)
        );
        return toBase64(new Uint8Array(sig));
    } catch {
        return null;
    }
}

/** 签名版本："legacy" 为 draft-cavage 旧版（单 Signature header），"rfc9421" 为 RFC 9421 消息签名 */
export type SignatureVersion = "legacy" | "rfc9421";

/**
 * 待签名/验签请求的统一描述。
 * 旧版的 (request-target) 伪 header 与 RFC 9421 的派生组件（@target-uri 等）都从 url 推导。
 */
export interface SigningRequest {
    /** HTTP 方法，如 POST（旧版转小写，RFC 9421 原样使用） */
    method: string;
    /** 完整请求 URL，含协议与主机名 */
    url: string;
    /** 根据 header 名获取对应的 header 值，不存在时返回 null */
    getHeader(name: string): string | null;
}

/** signRequest 的可选项，两版各自用到其中一部分 */
export interface SignOptions {
    /** legacy：参与签名的 header 名列表 */
    headerNames?: string[];
    /** legacy：是否把 (created) 加入签名串 */
    includeCreated?: boolean;
    /** rfc9421：覆盖组件列表，派生组件以 @ 开头，header 用小写名 */
    components?: string[];
    /** rfc9421：签名标签，默认 "sig1" */
    label?: string;
    /** rfc9421：签名有效期（秒），默认 300 */
    expiresInSeconds?: number;
}

/** 签名之后的结果（旧版） */
export type SignResult = {
    "Signature": string,
} & Record<string, string>;

/** 签名之后的结果（RFC 9421） */
export type SignResultRFC9421 = {
    "Signature-Input": string,
    "Signature": string,
} & Record<string, string>;

/**
 * 计算请求体的 SHA-256 摘要。
 *
 * @param version "legacy"（默认）生成旧版 Digest 值 `SHA-256=Base64`；
 *                "rfc9421" 生成 RFC 9530 Content-Digest 值 `sha-256=:Base64:`
 */
export async function createDigest(body: string, version: SignatureVersion = "legacy"): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const base64 = toBase64(new Uint8Array(hash));
    return version === "rfc9421" ? `sha-256=:${base64}:` : `SHA-256=${base64}`;
}

/**
 * 旧版签名串：多行 `header名: 值` 用 \n 连接。
 * (request-target) / (created) 是伪 header，分别从 url 和时间戳推导。
 */
function buildLegacySigningString(
    signingRequest: SigningRequest,
    headerNames: string[],
    created: string | null,
): string | null {
    const { pathname, search } = new URL(signingRequest.url);
    const lines: string[] = [];
    for (const name of headerNames) {
        const lower = name.toLowerCase();
        if (lower === "(request-target)") {
            lines.push(`(request-target): ${signingRequest.method.toLowerCase()} ${pathname}${search}`);
        } else if (lower === "(created)") {
            if (!created) return null;
            lines.push(`(created): ${created}`);
        } else {
            lines.push(`${lower}: ${signingRequest.getHeader(lower) ?? ""}`);
        }
    }
    return lines.join("\n");
}

/**
 * RFC 9421 派生组件的值（§2.2）：
 * @method 原样；@authority 小写、省略默认端口；@path 空为 "/"；@query 无查询串为 "?"
 */
function derivedComponentValue(name: string, req: SigningRequest): string | null {
    const url = new URL(req.url);
    switch (name) {
        case "@method": return req.method;
        case "@target-uri": return req.url;
        case "@authority": return url.host;
        case "@path": return url.pathname || "/";
        case "@query": return url.search || "?";
        default: return null;
    }
}

/**
 * 使用公钥验证旧版 HTTP 签名（用于收到远端请求时校验对方身份），
 * 目前联邦宇宙对端普遍仍是旧版格式。任何一步出错都返回 false。
 */
export async function verifyHttpSignature(
    publicKeyPem: string,
    signatureHeader: string,
    signingRequest: SigningRequest,
): Promise<boolean> {
    // 把 "a=1,b=2" 形式的 Signature header 解析成键值对，并去掉值两侧的引号
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

    const signingString = buildLegacySigningString(signingRequest, headerNames, params.created ?? null);
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

/**
 * 解析 Signature-Input 的值：`标签=("组件" ...);参数串`。
 * 返回标签、括号内原始内容（覆盖组件）、以及括号后的原始参数串；
 * 括号外的参数原样保留，重建 @signature-params 时必须复用它们。
 * 括号不匹配时返回 null。
 */
function parseSignatureInput(value: string): { label: string; inner: string; params: string } | null {
    const eq = value.indexOf("=");
    if (eq === -1) return null;
    const label = value.slice(0, eq).trim();
    const rest = value.slice(eq + 1);

    const start = rest.indexOf("(");
    if (start === -1) return null;
    let depth = 0;
    let end = -1;
    for (let i = start; i < rest.length; i++) {
        if (rest[i] === "(") depth++;
        else if (rest[i] === ")") {
            depth--;
            if (depth === 0) { end = i; break; }
        }
    }
    if (end === -1) return null;

    return { label, inner: rest.slice(start + 1, end), params: rest.slice(end + 1).replace(/^\s*;\s*/, "") };
}

/**
 * 解析覆盖组件 Inner List 的内容（括号内），得到组件名列表。
 * 组件之间只允许空白；带参数的组件（如 `"@query-param";name="..."`）
 * 或空列表不受支持，返回 null。
 */
function parseCoveredComponents(inner: string): string[] | null {
    const re = /"(?:[^"\\]|\\.)*"/g;
    const components: string[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner)) !== null) {
        if (inner.slice(last, m.index).trim() !== "") return null;
        components.push(m[0].slice(1, -1).replace(/\\(.)/g, "$1"));
        last = re.lastIndex;
    }
    return inner.slice(last).trim() === "" && components.length > 0 ? components : null;
}

/**
 * 验证 RFC 9421 消息签名（用于收到远端请求时校验对方身份），
 * 与 verifyHttpSignature 分别对应两版格式。任何一步出错都返回 false。
 *
 * 验证流程：
 *   1. 从 Signature-Input 取出标签、覆盖组件与原始参数串
 *   2. 从 Signature 取出签名值（标签须一致），检查 alg 与 expires
 *   3. 按签名端相同规则重建签名基串（@signature-params 复用原始序列化值）
 *   4. 用对方公钥（PEM）做 RSA-SHA256 验签
 *
 * 限制：仅支持单签名与不带参数的覆盖组件；alg 仅支持 rsa-v1_5-sha256。
 */
export async function verifyRfc9421Signature(
    publicKeyPem: string,
    signatureInputHeader: string,
    signatureHeader: string,
    signingRequest: SigningRequest,
): Promise<boolean> {
    try {
        const input = parseSignatureInput(signatureInputHeader);
        if (!input) return false;

        const sigMatch = signatureHeader.match(/^([A-Za-z0-9_-]+)=:([A-Za-z0-9+/=]+):$/);
        if (!sigMatch || sigMatch[1] !== input.label) return false;

        const components = parseCoveredComponents(input.inner);
        if (!components) return false;

        const alg = input.params.match(/(?:^|;)\s*alg="([^"]*)"/);
        if (alg && alg[1] !== "rsa-v1_5-sha256") return false;

        // expires（Unix 秒）已过即拒绝
        const expires = input.params.match(/(?:^|;)\s*expires=(\d+)/);
        if (expires && Date.now() / 1000 > Number(expires[1])) return false;

        const lines: string[] = [];
        for (const c of components) {
            const name = c.toLowerCase();
            const value = name.startsWith("@")
                ? derivedComponentValue(name, signingRequest)
                : signingRequest.getHeader(name);
            if (value === null) return false;
            lines.push(`"${name}": ${value}`);
        }
        const serializedParams = input.params ? `(${input.inner});${input.params}` : `(${input.inner})`;
        const signatureBase = `${lines.join("\n")}\n"@signature-params": ${serializedParams}`;

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
            Uint8Array.from(atob(sigMatch[2]), (c) => c.charCodeAt(0)),
            new TextEncoder().encode(signatureBase)
        );
    } catch {
        return false;
    }
}

/**
 * 对请求签名，返回应并入请求的 header 集合：
 *   - legacy：{ Signature: "keyId=...,signature=..." }
 *   - rfc9421：{ "Signature-Input": "sig1=(...);created=...", Signature: "sig1=:Base64:" }
 *
 * 两版共用同一把 RSA 密钥。失败（私钥无效、被签 header 缺失等）返回 null。
 */
export async function signRequest(
    privateKeyPem: string,
    keyId: string,
    signingRequest: SigningRequest,
    version: SignatureVersion = "legacy",
    options: SignOptions = {},
): Promise<SignResult | SignResultRFC9421 | null> {
    const created = Math.floor(Date.now() / 1000);

    if (version === "rfc9421") {
        const components = options.components
            ?? ["@method", "@target-uri", "@authority", "content-type", "date", "content-digest"];

        // 签名参数（§2.3）：覆盖组件 Inner List + 元数据，顺序一经选定不可改变
        const params = `(${components.map((c) => `"${c.toLowerCase()}"`).join(" ")})`
            + `;created=${created};expires=${created + (options.expiresInSeconds ?? 300)}`
            + `;keyid="${escapeSfString(keyId)}";alg="rsa-v1_5-sha256"`;

        // 签名基串（§2.5）：逐行 `"组件名": 值`，末行为 @signature-params，\n 连接、末尾无换行
        const lines: string[] = [];
        for (const c of components) {
            const name = c.toLowerCase();
            const value = name.startsWith("@")
                ? derivedComponentValue(name, signingRequest)
                : signingRequest.getHeader(name);
            if (value === null) return null;
            lines.push(`"${name}": ${value}`);
        }
        const signatureBase = `${lines.join("\n")}\n"@signature-params": ${params}`;

        const sig = await rsaSha256Sign(privateKeyPem, signatureBase);
        if (sig === null) return null;

        const label = options.label ?? "sig1";
        return {
            "Signature-Input": `${label}=${params}`,
            "Signature": `${label}=:${sig}:`,
        };
    }

    // legacy（draft-cavage）
    const headerNames = options.headerNames ?? ["(request-target)", "host", "date", "digest"];
    const includeCreated = options.includeCreated ?? false;
    const signingString = buildLegacySigningString(
        signingRequest,
        [...headerNames, ...(includeCreated ? ["(created)"] : [])],
        includeCreated ? created.toString() : null
    );
    if (signingString === null) return null;

    const sig = await rsaSha256Sign(privateKeyPem, signingString);
    if (sig === null) return null;

    return {
        "Signature": `keyId="${keyId}",algorithm="rsa-sha256",created="${created}",headers="${headerNames.join(" ")}",signature="${sig}"`,
    };
}
