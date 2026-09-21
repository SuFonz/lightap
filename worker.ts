import handler from "vinext/server/fetch-handler";
import { consume, type QueueData } from "@/src/queue";


export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return handler.fetch(request, env, ctx);
    },


    async queue(batch: MessageBatch<QueueData>): Promise<void> {
        for (const message of batch.messages) {
            try {
                await consume(message.body);
                message.ack();
            } catch (error: any) {
                console.log(error.message);
                message.retry();
            }
        }
    }
};
