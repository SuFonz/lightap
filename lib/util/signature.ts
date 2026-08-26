
/**
 * 将 PEM 格式的密钥字符串（公钥/私钥）解析为 ArrayBuffer。
 *
 * PEM 文本形如：
 *   -----BEGIN PUBLIC KEY-----
 *   MIIB...（Base64 编码的密钥数据）
 *   -----END PUBLIC KEY-----
 *
 * 解析步骤：
 *   1. 去掉 BEGIN/END 头尾行，只保留中间的 Base64 数据
 *   2. 去掉所有空白字符
 *   3. 用 atob 把 Base64 解码成二进制字符串
 *   4. 逐字符转成 Uint8Array，再返回其底层 ArrayBuffer
 *
 * @param pem PEM 格式的密钥字符串
 * @returns 密钥的二进制数据（ArrayBuffer），可直接用于 WebCrypto 的 importKey
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

/**
 * 将字节数组编码为 Base64 字符串。
 *
 * WebCrypto 的 sign/verify 返回的是 ArrayBuffer（字节），
 * 而 Signature header 中 signature 字段需要的是 Base64 文本，
 * 所以需要先把字节转成字符串再 btoa 编码。
 *
 * @param bytes 要编码的字节数组
 * @returns 对应的 Base64 字符串
 */
function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

/**
 * 描述待签名请求的抽象接口。
 *
 * 签名与验签都通过该接口获取请求信息，而不是直接依赖
 * Request/fetch 对象，这样无论是出站请求还是入站请求
 * 都能用同一套签名逻辑。
 */
export interface SigningRequest {
    /** HTTP 方法，如 GET、POST */
    method: string;
    /** 请求路径（含查询参数），不含协议和主机名，例如 "/api/users/me/inbox" */
    pathname: string;
    /** 根据 header 名获取对应的 header 值，不存在时返回 null */
    getHeader(name: string): string | null;
}

/**
 * 按照指定的 header 列表构建签名串（signing string）。
 *
 * 签名串是"被签名"的原始文本，由多行 `header名: 值` 组成，用换行符连接。
 * 签名时用它做私钥加密的输入，验签时用同一个字符串做公钥解密比对。
 * 这样收发双方只要使用相同的 header 列表，就能还原出同样的签名串。
 *
 * 特殊处理两种伪 header：
 *   - "(request-target)"：不是真实 header，而是固定的
 *     `方法名 路径` 形式，例如 `post /api/users/me/inbox`
 *   - "(created)"：签名时间戳，同样不是真实 header，由参数传入
 *
 * @param signingRequest 待签名请求的描述
 * @param headerNames 参与签名的 header 名列表
 * @param created 签名创建时间（Unix 秒级时间戳），仅当列表包含 "(created)" 时使用
 * @returns 签名串；若包含 "(created)" 但 created 为空，返回 null
 */
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

/**
 * 计算请求体的 SHA-256 摘要，生成 HTTP 的 Digest header 值。
 *
 * ActivityPub 要求 POST 请求带 Digest header，用来保证请求体在传输途中
 * 没有被篡改。接收方可以用请求体重新计算摘要进行比对。
 *
 * @param body 请求体原始字符串（一般是被 JSON.stringify 后的内容）
 * @returns "SHA-256=<base64>" 格式的摘要字符串
 */
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

/**
 * 使用公钥验证 HTTP 签名是否有效（用于收到远端请求时校验对方身份）。
 *
 * 验证流程：
 *   1. 解析 Signature header，拆出 keyId/headers/created/signature 等参数
 *   2. 根据 headers 参数还原签名串（复用 buildSigningString）
 *   3. 用对方公钥（PEM）做 RSA 验签，比对签名串
 *   4. 任何一步出错都返回 false，绝不抛出异常
 *
 * @param publicKeyPem 远端 actor 的公钥（PEM 格式）
 * @param signatureHeader 请求中 Signature header 的完整值
 * @param signingRequest 当前请求的描述（方法、路径、header 读取）
 * @returns 签名有效返回 true，否则返回 false
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

    // headers 参数指定了签名时用了哪些 header，缺省为 "(request-target) host date"
    const headerNames = (params.headers ?? "(request-target) host date")
        .split(" ")
        .filter(Boolean);

    const signingString = buildSigningString(signingRequest, headerNames, params.created ?? null);
    if (!signingString) return false;

    try {
        // 公钥通常是 SPKI 格式，导入为 RSA-SHA256 验证密钥
        const key = await crypto.subtle.importKey(
            "spki",
            pemToArrayBuffer(publicKeyPem),
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["verify"]
        );

        // 用签名串 + 签名值做 RSA 验证
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
 * 使用私钥对请求签名，生成 Signature header 的值（用于本机向远端发请求）。
 *
 * 签名流程：
 *   1. 生成当前时间戳（Unix 秒），作为签名串中的 "(created)"
 *   2. 构建签名串（默认包含 (request-target)、(created)、host、date 四个字段）
 *   3. 用私钥（PKCS8 格式）做 RSA-SHA256 签名
 *   4. 组装成标准的 Signature header 字符串
 *
 * @param privateKeyPem 本机 actor 的私钥（PEM 格式，PKCS8）
 * @param keyId 公钥的地址，通常是 actor id 末尾拼接 #main-key，
 *              例如 "https://example.com/api/users/me#main-key"
 * @param signingRequest 待签名请求的描述（方法、路径、header 读取）
 * @param headerNames 参与签名的 header 名列表，默认 4 项
 * @returns 组装好的 Signature header 值；签名失败返回 null
 */
export async function signHttpSignature(
    privateKeyPem: string,
    keyId: string,
    signingRequest: SigningRequest,
    headerNames: string[] = ["(request-target)", "host", "date", "digest"],
    includeCreated: boolean = false
): Promise<string | null> {
    // created 是 Unix 秒级时间戳，远端可用它做防重放校验
    const created = Math.floor(Date.now() / 1000).toString();

    const signingString = buildSigningString(
        signingRequest, 
        [
            ...headerNames, 
            ...(includeCreated ? ["(created)"] : [])
        ], 
        includeCreated ? created : null
    );
    if (!signingString) return null;

    try {
        // 私钥通常是 PKCS8 格式，导入为 RSA-SHA256 签名密钥
        const key = await crypto.subtle.importKey(
            "pkcs8",
            pemToArrayBuffer(privateKeyPem),
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"]
        );

        // 对签名串做 RSA-SHA256 签名，得到二进制签名结果
        const sig = await crypto.subtle.sign(
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            key,
            new TextEncoder().encode(signingString)
        );

        // 组装 Signature header：keyId、算法、时间戳、参与的 header 列表、Base64 签名值
        return `keyId="${keyId}",algorithm="rsa-sha256",created="${created}",headers="${headerNames.join(" ")}",signature="${toBase64(new Uint8Array(sig))}"`;
    } catch {
        return null;
    }
}

