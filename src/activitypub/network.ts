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

/**
 * 按 uri 取任意 ActivityPub 文档（Note / Actor / Collection 等）。
 *
 * 这是「取一个 AP 文档」的通用入口：传私钥就签名请求，不传就匿名请求。
 *
 * 为什么需要它：`getActor` 只是本函数的一个特例（取 Actor），
 * 但取 Note 时若也叫 `getActor` 会让人误解（读代码的人会以为在拉 Actor 文档）。
 * 联邦场景里「按 uri 抓对象」非常常见，值得单独有个名字。
 */
export async function getApObject(
    uri: string,
    privateKey?: string,
    keyId?: string,
): Promise<Response> {
    // 不签名请求
    if (!privateKey || !keyId) {
        return await apFetch(uri);
    }

    // 签名请求：部分实例（Mastodon 默认开启 AUTHORIZED_FETCH）只对已签名请求返回内容
    return await apTrySignedFetch(uri, { privateKey, keyId });
}

/** 取远程 Actor 文档（`getApObject` 的特例，语义更明确） */
export async function getActor(actorUrl: string, privateKey?: string, keyId?: string) {
    return getApObject(actorUrl, privateKey, keyId);
}

export async function postInbox(inboxUrl: string, privateKey: string, keyId: string, activity: APActivity) {
    return await apTrySignedFetch(inboxUrl, {
        privateKey, keyId,
    }, {
        method: "POST",
        body: JSON.stringify(activity),
    });
}

export async function delivery(targetActor: string, activity: APActivity, privateKey: string, keyId: string) {
    // 获取远程 Actor
    const rmRes = await getActor(targetActor, privateKey, keyId);
    if (!rmRes.ok) {
        return rmRes;
    }
    const actor = await rmRes.json<APActor>();

    // 投递到 Actor 的 inbox
    return await postInbox(actor.inbox, privateKey, keyId, activity);
}
