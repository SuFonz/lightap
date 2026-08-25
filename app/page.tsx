"use client";

import { FormEvent, useState } from "react";

interface Note {
    id: string;
    name: string;
    content: string;
}

interface OrderedCollection {
    type: string;
    id: string;
    summary: string;
    totalItems: number;
    orderedItems: Note[];
}

export default function Home() {
    const [username, setUsername] = useState("alice");
    const [noteName, setNoteName] = useState("");
    const [content, setContent] = useState("");

    const [queryUsername, setQueryUsername] = useState("alice");
    const [collection, setCollection] = useState<OrderedCollection | null>(null);

    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [loading, setLoading] = useState(false);

    async function handlePost(e: FormEvent) {
        e.preventDefault();

        if (!username.trim() || !content.trim()) {
            setMessage({ ok: false, text: "用户名和内容不能为空" });
            return;
        }

        const origin = window.location.origin;
        const actorId = `${origin}/api/users/${username.trim()}`;

        const activity = {
            "@context": "https://www.w3.org/ns/activitystreams",
            type: "Create",
            summary: `${username.trim()} posted a note`,
            actor: {
                "@context": "https://www.w3.org/ns/activitystreams",
                type: "Person",
                id: actorId,
                name: username.trim(),
            },
            object: {
                "@context": "https://www.w3.org/ns/activitystreams",
                type: "Note",
                name: noteName.trim(),
                content: content.trim(),
            },
        };

        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/users/${username.trim()}/outbox`, {
                method: "POST",
                headers: { "Content-Type": "application/activity+json" },
                body: JSON.stringify(activity),
            });

            if (res.ok) {
                setMessage({ ok: true, text: `POST 成功 (${res.status}), Location: ${res.headers.get("Location") ?? "-"}` });
                setContent("");
                setNoteName("");
            } else {
                setMessage({ ok: false, text: `POST 失败 (${res.status}): ${await res.text()}` });
            }
        } catch (err) {
            setMessage({ ok: false, text: `请求异常: ${err instanceof Error ? err.message : err}` });
        } finally {
            setLoading(false);
        }
    }

    async function handleFetch(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/users/${queryUsername.trim()}/outbox`);
            if (!res.ok) {
                setCollection(null);
                setMessage({ ok: false, text: `GET 失败 (${res.status}): ${await res.text()}` });
                return;
            }
            const data: OrderedCollection = await res.json();
            setCollection(data);
        } catch (err) {
            setCollection(null);
            setMessage({ ok: false, text: `请求异常: ${err instanceof Error ? err.message : err}` });
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
            <section className="mx-auto flex max-w-4xl flex-col gap-8">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
                        MiniAP · ActivityPub
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                        Outbox 测试页面
                    </h1>
                    <p className="mt-2 text-slate-600">
                        通过 POST 向 outbox 发布一条 Create Activity（发帖），再用 GET 读取该用户的 outbox。
                    </p>
                </div>

                {message && (
                    <div
                        className={`rounded-lg border px-4 py-3 text-sm ${
                            message.ok
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-red-300 bg-red-50 text-red-800"
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <form
                    className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
                    onSubmit={handlePost}
                >
                    <h2 className="text-lg font-semibold">POST · 发布新帖</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            用户名
                            <input
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-orange-500 focus:outline-none"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="alice"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            Note name（可选）
                            <input
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-orange-500 focus:outline-none"
                                value={noteName}
                                onChange={(e) => setNoteName(e.target.value)}
                                placeholder="标题"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            内容
                            <textarea
                                className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-orange-500 focus:outline-none"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="说点什么..."
                            />
                        </label>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-fit rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                        {loading ? "请求中..." : "发布"}
                    </button>
                    <p className="text-xs text-slate-500">
                        请求体: POST /api/users/{"{username}"}/outbox
                    </p>
                </form>

                <form
                    className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
                    onSubmit={handleFetch}
                >
                    <h2 className="text-lg font-semibold">GET · 查看 Outbox</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            用户名
                            <input
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-orange-500 focus:outline-none"
                                value={queryUsername}
                                onChange={(e) => setQueryUsername(e.target.value)}
                                placeholder="alice"
                            />
                        </label>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-fit rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                    >
                        {loading ? "请求中..." : "拉取"}
                    </button>
                    <p className="text-xs text-slate-500">
                        请求: GET /api/users/{"{username}"}/outbox
                    </p>

                    {collection && (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-slate-600">
                                {collection.summary} · 共 {collection.totalItems} 条
                            </p>
                            {collection.orderedItems.length === 0 ? (
                                <p className="text-sm text-slate-400">暂无内容</p>
                            ) : (
                                collection.orderedItems.map((note) => (
                                    <article
                                        key={note.id}
                                        className="rounded-md border border-slate-200 bg-slate-50 p-4"
                                    >
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-sm font-semibold">
                                                {note.name || "(无标题)"}
                                            </span>
                                            <a
                                                className="text-xs text-slate-500 hover:underline"
                                                href={note.id}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {note.id}
                                            </a>
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                            {note.content}
                                        </p>
                                    </article>
                                ))
                            )}
                        </div>
                    )}
                </form>
            </section>
        </main>
    );
}
