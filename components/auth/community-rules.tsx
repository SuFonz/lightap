"use client";

import { CheckIcon, GlobeIcon } from "@/components/icons";

const rules = [
    { title: "友善待人", text: "对他人保持尊重，不发布侮辱、骚扰或仇恨内容。" },
    { title: "做真实的自己", text: "请使用真实且唯一的账号，尊重他人的版权。" },
    { title: "善用内容警告", text: "剧透、敏感话题记得加上内容警告（CW）。" },
    { title: "保护隐私", text: "不要公开他人的私人信息，发布前先征得同意。" },
];

export function CommunityRules() {
    return (
        <section className="glass-card p-5" aria-label="社区规则">
            <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-extrabold text-slate-700">
                <GlobeIcon size={15} className="text-brand-deep" /> 社区规则
            </h2>
            <ul className="flex flex-col gap-3">
                {rules.map((rule) => (
                    <li key={rule.title} className="flex gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                            <CheckIcon size={12} />
                        </span>
                        <div className="min-w-0">
                            <p className="font-display text-[13px] font-bold text-slate-700">
                                {rule.title}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                                {rule.text}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
