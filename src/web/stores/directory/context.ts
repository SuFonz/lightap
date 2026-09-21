"use client";

import { createContext, useContext } from "react";
import type { DirectoryValue } from "./types";

export const DirectoryContext = createContext<DirectoryValue | null>(null);

export function useDirectory(): DirectoryValue {
    const ctx = useContext(DirectoryContext);
    if (!ctx) throw new Error("useDirectory must be used within DirectoryProvider");
    return ctx;
}
