/** 纯展示用的格式化工具，不依赖任何状态。 */

/** 把较大的数字压缩成 1.2k / 12k 这类展示形式 */
export function formatCount(count: number): string {
    if (count < 1000) return String(count);
    if (count < 10000) {
        const value = (count / 1000).toFixed(1);
        return `${value.endsWith(".0") ? value.slice(0, -2) : value}k`;
    }
    return `${Math.round(count / 1000)}k`;
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期 */
export function timeAgo(iso: string): string {
    const time = new Date(iso).getTime();
    if (Number.isNaN(time)) return "";

    const diff = Date.now() - time;
    if (diff < 60_000) return "刚刚";

    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `${minutes} 分钟前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;

    return new Date(iso).toLocaleDateString("zh-CN");
}
