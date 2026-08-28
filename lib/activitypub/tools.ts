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
    origin: string,
    username: string,
    domain: string,
): APWebfinger {
    const webfinger: APWebfinger = {
        subject: `acct:${username}@${domain}`,
        aliases: [
            `${origin}/@${username}`,
            `${origin}/users/${username}`,
        ],
        links: [
            {
                rel: "http://webfinger.net/rel/profile-page",
                type: "text/html",
                href: `${origin}/@${username}`
            },
            {
                rel: "self",
                type: "application/activity+json",
                href: `${origin}/users/${username}`
            }
        ]
    };

    return webfinger;
}

export function buildActor(
    origin: string,
    name: string,
    preferredUsername: string,
    summary: string | null,
    publicKeyPem: string | null,
): APActor {
    const url = new URL(origin);
    const actor: APActor = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Person",
        id: `${url.origin}/users/${preferredUsername}`,
        name: name,
        preferredUsername: preferredUsername,
        summary: summary,
        publicKey: {
            id: `${url.origin}/users/${preferredUsername}#main-key`,
            owner: `${url.origin}/users/${preferredUsername}`,
            publicKeyPem: publicKeyPem ?? "",
        },
        inbox: `${url.origin}/users/${preferredUsername}/inbox`,
        outbox: `${url.origin}/users/${preferredUsername}/outbox`,
        followers: `${url.origin}/users/${preferredUsername}/followers`,
        following: `${url.origin}/users/${preferredUsername}/following`,
    };

    return actor;
}

export function buildOrderedCollection(
    origin: string,
    username: string,
    notes: APNote[],
    kind: "outbox" | "inbox" = "outbox",
): APOrderedCollection {
    const url = new URL(origin);
    const oc: APOrderedCollection = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "OrderedCollection",
        id: `${url.origin}/users/${username}/${kind}`,
        summary: `${username}'s ${kind}`,
        totalItems: notes.length,
        orderedItems: notes,
    };

    return oc;
}

export function buildNote(
    origin: string,
    name: string,
    content: string,
): APNote {
    return convertNote(`${origin}/notes/${crypto.randomUUID()}`, name, content);
}

export function buildAcceptFollow(
    origin: string,
    selfActor: string,
    follow: APActivity,
): APAccept {
    const accept: APAccept = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Accept",
        id: `${origin}/activities/${crypto.randomUUID()}`,
        actor: selfActor,
        object: follow,
    };

    return accept;
}
