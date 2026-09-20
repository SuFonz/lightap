/** 第一层环境：蓝色天空 + 光晕 + 星光（仅装饰，不参与交互）。 */
export function Background() {
    return (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div className="blob absolute -top-32 -left-24 h-96 w-96 bg-brand/25" />
            <div
                className="blob absolute top-1/4 -right-28 h-[420px] w-[420px] bg-magic/20"
                style={{ animationDelay: "-6s" }}
            />
            <div
                className="blob absolute -bottom-36 left-1/3 h-[380px] w-[380px] bg-sakura/20"
                style={{ animationDelay: "-11s" }}
            />
            <span className="sparkle left-[8%] top-[16%] h-3 w-3" />
            <span className="sparkle right-[14%] top-[28%] h-2 w-2" style={{ animationDelay: "-2s" }} />
            <span className="sparkle left-[32%] bottom-[20%] h-2.5 w-2.5" style={{ animationDelay: "-3.5s" }} />
            <span className="sparkle right-[32%] top-[9%] h-1.5 w-1.5" style={{ animationDelay: "-1.2s" }} />
            <span className="sparkle left-[55%] bottom-[8%] h-2 w-2" style={{ animationDelay: "-4.2s" }} />
        </div>
    );
}
