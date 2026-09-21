"use client";

import { createContext, useContext } from "react";
import type { TimelineValue } from "./types";

export const TimelineContext = createContext<TimelineValue | null>(null);

export function useTimeline(): TimelineValue {
    const ctx = useContext(TimelineContext);
    if (!ctx) throw new Error("useTimeline must be used within TimelineProvider");
    return ctx;
}
