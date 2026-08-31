export interface AuthResponse {
    username: string;
    token: string;
}

async function requestAuth(
    path: string,
    body: { username: string; password: string }
): Promise<AuthResponse> {
    const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => null)) as
        | (AuthResponse & { error?: string })
        | null;

    if (!res.ok || !data?.token) {
        throw new Error(data?.error ?? "请求失败，请稍后重试");
    }

    return { username: data.username, token: data.token };
}

/**
 * 登录
 */
export function login(username: string, password: string): Promise<AuthResponse> {
    return requestAuth("/api/v1/auth/login", {
        username: username.trim(),
        password,
    });
}

/**
 * 注册
 */
export function register(username: string, password: string): Promise<AuthResponse> {
    return requestAuth("/api/v1/auth/register", {
        username: username.trim(),
        password,
    });
}

/**
 * 用 token 换取当前用户名，token 无效时返回 null
 */
export async function me(token: string): Promise<string | null> {
    const res = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as {
        username?: string;
    } | null;

    return data?.username ?? null;
}
