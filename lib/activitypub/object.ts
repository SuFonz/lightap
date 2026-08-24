import { APWebfinger, APActor } from "@/lib/types/activitypub"

export function parseResource(
    resource: string
): [username: string, domain: string] {

    if (!resource.startsWith("acct:")) {
        throw new Error("Invalid resource");
    }

    const acct = resource.slice(5);

    const index = acct.lastIndexOf("@");

    if (index <= 0 || index === acct.length - 1) {
        throw new Error("Invalid acct");
    }

    const username = acct.slice(0, index);
    const domain = acct.slice(index + 1);

    return [username, domain];
}

export function buildWebfinger(
    baseUrl: string,
    username: string,
    domain: string,
): APWebfinger | null {
    if (!username || !domain) {
        return null;
    }

    const webfinger: APWebfinger = {
        subject: `acct:${username}@${domain}`,
        aliases: [
            `${baseUrl}/@${username}`,
            `${baseUrl}/api/users/${username}`,
        ],
        links: [
            {
                rel: "http://webfinger.net/rel/profile-page",
                type: "text/html",
                href: `${baseUrl}/@${username}`
            },
            {
                rel: "self",
                type: "application/activity+json",
                href: `${baseUrl}/api/users/${username}`
            }
        ]
    };

    return webfinger;
}

export function buildActor(
    baseUrl: string,
    name: string,
    preferredUsername: string,
    summary: string | null,
): APActor | null {
    const url = new URL(baseUrl);
    const actor: APActor = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Person",
        id: `${url.origin}/api/users/${preferredUsername}`,
        name: name,
        preferredUsername: preferredUsername,
        summary: summary,
        inbox: `${url.origin}/api/users/${preferredUsername}/inbox`,
        outbox: `${url.origin}/api/users/${preferredUsername}/outbox`,
        followers: `${url.origin}/api/users/${preferredUsername}/followers`,
        following: `${url.origin}/api/users/${preferredUsername}/following`,
    };

    return actor;
}
