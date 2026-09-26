/** 后端请求底座：统一拼 JSON、把错误响应转成 ApiError。登录态走 HttpOnly cookie（同源自动携带）。 */

export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

interface RequestOptions {
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers();
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(path, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const body = data as { error?: string } | null;
        throw new ApiError(body?.error ?? `请求失败（${response.status}）`, response.status);
    }

    return data as T;
}
