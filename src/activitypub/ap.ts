export const AP_CONTEXT = "https://www.w3.org/ns/activitystreams";
export const AP_CONTEXT_PUBLIC = `${AP_CONTEXT}#Public`;
export const AP_SECURITY_CONTEXT = "https://w3id.org/security/v1";

export type APActivityType = "Activity" |
                             "Create" | 
                             "Delete" | 
                             "Like" | 
                             "Dislike" | 
                             "Accept" | 
                             "Reject" | 
                             "Follow" | 
                             "Announce" |
                             "Undo";

export type APObjectType = "Note" |
                            "Tombstone" |
                            APActivityType

export type APDocumentType = "Document" |
                                "Audio" |
                                "Video" |
                                "Image";

// Core Types

export interface APWebfinger {
    subject: string,
    aliases?: string[],
    links: {
        rel: string,
        type: string,
        href: string,
    }[],
}

export interface APObject {
    "@context"?: string | string[],
    type: string,
    id: string,
    name?: string,
    to?: string[],
    bto?: string[],
    cc?: string[],
    bcc?: string[],
}

export interface APCollection extends APObject {
    type: "Collection",
    totalItems: number,
    items: APNote[],
}

export interface APOrderedCollection extends APObject {
    type: "OrderedCollection",
    summary: string,
    totalItems: number,
    orderedItems: APNote[],
}

export interface APActor extends APObject {
    type: "Person",
    name: string,
    preferredUsername: string,
    summary: string | null,
    url?: string,
    icon?: {
        type?: string,
        url?: string,
    },
    publicKey: {
        id: string,
        owner: string,
        publicKeyPem: string,
    },
    inbox: string,
    outbox: string,
    followers: string,
    following: string,
}

// Activity Types

export interface APActivity<TObject extends APObject = APObject> extends APObject {
    type: APActivityType | "Activity",
    summary?: string,
    actor: string,
    object: TObject | string,
}

export interface APAccept extends APActivity {
    type: "Accept",
}

export interface APLike extends APActivity {
    type: "Like",
}

/**
 * Announce：转发（Mastodon 里叫 boost，Misskey 里叫 renote）。
 *
 * `object` 是**被转发的帖子地址**（字符串），而不是内嵌对象——
 * 这样接收方可以直接引用原帖，也避免重复传输整条内容。
 */
export interface APAnnounce extends APActivity {
    type: "Announce",
}

// Resources Types

export interface APDocument extends APObject {
    type: APDocumentType,
    name: string,
    url: string,
}

export interface APAudio extends APDocument {
    type: "Audio",
}

export interface APImage extends APDocument {
    type: "Image",
}

export interface APVideo extends APDocument {
    type: "Video",
}

export interface APNote extends APObject {
    type: "Note",
    name: string,
    content: string,
    inReplyTo?: string,
    attachment: APDocument[],
    /** 原始发布时间（ISO 8601），用于保留远端帖子的真实时间 */
    published?: string,
}

export interface APPerson extends APObject {
    type: "Person",
    name: string,
}

/** 被删除对象的占位（Delete 活动的 object） */
export interface APTombstone extends APObject {
    type: "Tombstone",
    /** 被删除对象的原类型，例如 "Note" */
    formerType?: string,
    /** 删除时间（ISO 8601） */
    deleted?: string,
}
