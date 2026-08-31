"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import type { User } from "@/lib/client/types";

export function UserResultList({ users }: { users: User[] }) {
    return (
        <ul
            className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden"
            aria-label="用户结果"
        >
            {users.map((user) => (
                <li
                    key={user.username}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/45 sm:px-5"
                >
                    <Link href={`/u/${user.username}`} aria-label={user.displayName}>
                        <Avatar
                            name={user.displayName}
                            src={user.avatarUrl}
                            size={44}
                            status={user.online}
                        />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <Link
                            href={`/u/${user.username}`}
                            className="block truncate font-display text-[15px] font-extrabold text-slate-800 transition-colors hover:text-brand-deep"
                        >
                            {user.displayName}
                        </Link>
                        <p className="truncate text-xs text-slate-400">
                            @{user.username}@{user.instance}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{user.bio}</p>
                    </div>
                    <FollowButton username={user.username} />
                </li>
            ))}
        </ul>
    );
}
