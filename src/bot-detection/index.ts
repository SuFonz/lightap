import { env } from "cloudflare:workers";

/**
 * Cloudflare Turnstile 机器人检测封装。
 *
 * 设计原则：**可选**。
 * 只有环境变量里配置了 Turnstile 的密钥才会启用校验；
 * 没配置时整个功能静默关闭，注册流程与以前完全一致。
 *
 * 需要的两个变量：
 * - 后端（secret，不要暴露给前端）：`TURNSTILE_SECRET_KEY`
 * - 前端（公开）：`TURNSTILE_SITE_KEY`
 *
 * 两者独立判断：只配了 secret 就只做后端校验（前端不显示 widget，
 * 此时 token 为空会被拒绝，所以实际部署时两个都配才可用）；
 * 只配了 site_key 则前端会渲染 widget，但后端不校验（形同摆设）。
 * 因此文档里建议两个一起配。
 */

/** Turnstile 的 siteverify 端点（官方固定地址） */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * 读取项目自定义的可选环境变量。
 *
 * `env` 的静态类型来自 wrangler 自动生成的 `Cloudflare.Env`，只含绑定；
 * 通过 secret / vars 配置的普通变量不在里面。这里做一次收窄，
 * 把类型集中在一处，避免每个调用点都写 as。
 */
function botEnv(): { secret?: string; siteKey?: string } {
    const raw = env as unknown as {
        TURNSTILE_SECRET_KEY?: string;
        TURNSTILE_SITE_KEY?: string;
    };
    return {
        secret: raw.TURNSTILE_SECRET_KEY || undefined,
        siteKey: raw.TURNSTILE_SITE_KEY || undefined,
    };
}

/** 前端 widget 的公开配置；未配置时为 null，前端据此决定是否启用 */
export function getBotDetectionConfig(): { siteKey: string } | null {
    const { siteKey } = botEnv();
    if (!siteKey) return null;
    return { siteKey };
}

/** 后端是否启用了校验（以 secret 是否存在为准） */
export function isBotDetectionEnabled(): boolean {
    return Boolean(botEnv().secret);
}

export interface BotCheckResult {
    /** 是否通过。未启用校验时恒为 true */
    ok: boolean;
    /** 失败原因，用于日志；不要直接暴露给用户（避免给攻击者提示） */
    reason?: string;
}

/**
 * 校验前端提交的 Turnstile token。
 *
 * @param token    前端 widget 产出的 `cf-turnstile-response`
 * @param remoteIp 访客 IP（可选，传给 Cloudflare 做风控，能提高准确率）
 *
 * 失败策略分两种，区别很重要：
 * - **token 无效 / 缺失** → 拒绝。这是真正的「检测出机器人」。
 * - **网络或上游故障** → 放行。检测服务挂了不该把正常用户挡在门外。
 *
 * 注意 `res.ok` 只代表 HTTP 成功，`success` 字段才代表验证结果：
 * 用 always-fail 的测试 key 时，Cloudflare 仍返回 HTTP 200，
 * 只是 body 里 `success: false`。所以必须先看 body 再判断。
 */
export async function verifyBotToken(token: string | null | undefined, remoteIp?: string): Promise<BotCheckResult> {
    const { secret } = botEnv();
    // 未配置：功能关闭，一律放行
    if (!secret) return { ok: true };

    if (!token) {
        return { ok: false, reason: "missing-token" };
    }

    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteIp) form.append("remoteip", remoteIp);

    try {
        const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
        if (!res.ok) {
            // HTTP 层失败 = 上游异常，放行
            console.log(`[bot] siteverify http ${res.status}`);
            return { ok: true, reason: `siteverify-http-${res.status}` };
        }

        const data = await res.json<{
            success: boolean;
            "error-codes"?: string[];
            challenge_ts?: string;
            hostname?: string;
        }>();
        console.log(`[bot] siteverify body: ${JSON.stringify(data)}`);

        if (data.success) return { ok: true };

        // 这些 error-code 属于「上游 / 我们自己的配置问题」，不是用户的问题，放行：
        // - internal-error：Cloudflare 侧内部错误
        // - missing-input-secret / invalid-input-secret：我们自己的密钥配错了
        // 其余（invalid-input-response、timeout-or-duplicate 等）判定为未通过。
        const codes = data["error-codes"] ?? [];
        const infraCodes = ["internal-error", "missing-input-secret", "invalid-input-secret"];
        if (codes.some(code => infraCodes.includes(code))) {
            return { ok: true, reason: `siteverify-infra:${codes.join(",")}` };
        }

        return { ok: false, reason: codes.join(",") || "unknown" };
    } catch (error: any) {
        // 网络失败：放行
        return { ok: true, reason: `siteverify-error:${error?.message ?? "unknown"}` };
    }
}
