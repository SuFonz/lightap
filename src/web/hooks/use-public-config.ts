"use client";

import { useEffect, useState } from "react";
import { configApi } from "@/web/lib/api";
import type { PublicConfigResponse } from "@/web/types";

/**
 * 公开配置（机器人验证等可选功能的开关）。
 *
 * 全局只拉一次：模块级缓存 + 单飞（in-flight 去重），
 * 避免每个打开注册框的组件都各发一次请求。
 *
 * 拉取失败时返回 null（等价于「功能全部关闭」）：
 * 可选功能不该因为配置接口挂掉而影响注册主流程。
 */
let cache: PublicConfigResponse | null = null;
let inflight: Promise<PublicConfigResponse | null> | null = null;

async function loadConfig(): Promise<PublicConfigResponse | null> {
    if (cache) return cache;
    if (inflight) return inflight;

    inflight = configApi
        .fetchPublicConfig()
        .then((res) => {
            cache = res;
            return res;
        })
        .catch(() => null)
        .finally(() => {
            inflight = null;
        });

    return inflight;
}

export function usePublicConfig(): PublicConfigResponse | null {
    const [config, setConfig] = useState<PublicConfigResponse | null>(cache);

    useEffect(() => {
        if (cache) {
            setConfig(cache);
            return;
        }
        let alive = true;
        void loadConfig().then((res) => {
            if (alive) setConfig(res);
        });
        return () => {
            alive = false;
        };
    }, []);

    return config;
}
