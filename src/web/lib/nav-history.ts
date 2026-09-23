/**
 * 记录「刚进入应用时」的浏览器历史长度作为基线。
 *
 * 之后只要 `history.length > 基线`，就说明用户在应用内发生过路由跳转，
 * 这时 `router.back()` 才有意义；否则（直接输网址 / 新标签空白页进入）应回首页。
 *
 * 注意：不能用 `document.referrer`——SPA 内部跳转不会更新 referrer。
 * 用基线还能自动处理「返回后 history.length 变小」的情况。
 */

let baselineLength: number | null = null;

/** 应用启动时调用一次，记下初始历史长度 */
export function initHistoryBaseline(): void {
    if (baselineLength === null && typeof window !== "undefined") {
        baselineLength = window.history.length;
    }
}

/** 应用内是否已经发生过路由跳转（首屏直接进入时为 false） */
export function hasInAppHistory(): boolean {
    if (baselineLength === null || typeof window === "undefined") return false;
    return window.history.length > baselineLength;
}
