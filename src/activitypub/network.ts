import { APActivity, APActor, APWebfinger } from "./ap";
import {
    createContentDigest,
    createDigestHeader,
    signActivityPubRequest,
    signRfc9421,
    type SignableBody,
} from "@/src/utils/signature";

async function apFetch(
    url: string,
    options?: RequestInit
): Promise<Response> {
    return fetch(url, {
        ...options,
        headers: {
            "Accept": "application/activity+json",
            "Content-Type": "application/activity+json",
            ...options?.headers,
        },
    });
}

async function apSignedFetch(
    url: string,
    config: {
        /** 签名方案，默认 legacy（draft-cavage HTTP Signatures） */
        type?: "legacy" | "rfc-9421";
        /** 签名用私钥，PKCS8 PEM */
        privateKey: string;
        /** 公钥地址，例如 https://example.com/users/alice#main-key */
        keyId: string;
        
    },
    fetchOptions?: RequestInit,
): Promise<Response> {
    const { privateKey, keyId } = config;
    const type = config.type ?? "legacy";
    if (type !== "legacy" && type !== "rfc-9421") {
        throw new Error(`Unsupported signature type: ${String(type)}`);
    }

    // 准备请求头：签名与 fetch 共用同一个 Headers，保证内容一致
    const method = (fetchOptions?.method ?? "GET").toUpperCase();
    const headers = new Headers(fetchOptions?.headers);
    if (!headers.has("accept")) {
        headers.set("accept", "application/activity+json");
    }
    if (!headers.has("date")) {
        headers.set("date", new Date().toUTCString());
    }

    // 只有能直接读取、且不会被 fetch 消费的 body 才计算摘要
    const rawBody = fetchOptions?.body;
    const body: SignableBody | undefined =
        typeof rawBody === "string" ||
        rawBody instanceof ArrayBuffer ||
        rawBody instanceof Uint8Array ||
        (typeof Blob !== "undefined" && rawBody instanceof Blob)
            ? rawBody
            : undefined;

    if (type === "rfc-9421") {
        // RFC 9421：Content-Digest + Signature-Input + Signature
        if (body !== undefined && !headers.has("content-digest")) {
            headers.set("content-digest", await createContentDigest(body));
        }

        const { signatureInput, signature } = await signRfc9421({
            method,
            url,
            headers,
            privateKey,
            keyId,
        });
        headers.set("signature-input", signatureInput);
        headers.set("signature", signature);
    } else {
        // draft-cavage（默认）：Digest + Signature
        if (body !== undefined && !headers.has("digest")) {
            headers.set("digest", await createDigestHeader(body));
        }

        const { signature } = await signActivityPubRequest({
            method,
            url,
            headers,
            privateKey,
            keyId,
        });
        headers.set("signature", signature);
    }

    // 注意：apFetch 内部用 `{ ...options.headers }` 展开，Headers 实例展开后为空，
    // 所以这里转成普通对象再传，保证签名头不会丢。
    return apFetch(url, {
        ...fetchOptions,
        method,
        headers: Object.fromEntries(headers.entries()),
    });
}

export async function apTrySignedFetch(
    url: string,
    options: {
        privateKey: string;
        keyId: string;
    },
    fetchOptions?: RequestInit
) {
    const privateKey = options.privateKey;
    const keyId = options.keyId;

    // 先是 RFC 9421，如果失败就换传统的
    const rfc = await apSignedFetch(url, {
        type: "rfc-9421",
        privateKey,
        keyId,
    }, fetchOptions);

    if (!rfc.ok) {
        const legacy = await apSignedFetch(url, {
            type: "legacy",
            privateKey,
            keyId,
        }, fetchOptions);

        return legacy;
    }

    return rfc;
}

export async function getWebfinger(username: string, domain: string) {
    // return await apFetch(`https://${domain}/.well-knwon/webfinger?resource=acct:${username}@${domain}`);

    const resource = encodeURIComponent(
        `acct:${username}@${domain}`
    );

    const paths = [
        `https://${domain}/.well-known/webfinger?resource=${resource}`,
        `http://${domain}/.well-known/webfinger?resource=${resource}`,
    ];

    for (const url of paths) {
        try {
            const res = await apFetch(url);

            if (res.ok) {
                return res;
            }
        } catch {
            // HTTPS 失败，继续尝试 HTTP
        }
    }

    return new Response(
        JSON.stringify({
            error: "WebFinger not found"
        }),
        {
            status: 404,
            headers: {
                "Content-Type": "application/json"
            }
        }
    );
}

export async function getActor(actorUrl: string, privateKey?: string, keyId?: string) {
    // 不签名请求
    if (!privateKey || !keyId) {
        return await apFetch(actorUrl);
    }

    // 签名请求
    return await apTrySignedFetch(actorUrl, { privateKey, keyId });
}

export async function postInbox(inboxUrl: string, privateKey: string, keyId: string, activity: APActivity) {
    return await apTrySignedFetch(inboxUrl, {
        privateKey, keyId,
    }, {
        method: "POST",
        body: JSON.stringify(activity),
    });
}
