type ClassValue = string | number | false | null | undefined | ClassValue[];

/** 拼接 className，自动忽略 falsy 值（类似 clsx 的极简实现） */
export function cn(...values: ClassValue[]): string {
    const classes: string[] = [];

    for (const value of values) {
        if (!value) continue;
        if (Array.isArray(value)) {
            const nested = cn(...value);
            if (nested) classes.push(nested);
        } else {
            classes.push(String(value));
        }
    }

    return classes.join(" ");
}
