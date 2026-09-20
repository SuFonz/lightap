/** 生成一个本地唯一 id（后端返回的帖子 id 缺失时用于本地时间线）。 */
export function createId(prefix = "local"): string {
    const random =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
    return `${prefix}-${random}`;
}
