import { parseResource } from "@/lib/activitypub/tools";

const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    if (!q) {
        return new Response("Not found", {
            status: 404
        });
    }

    const acctStr = q.startsWith("@") ? `acct:${q}` : `acct:@${q}`;
    const [username, host] = parseResource(acctStr);
    
}
