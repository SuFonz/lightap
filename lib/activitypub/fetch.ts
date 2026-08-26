import { APActivity, APActor, APNote, APWebfinger } from "../types/activitypub";
import { buildAcceptFollow } from "./tools";
import { SigningRequest, createDigest, signHttpSignature } from "../util/signature";
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

export async function APSignedRequest(
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
        pathname: `${parsedUrl.pathname}${parsedUrl.search}`,
        getHeader: (name) => headers.get(name) ?? null,
    };

    const signature = await signHttpSignature(privateKeyPem, keyId, signingRequest);
    if (signature) {
        headers.set("Signature", signature);
    }

    const res = await fetch(url, {
        method,
        headers,
        body,
    });

    console.log(res);
    console.log(res.body);

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

export async function postActivity(selfActor: string, targetActor: string, activity: APActivity) {
    const tActor = await fetchActor(targetActor);
    const user = await getUserById(selfActor);
    const res = await APSignedRequest(tActor.inbox, activity, user?.private_key_pem ?? "", `${selfActor}#main-key`);
}

