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
    "@context": "https://www.w3.org/ns/activitystreams",
    type: string,
    id: string,
    name: string,
}

export interface APActor extends APObject {
    type: "Person",
    preferredUsername: string,
    summary: string | null,
    inbox: string,
    outbox: string,
    followers: string,
    following: string,
}

export interface APActivity extends APObject {
    type: string | "Activity",
    summary: string,
    actor: {
        type: "Persion",
        name: string,
    },
    object: {
        type: "Note",
        name: string,
    }
}

export interface APCollection extends APObject {
    type: "Collection",
    totalItems: number,
    items: {
        type: "Note",
        name: string,
    }[],
}

export interface APOrderedCollection extends APObject {
    type: "OrderedCollection",
    totalItems: number,
    orderedItems: {
        type: "Note",
        name: string,
    }[],
}
