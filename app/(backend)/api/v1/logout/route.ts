import { users } from "@/src/db/schema";
import { signJwt } from "@/src/utils/jwt";
import { verifyPassword } from "@/src/utils/password";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    return Response.json({
        message: "Logged out",
    }, {
        status: 200,
        headers: {
            "Set-Cookie": "token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
            "Content-Type": "application/json",
        },
    });
}
