import { AP_CONTEXT, APActivity, APActivityType, APActor, APNote, APObject, APObjectType, APWebfinger } from "./ap";

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

export function parseSearch(
    content: string
): [string, string?] {
    const value = content.trim();

    if (!value.startsWith("@")) {
        return ["", undefined];
    }

    const account = value.slice(1);

    const index = account.indexOf("@");

    if (index === -1) {
        return [account];
    }

    return [
        account.slice(0, index),
        account.slice(index + 1),
    ];
}

export function parseWebfinger(webfinger: APWebfinger) {
    const link = webfinger.links.find(l => l.rel === "self" && l.type === "application/activity+json")?.href ?? "";
    return {
        actorUrl: link ?? "",
    };
}

export function convertDomainToUrl(domain: string) {
    return `https://${domain}/`;
}

export function convertActorUrlToMainKey(actor: string) {
    return `${actor}#main-key`;
}

export function buildWebfinger(
    url: URL,
    username: string,
): APWebfinger {
    const webfinger: APWebfinger = {
        subject: `acct:${username}@${url.host}`,
        aliases: [
            `${url.origin}/@${username}`,
            `${url.origin}/users/${username}`,
        ],
        links: [
            {
                rel: "http://webfinger.net/rel/profile-page",
                type: "text/html",
                href: `${url.origin}/@${username}`
            },
            {
                rel: "self",
                type: "application/activity+json",
                href: `${url.origin}/users/${username}`
            }
        ]
    };

    return webfinger;
}

export function buildActor(
    url: URL,
    name: string,
    preferredUsername: string,
    summary: string | null,
    publicKeyPem: string | null,
) {
    const actor: APActor = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Person",
        id: `${url.origin}/users/${preferredUsername}`,
        name: name,
        preferredUsername: preferredUsername,
        summary: summary,
        publicKey: {
            id: convertActorUrlToMainKey(`${url.origin}/users/${preferredUsername}`),
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

export function buildObjecrUri(url: URL, uuid: string, type: APActivityType | APObjectType) {
    return `${url.origin}/${type.toLocaleLowerCase()}/${uuid}`;
}

export function buildActivity<TObject extends APObject = APObject>(
    url: URL,
    uuid: string,
    type: APActivityType,
    actor: string,
    object: TObject | string
) {
    const activity: APActivity = {
        "@context": AP_CONTEXT,
        id: buildObjecrUri(url, uuid, type),
        type,
        actor,
        object,
    }

    return activity;
}

export function buildActivityWithUri<TObject extends APObject = APObject>(
    id: string,
    type: APActivityType,
    actor: string,
    object: TObject | string
) {
    const activity: APActivity = {
        "@context": AP_CONTEXT,
        id: id,
        type,
        actor,
        object,
    }

    return activity;
}

export function buildNote(url: URL, uuid: string, content: string, inReplyTo?: string) {
    const note: APNote = {
        "@context": AP_CONTEXT,
        id: `${url.origin}/notes/${uuid}`,
        type: "Note",
        name: "Light AP Note",
        content: content,
        inReplyTo: inReplyTo,
    };

    return note;
}
