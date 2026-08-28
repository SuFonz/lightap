import { APActivity, APActor, APNote, APWebfinger } from "../types/activitypub";
import { buildAcceptFollow } from "./tools";
import { SignResult, SignResultRFC9421, SigningRequest, createDigest, signRequest } from "../util/signature";
import { getUserById } from "../db/users";

export async function APRequest(
    url: string,
    method: "GET" | "POST" = "GET",
    data?: object
): Promise<Response> {
    
    return await fetch(url, {
        method,
        headers: {
            "Accept": "application/activity+json",
            "Content-Type": "application/activity+json",
        },
        body: data ? JSON.stringify(data) : undefined,
    });
}

export async function APSignedPost(
    url: string,
    data: object,
    privateKeyPem: string,
    keyId: string,
): Promise<Response> {
    const method = "POST";
    const body = JSON.stringify(data);
    const digest = await createDigest(body);

    const parsedUrl = new URL(url);
    const headers = new Headers({
        "Accept": "application/activity+json",
        "Content-Type": "application/activity+json",
        "Digest": digest,
        "Host": parsedUrl.host,
        "Date": new Date().toUTCString(),
    });

    const signingRequest: SigningRequest = {
        method,
        url: `${parsedUrl.pathname}${parsedUrl.search}`,
        getHeader: (name) => headers.get(name) ?? null,
    };

    const signResult = await signRequest(privateKeyPem, keyId, signingRequest) as SignResult;
    headers.set("Signature", signResult.Signature);

    const res = await fetch(url, {
        method,
        headers,
        body,
    });

    return res;
}

/** RFC 9421 */
export async function APSignedPostV2(
    url: string,
    data: object,
    privateKeyPem: string,
    keyId: string,
): Promise<Response> {
    const method = "POST";
    const body = JSON.stringify(data);
    const digest = await createDigest(body);

    const parsedUrl = new URL(url);
    const headers = new Headers({
        "Accept": "application/activity+json",
        "Content-Type": "application/activity+json",
        "Content-Digest": digest,
        "Host": parsedUrl.host,
        "Date": new Date().toUTCString(),
    });

    const signingRequest: SigningRequest = {
        method,
        url: `${parsedUrl.pathname}${parsedUrl.search}`,
        getHeader: (name) => headers.get(name) ?? null,
    };

    const signResult = await signRequest(privateKeyPem, keyId, signingRequest, "rfc9421") as SignResultRFC9421;
    for (const [key, value] of Object.entries(signResult)) {
        headers.set(key, value);
    }

    const res = await fetch(url, {
        method,
        headers,
        body,
    });

    return res;
}

export async function fetchWebfinger(
    username: string,
    host: string
): Promise<APWebfinger> {

    const resource = encodeURIComponent(
        `acct:${username}@${host}`
    );

    const paths = [
        `https://${host}/.well-known/webfinger?resource=${resource}`,
        `http://${host}/.well-known/webfinger?resource=${resource}`,
    ];

    for (const url of paths) {
        try {
            const res = await APRequest(url);

            if (res.ok) {
                return await res.json<APWebfinger>();
            }
        } catch {
            // HTTPS 失败，继续尝试 HTTP
        }
    }

    throw new Error("WebFinger lookup failed");
}

export async function fetchActor(actor: string): Promise<APActor> {
    const res = await APRequest(actor);
    const data = await res.json<APActor>();
    return data;
}

export async function getActorUrlFromWebfinger(webfinger: APWebfinger): Promise<string> {
    const link = webfinger.links.find(l => l.rel === "self" && l.type === "application/activity+json");
    return link?.href ?? "";
}

export async function postActivity(selfActor: string, targetActor: string, activity: APActivity): Promise<boolean> {
    try {
        const tActor = await fetchActor(targetActor);
        const user = await getUserById(selfActor);
        const fRes = await APSignedPostV2(tActor.inbox, activity, user?.private_key_pem ?? "", `${selfActor}#main-key`);
        
        /** RFC 9421 */
        if (fRes.ok) {
            return true;
        } else {
            /** Old version */
            const sRes = await APSignedPost(tActor.inbox, activity, user?.private_key_pem ?? "", `${selfActor}#main-key`);
            if (sRes.ok) {
                return true;
            }
        }
    } catch (e: any) {}

    return false;
}

