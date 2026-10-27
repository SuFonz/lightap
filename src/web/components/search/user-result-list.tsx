"use client";

import Link from "next/link";
import { Avatar } from "@/web/components/ui/avatar";
import { FollowButton } from "@/web/components/user/follow-button";
import { useI18n } from "@/web/lib/i18n";
import { profileHref, userKey } from "@/web/lib/user";
import type { User } from "@/web/types";

export function UserResultList({ users }: { users: User[] }) {
    const { t } = useI18n();

    return (
        <ul className="row-quiet rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label={t("search.results")}>
            {users.map((user) => (
                <li
                    key={userKey(user)}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-overlay-weak sm:px-5"
                >
                    <Link href={profileHref(user)} aria-label={user.displayName}>
                        <Avatar name={user.displayName} src={user.avatarUrl} size={44} />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <Link
                            href={profileHref(user)}
                            className="block truncate font-display text-[15px] font-extrabold text-fg transition-colors hover:text-brand-deep"
                        >
                            {user.displayName}
                        </Link>
                        <p className="truncate text-xs text-fg-mute">
                            @{user.username}@{user.instance}
                        </p>
                        {user.bio && <p className="mt-0.5 truncate text-xs text-fg-weak">{user.bio}</p>}
                    </div>
                    <FollowButton user={user} />
                </li>
            ))}
        </ul>
    );
}
