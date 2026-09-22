"use client";

import { createPortal } from "react-dom";
import { useMounted } from "@/web/hooks/use-mounted";
import { useUi } from "@/web/stores/ui-store";
import { zLayers } from "./z-layers";

/**
 * 全局轻提示：portal 到 body，固定底部居中，几秒后自动消失，点击可立即关闭。
 * 层级与弹窗一致，不受父级 `backdrop-filter` 形成的层叠上下文影响。
 */
export function ToastViewport() {
    const mounted = useMounted();
    const { toast, dismissToast } = useUi();

    if (!mounted || !toast) return null;

    return createPortal(
        <div
            className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4"
            style={{ zIndex: zLayers.overlay }}
        >
            <div
                role="status"
                aria-live="polite"
                onClick={dismissToast}
                className="glass-strong pointer-events-auto max-w-[90vw] cursor-pointer px-4 py-2.5 text-sm font-bold text-slate-700"
                style={{ animation: "pop-in .24s ease-out" }}
            >
                {toast}
            </div>
        </div>,
        document.body,
    );
}
