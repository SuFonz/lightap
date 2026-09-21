"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "@/web/components/ui/avatar";
import { CheckIcon, CloseIcon } from "@/web/components/ui/icons";
import { Modal } from "@/web/components/ui/modal";
import { useDirectory } from "@/web/stores/directory";

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
}

export function EditProfileModal({ open, onClose }: EditProfileModalProps) {
    const { currentUser, updateProfile } = useDirectory();
    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDisplayName(currentUser.displayName);
        setBio(currentUser.bio);
        setAvatarUrl(currentUser.avatarUrl ?? "");
        setSaved(false);
    }, [open, currentUser]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!displayName.trim() || saving) return;
        setSaving(true);
        try {
            await updateProfile({
                displayName: displayName.trim(),
                bio: bio.trim(),
                avatarUrl: avatarUrl.trim() || undefined,
            });
            setSaved(true);
            setTimeout(onClose, 700);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            label="编辑资料"
            alignClassName="items-end justify-center sm:items-center sm:p-4"
            panelClassName="glass-strong w-full max-w-md rounded-t-3xl p-6 sm:rounded-3xl"
            animation="pop-in .28s cubic-bezier(.34,1.4,.64,1)"
        >
            <form onSubmit={handleSubmit}>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-lg font-extrabold text-slate-800">编辑资料</h2>
                    <button
                        type="button"
                        aria-label="关闭"
                        onClick={onClose}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-slate-400 transition hover:bg-white/80 hover:text-brand-deep active:scale-90"
                    >
                        <CloseIcon size={18} />
                    </button>
                </div>

                <div className="mb-5 flex items-center gap-4">
                    <Avatar name={displayName || currentUser.username} src={avatarUrl} size={56} ring />
                    <label className="min-w-0 flex-1 text-xs font-bold text-slate-500">
                        头像图片链接（留空使用默认）
                        <input
                            type="url"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://…"
                            className="mt-1 w-full rounded-[10px] border border-white/70 bg-white/70 px-3 py-2 text-sm font-normal text-slate-700 focus:border-brand/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/15"
                        />
                    </label>
                </div>

                <label className="mb-4 block text-xs font-bold text-slate-500">
                    昵称
                    <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={20}
                        className="mt-1 w-full rounded-[10px] border border-white/70 bg-white/70 px-3 py-2.5 text-sm font-normal text-slate-700 focus:border-brand/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/15"
                    />
                </label>

                <label className="mb-6 block text-xs font-bold text-slate-500">
                    简介
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        maxLength={160}
                        placeholder="介绍一下自己吧～"
                        className="mt-1 w-full resize-none rounded-[10px] border border-white/70 bg-white/70 px-3 py-2.5 text-sm font-normal leading-relaxed text-slate-700 focus:border-brand/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/15"
                    />
                </label>

                <button
                    type="submit"
                    disabled={saving || !displayName.trim()}
                    className="btn-solid w-full px-5 py-3 font-display text-sm font-bold"
                >
                    {saved ? (
                        <>
                            已保存 <CheckIcon size={15} />
                        </>
                    ) : saving ? (
                        "保存中…"
                    ) : (
                        "保存修改"
                    )}
                </button>
            </form>
        </Modal>
    );
}
