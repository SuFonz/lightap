import type { PublicConfigResponse } from "@/web/types";
import { request } from "./client";

/** 公开配置：GET /api/v1/config（机器人验证等可选功能的开关） */
export function fetchPublicConfig() {
    return request<PublicConfigResponse>("/api/v1/config");
}
