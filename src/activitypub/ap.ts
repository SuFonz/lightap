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
                             "Undo";

export type APObjectType = "Note" |
                            APActivityType

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

// Resources Types

export interface APNote extends APObject {
    type: "Note",
    name: string,
    content: string,
    inReplyTo?: string,
    /** 原始发布时间（ISO 8601），用于保留远端帖子的真实时间 */
    published?: string,
}

export interface APPerson extends APObject {
    type: "Person",
    name: string,
}

export interface APDelivery extends APObject {
    
}
