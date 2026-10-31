import handler from "vinext/server/fetch-handler";
import { consume, DeliveryError, type QueueData } from "@/src/queue";
export { SSEDurableObject } from "@/src/realtime/sse";

/**
 * 投递失败最多重试几次（不含首次投递）。
 *
 * 5 次重试 + 1 次首投 = 一条消息最多尝试 6 次。
 * 配合下面的退避，总跨度约 1 + 2 + 4 + 8 + 16 = 31 分钟后放弃，
 * 足够覆盖对方实例的短时重启 / 限流窗口，又不至于把队列堵太久。
 */
const MAX_RETRIES = 5;

/**
 * 退避基数（秒）。
 *
 * 第 n 次重试等待 BASE * 2^(n-1) 秒：1、2、4、8、16。
 * 为什么用指数退避而不是固定间隔：对方 5xx 时通常是过载或重启，
 * 密集重试只会加重它的负担；拉开间隔后大多数临时故障在下一次就恢复了。
 */
const BASE_DELAY_SECONDS = 1;

/** 单次重试的最大等待时间，防止指数增长到离谱的值 */
const MAX_DELAY_SECONDS = 60;

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return handler.fetch(request, env, ctx);
    },

    /**
     * 队列消费：投递失败按指数退避重试，最多 5 次。
     *
     * 重试计数用 Cloudflare 自带的 `message.attempts`（从 1 开始），
     * 不需要自己在消息体里存计数器 —— 那样还得担心消息体被改写后的一致性问题。
     */
    async queue(batch: MessageBatch<QueueData>): Promise<void> {
        for (const message of batch.messages) {
            try {
                await consume(message.body);
                message.ack();
            } catch (error: any) {
                const message_ = error?.message ?? String(error);

                // 确定性失败（4xx 且非 408/429）：重试没有意义，直接丢弃
                const retryable = error instanceof DeliveryError ? error.retryable : true;

                // attempts 是「已尝试次数」（含本次），所以首次失败时它是 1。
                // 已经用掉 MAX_RETRIES 次重试后就不再排下一次。
                const canRetry = retryable && message.attempts <= MAX_RETRIES;

                if (!canRetry) {
                    console.log(
                        `[queue] 放弃投递（attempts=${message.attempts}，retryable=${retryable}）: ${message_}`,
                    );
                    message.ack();
                    continue;
                }

                const delaySeconds = Math.min(
                    MAX_DELAY_SECONDS,
                    BASE_DELAY_SECONDS * 2 ** (message.attempts - 1),
                );
                console.log(
                    `[queue] 投递失败，${delaySeconds}s 后第 ${message.attempts} 次重试: ${message_}`,
                );
                message.retry({ delaySeconds });
            }
        }
    }
};
