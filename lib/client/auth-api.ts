const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

export interface AuthResponse {
    username: string;
    token: string;
}

/**
 * 登录 —— 后端占位实现。
 *
 * TODO: 后端就绪后请替换为真实请求，例如：
 *   const res = await fetch("/api/auth/login", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ username, password }),
 *   });
 *   const data = await res.json();
 *   return { username: data.username, token: data.token };
 */
export async function login(username: string, _password: string): Promise<AuthResponse> {
    await delay();
    return { username: username.trim(), token: `token-${Date.now()}` };
}

/**
 * 注册 —— 后端占位实现。
 *
 * TODO: 后端就绪后请替换为真实请求：
 *   const res = await fetch("/api/auth/register", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ username, password }),
 *   });
 *   const data = await res.json();
 *   return { username: data.username, token: data.token };
 */
export async function register(username: string, _password: string): Promise<AuthResponse> {
    await delay();
    return { username: username.trim(), token: `token-${Date.now()}` };
}
