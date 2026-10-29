import { getBotDetectionConfig, isBotDetectionEnabled } from "@/src/bot-detection";

export const dynamic = "force-dynamic";

/**
 * 公开配置：GET /api/v1/config
 *
 * 前端启动时拉一次，据此决定是否启用机器人验证。
 * 只下发**公开**信息（site key 本来就写在页面里），
 * 绝不返回 secret。
 */
export async function GET() {
    const bot = getBotDetectionConfig();
    return Response.json({
        // 前端只有同时拿到 siteKey 才渲染 widget
        botDetection: bot
            ? {
                  siteKey: bot.siteKey,
                  // 后端是否真的会校验（只配了 site_key 时后端不校验，前端可据此提示）
                  enforced: isBotDetectionEnabled(),
              }
            : null,
    }, {
        status: 200,
        headers: {
            // 配置很少变，但也不能长缓存：改环境变量后要尽快生效
            "Cache-Control": "public, max-age=60",
        },
    });
}
