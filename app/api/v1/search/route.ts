import { fetchActor, fetchWebfinger, getActorUrlFromWebfinger } from "@/lib/activitypub/fetch";
import { htmlToPlainText } from "@/lib/activitypub/tools";
import {
    searchUsersWithCounts,
    upsertRemoteUser,
} from "@/lib/db/users";
import { UserSearchRow } from "@/lib/types/db";

export const dynamic = "force-dynamic";

// @user@domain 或 user@domain（user 部分同本站注册规则）
const REMOTE_ACCOUNT_RE = /^@?([A-Za-z0-9_]+)@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})$/;

const SEARCH_LIMIT = 20;

interface SearchUserDto {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    instance: string | null;
    actorUrl: string | null;
    followers: number;
    following: number;
    postsCount: number;
}

function localRowToDto(row: UserSearchRow): SearchUserDto {
    return {
        username: row.preferred_username,
        displayName: row.name,
        bio: row.summary ?? "",
        avatarUrl: row.icon_url,
        instance: null,
        actorUrl: null,
        followers: row.followers_count,
        following: row.following_count,
        postsCount: row.posts_count,
    };
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    if (!q) {
        return Response.json({ users: [] });
    }

    const localQuery = q.replace(/^@+/, "");
    const remoteMatch = q.match(REMOTE_ACCOUNT_RE);
    const isRemote =
        remoteMatch !== null &&
        remoteMatch[2].toLowerCase() !== url.host.toLowerCase();

    const results: SearchUserDto[] = [];

    if (isRemote && remoteMatch) {
        const [, username, host] = remoteMatch;

        try {
            const webfinger = await fetchWebfinger(username, host);
            const actorUrl = await getActorUrlFromWebfinger(webfinger);

            if (actorUrl) {
                const actor = await fetchActor(actorUrl);

                const dto: SearchUserDto = {
                    username: actor.preferredUsername || username,
                    displayName: actor.name || username,
                    bio: htmlToPlainText(actor.summary ?? ""),
                    avatarUrl: actor.icon?.url ?? null,
                    instance: host,
                    actorUrl,
                    followers: 0,
                    following: 0,
                    postsCount: 0,
                };
                results.push(dto);

                // 落库远端用户，资料页与后续交互可直接使用
                try {
                    // 暂时不放入数据库
                    // await upsertRemoteUser({
                    //     id: actorUrl,
                    //     username: dto.username,
                    //     displayName: dto.displayName,
                    //     summary: dto.bio || null,
                    //     iconUrl: dto.avatarUrl,
                    //     publicKeyPem: actor.publicKey?.publicKeyPem ?? "",
                    // });
                } catch (e) {
                    console.error("upsert remote user failed:", e);
                }
            }
        } catch {
            // WebFinger / Actor 解析失败：仅返回本地结果
        }
    }

    try {
        const locals = await searchUsersWithCounts(localQuery, SEARCH_LIMIT);
        for (const row of locals) {
            results.push(localRowToDto(row));
        }
    } catch (e) {
        console.error("local search failed:", e);
    }

    return Response.json({ users: results });
}
