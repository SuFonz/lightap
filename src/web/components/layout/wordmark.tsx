import { FeatherIcon } from "@/web/components/ui/icons";
import { cn } from "@/web/lib/cn";

/**
 * 品牌字标：一个细描边的羽毛 + 收紧字距的无衬线字。
 * 不用渐变方块、不用发光，靠字形本身站住。
 */
export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
    return (
        <span className="flex items-center gap-1.5">
            <FeatherIcon
                size={size === "sm" ? 15 : 17}
                strokeWidth={1.7}
                className="mt-px shrink-0 text-brand"
            />
            <span
                className={cn(
                    "font-display font-semibold tracking-[-0.025em] text-ink",
                    size === "sm" ? "text-[14px]" : "text-[15.5px]",
                )}
            >
                LightAP
            </span>
        </span>
    );
}
