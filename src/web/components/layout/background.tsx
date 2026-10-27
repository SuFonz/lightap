/**
 * 页面背景：极浅冷蓝底 + 两团几乎察觉不到的蓝紫氛围。
 *
 * 没有纹理斜线，没有发光光斑，不做动画。
 * 理由：背景一旦「有存在感」，内容就不显眼了。
 * 现在的方向是内容做主角，背景只提供一点色温。
 */
export function Background() {
 return <div className="page-bg pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />;
}
