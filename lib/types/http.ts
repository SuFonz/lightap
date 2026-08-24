export interface JwtPayload {
    [key: string]: unknown;
    sub?: string;
    iss?: string;
    aud?: string;
    iat?: number;
    exp?: number;
    nbf?: number;
    jti?: string;
}

export interface UserJwtPayload extends JwtPayload {
    username: string,
}