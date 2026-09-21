/**
 * 全局 z-index 层级表。
 *
 * 之前散落的 z-30 / z-40 / z-50 容易被父级 `backdrop-filter`（glass-card）
 * 形成的层叠上下文关住，导致下拉框被后续卡片盖住。这里集中定义层级，
 * 需要浮层的地方统一从这里取，避免再出现“谁盖谁”的问题。
 */
export const zLayers = {
    /** 环境光斑背景 */
    background: -10,
    /** 普通内容（默认文档流） */
    content: 0,
    /** 吸附的侧边栏 */
    sticky: 20,
    /** 页内下拉（非 portal 时使用） */
    dropdown: 30,
    /** 移动端顶栏 / 底栏 */
    mobileBar: 40,
    /** 抽屉 */
    drawer: 50,
    /** 全局弹窗与 portal 浮层（永远在最上层） */
    overlay: 60,
} as const;

export type ZLayer = keyof typeof zLayers;
