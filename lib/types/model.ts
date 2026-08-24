export interface User {
    id: number,
    username: string,
    preferredUsername: string,
    summary?: string,
    iconUrl?: string,
    privateKeyPem?: string,
    publicKeyPem: string,
    createdAt: Date,
    updatedAt: Date,
}
