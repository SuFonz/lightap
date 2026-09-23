import { AP_CONTEXT, APActivity, APActivityType, APActor, APLike, APNote, APObject, APObjectType, APTombstone, APWebfinger } from "./ap";

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

export function buildWebfinger(options: {
    url: URL,
    username: string,
}): APWebfinger {
    const { url, username } = options;

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

export function buildActor(options: {
    url: URL,
    name: string,
    preferredUsername: string,
    summary: string | null,
    publicKeyPem: string | null,
}) {
    const { url, name, preferredUsername, summary, publicKeyPem } = options;

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

export function buildObjecrUri(options: {
    url: URL,
    uuid: string,
    type: APObjectType,
}) {
    const { url, uuid, type } = options;
    return `${url.origin}/${type.toLocaleLowerCase()}/${uuid}`;
}

export function buildActivity<TObject extends APObject = APObject>(options: {
    url: URL,
    uuid: string,
    type: APActivityType,
    actor: string,
    object: TObject | string,
    to?: string[],
    cc?: string[],
}) {
    const { url, uuid, type, actor, object, to, cc } = options;

    const activity: APActivity = {
        "@context": AP_CONTEXT,
        id: buildObjecrUri({ url, uuid, type }),
        type,
        actor,
        object,
        to: to ?? ["https://www.w3.org/ns/activitystreams#Public"],
        cc: cc ?? []
    }

    return activity;
}

export function buildActivityWithUri<TObject extends APObject = APObject>(options: {
    uri: string,
    type: APActivityType,
    actor: string,
    object: TObject | string,
    to?: string[],
    cc?: string[],
}) {
    const { uri, type, actor, object, to, cc } = options;

    const activity: APActivity = {
        "@context": AP_CONTEXT,
        id: uri,
        type,
        actor,
        object,
        to: to ?? ["https://www.w3.org/ns/activitystreams#Public"],
        cc: cc ?? []
    }

    return activity;
}

export function buildNote(options: {
    url: URL,
    uuid: string,
    content: string,
    inReplyTo?: string,
    to?: string[],
    cc?: string[],
}) {
    const { url, uuid, content, inReplyTo, to, cc } = options;

    const note: APNote = {
        "@context": AP_CONTEXT,
        id: `${url.origin}/notes/${uuid}`,
        type: "Note",
        name: "Light AP Note",
        content: content,
        inReplyTo: inReplyTo,
        to: to ?? ["https://www.w3.org/ns/activitystreams#Public"],
        cc: cc ?? []
    };

    return note;
}

export function buildNoteWithUri(options: {
    uri: string,
    content: string,
    inReplyTo?: string,
    to?: string[],
    cc?: string[],
}) {
    const { uri, content, inReplyTo, to, cc } = options;

    const note: APNote = {
        "@context": AP_CONTEXT,
        id: uri,
        type: "Note",
        name: "Light AP Note",
        content: content,
        inReplyTo: inReplyTo,
        to: to ?? ["https://www.w3.org/ns/activitystreams#Public"],
        cc: cc ?? []
    };

    return note;
}

export function buildLike(options: {
    url: URL,
    uuid: string,
    actor: string,
    object: string,
    to?: string[],
    cc?: string[],
}) {
    const { url, uuid, actor, object, to, cc } = options;

    const like: APLike = {
        "@context": AP_CONTEXT,
        id: buildObjecrUri({ url, uuid, type: "Like" }),
        type: "Like",
        actor,
        object,
        to: to ?? ["https://www.w3.org/ns/activitystreams#Public"],
        cc: cc ?? []
    };

    return like;
}

export function buildTombstone(options: {
    id: string,
    /** 被删除对象的原类型，例如 "Note" */
    formerType?: string,
    /** 删除时间（ISO 8601） */
    deleted?: string,
}) {
    const { id, formerType, deleted } = options;

    const tombstone: APTombstone = {
        "@context": AP_CONTEXT,
        id,
        type: "Tombstone",
        formerType,
        deleted,
    };

    return tombstone;
}

export function buildLikeWithUri(options: {
    uri: string,
    actor: string,
    object: string,
    to?: string[],
    cc?: string[],
}) {
    const { uri, actor, object, to, cc } = options;

    const like: APLike = {
        "@context": AP_CONTEXT,
        id: uri,
        type: "Like",
        actor,
        object,
        to: to ?? ["https://www.w3.org/ns/activitystreams#Public"],
        cc: cc ?? []
    };

    return like;
}
