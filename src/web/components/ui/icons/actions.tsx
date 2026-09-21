import { Icon, type IconProps } from "./base";

export function EditIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
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

export function ImageIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
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

export function WarnIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <line x1="12" x2="12.01" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
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
