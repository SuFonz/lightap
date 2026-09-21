import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";


export function getDBClient() {
    return drizzle(env.DB);
}
