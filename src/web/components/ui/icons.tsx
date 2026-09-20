import type { ReactNode, SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number;
}

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...rest}
        >
            {children}
        </svg>
    );
}

export function HomeIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </Icon>
    );
}

export function SearchIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </Icon>
    );
}

export function BellIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </Icon>
    );
}

export function UserIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </Icon>
    );
}

export function UsersIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Icon>
    );
}

export function UserPlusIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
        </Icon>
    );
}

export function EditIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </Icon>
    );
}

export function FeatherIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M12.67 19a2 2 0 0 0 1.42-.59l6.15-6.17a6 6 0 0 0-8.49-8.49L5.59 9.91A2 2 0 0 0 5 11.33V18a1 1 0 0 0 1 1z" />
            <path d="M16 8 2 22" />
            <path d="M17.5 15H9" />
        </Icon>
    );
}

export function HeartIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
        </Icon>
    );
}

export function BoostIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </Icon>
    );
}

export function ReplyIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </Icon>
    );
}

export function ShareIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" x2="12" y1="2" y2="15" />
        </Icon>
    );
}

export function BookmarkIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </Icon>
    );
}

export function HashIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <line x1="4" x2="20" y1="9" y2="9" />
            <line x1="4" x2="20" y1="15" y2="15" />
            <line x1="10" x2="8" y1="3" y2="21" />
            <line x1="16" x2="14" y1="3" y2="21" />
        </Icon>
    );
}

export function CloseIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </Icon>
    );
}

export function HistoryIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M3 3v5h5" />
            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
            <path d="M12 7v5l4 2" />
        </Icon>
    );
}

export function LockIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </Icon>
    );
}

export function MenuIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </Icon>
    );
}

export function MoreIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
        </Icon>
    );
}

export function SlidersIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <line x1="21" x2="14" y1="4" y2="4" />
            <line x1="10" x2="3" y1="4" y2="4" />
            <line x1="21" x2="12" y1="12" y2="12" />
            <line x1="8" x2="3" y1="12" y2="12" />
            <line x1="21" x2="16" y1="20" y2="20" />
            <line x1="12" x2="3" y1="20" y2="20" />
            <line x1="14" x2="14" y1="2" y2="6" />
            <line x1="8" x2="8" y1="10" y2="14" />
            <line x1="16" x2="16" y1="18" y2="22" />
        </Icon>
    );
}

export function GearIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </Icon>
    );
}

export function ImageIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
        </Icon>
    );
}

export function SparklesIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </Icon>
    );
}

export function SendIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </Icon>
    );
}

export function AtIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="4" />
            <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
        </Icon>
    );
}

export function CheckIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M20 6 9 17l-5-5" />
        </Icon>
    );
}

export function TrendingUpIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
        </Icon>
    );
}

export function GlobeIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
        </Icon>
    );
}

export function EmojiIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" x2="9.01" y1="9" y2="9" />
            <line x1="15" x2="15.01" y1="9" y2="9" />
        </Icon>
    );
}

export function PollIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <line x1="18" x2="18" y1="20" y2="10" />
            <line x1="12" x2="12" y1="20" y2="4" />
            <line x1="6" x2="6" y1="20" y2="14" />
            <line x1="3" x2="21" y1="20" y2="20" />
        </Icon>
    );
}

export function WarnIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <line x1="12" x2="12.01" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
        </Icon>
    );
}
