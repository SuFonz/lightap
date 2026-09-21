"use client";

import { useEffect, useState } from "react";

/** 是否已经挂载到客户端。用于只在浏览器渲染的分支，避免 hydration 不一致。 */
export function useMounted(): boolean {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    return mounted;
}
