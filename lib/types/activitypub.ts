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
    "@context": string | string[],
    type: string,
    id?: string,
    name?: string,
}

export interface APPerson extends APObject {
    type: "Person",
    name: string,
}

export interface APNote extends APObject {
    type: "Note",
    name: string,
    content: string,
}

export interface APActor extends APPerson {
    id: string,
    type: "Person",
    preferredUsername: string,
    summary: string | null,
    inbox: string,
    outbox: string,
    followers: string,
    following: string,
}

export interface APActivity<TObject = APObject> extends APObject {
    type: string | "Activity",
    summary: string,
    actor: APPerson,
    object: TObject,
}

export interface APCollection extends APObject {
    type: "Collection",
    totalItems: number,
    items: APNote[],
}

export interface APOrderedCollection extends APObject {
    type: "OrderedCollection",
    totalItems: number,
    orderedItems: APNote[],
}

export interface APCreate extends APActivity<APNote> {
    type: "Create",
}
