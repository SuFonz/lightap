import { APWebfinger, APActor, APNote, APOrderedCollection, APActivity, APPerson, APObject, APAccept } from "@/lib/types/activitypub"

export function parseResource(
    resource: string
): [username: string, host: string] {

    if (!resource.startsWith("acct:")) {
        throw new Error("Invalid resource");
    }

    const acct = resource.slice(5);

    const index = acct.lastIndexOf("@");

    if (index <= 0 || index === acct.length - 1) {
        throw new Error("Invalid acct");
    }

    const username = acct.slice(0, index);
    const host = acct.slice(index + 1);

    return [username, host];
}

export function convertNote(
    id: string,
    name: string,
    content: string,
): APNote {
    const note: APNote = {
        id: id,
        type: "Note",
        name: name,
        content: content,
    };

    return note;
}

export function buildWebfinger(
    baseUrl: string,
    username: string,
    domain: string,
): APWebfinger {
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
    publicKeyPem: string | null,
): APActor {
    const url = new URL(baseUrl);
    const actor: APActor = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Person",
        id: `${url.origin}/api/users/${preferredUsername}`,
        name: name,
        preferredUsername: preferredUsername,
        summary: summary,
        publicKey: {
            id: `${url.origin}/api/users/${preferredUsername}#main-key`,
            owner: `${url.origin}/api/users/${preferredUsername}`,
            publicKeyPem: publicKeyPem ?? "",
        },
        inbox: `${url.origin}/api/users/${preferredUsername}/inbox`,
        outbox: `${url.origin}/api/users/${preferredUsername}/outbox`,
        followers: `${url.origin}/api/users/${preferredUsername}/followers`,
        following: `${url.origin}/api/users/${preferredUsername}/following`,
    };

    return actor;
}

export function buildOrderedCollection(
    baseUrl: string,
    username: string,
    notes: APNote[],
    kind: "outbox" | "inbox" = "outbox",
): APOrderedCollection {
    const url = new URL(baseUrl);
    const oc: APOrderedCollection = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "OrderedCollection",
        id: `${url.origin}/api/users/${username}/${kind}`,
        summary: `${username}'s ${kind}`,
        totalItems: notes.length,
        orderedItems: notes,
    };

    return oc;
}

export function buildNote(
    baseUrl: string,
    name: string,
    content: string,
): APNote {
    return convertNote(`${baseUrl}/notes/${crypto.randomUUID()}`, name, content);
}

export function buildAcceptFollow(
    baseUrl: string,
    selfActor: string,
    follow: APActivity,
): APAccept {
    const accept: APAccept = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Accept",
        id: `${baseUrl}/activities/${crypto.randomUUID()}`,
        actor: selfActor,
        object: follow,
    };

    return accept;
}
