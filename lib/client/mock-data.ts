import type { AppNotification, Post, TrendingTag, User } from "./types";

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

const reply = (id: string, authorUsername: string, content: string, ageM: number, replies: Post[] = []): Post => ({
    id,
    authorUsername,
    content,
    createdAt: minutesAgo(ageM),
    likes: 0,
    likedByMe: false,
    boosts: 0,
    boostedByMe: false,
    replies,
});

export const CURRENT_USERNAME = "mochi";

export const seedUsers: User[] = [
    {
        username: "mochi",
        displayName: "麻薯酱",
        bio: "一只喜欢画画的 ActivityPub 小麻薯 🍡 前端 / 插画 / 猫。欢迎来戳我玩！",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Mochi",
        instance: "lightap.social",
        followers: 1024,
        following: 87,
        postsCount: 3,
        badges: ["前端", "画画"],
        online: true,
    },
    {
        username: "sakura",
        displayName: "小樱",
        bio: "春天、樱花和拿铁☕ 每天分享一张随手拍。",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Sakura",
        instance: "lightap.social",
        followers: 2333,
        following: 120,
        postsCount: 128,
        badges: ["手账", "摄影"],
        online: true,
    },
    {
        username: "kuro",
        displayName: "黑猫先生",
        bio: "深夜代码写手，白天是猫。Rust & TypeScript 双修。",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Kuro",
        instance: "mastodon.social",
        followers: 866,
        following: 42,
        postsCount: 512,
        badges: ["夜猫子", "Rust"],
        online: false,
    },
    {
        username: "yuki",
        displayName: "雪宝",
        bio: "北方小城的插画师，画雪和温暖的故事。接稿中 ❄",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Yuki",
        instance: "lightap.social",
        followers: 1500,
        following: 300,
        postsCount: 89,
        badges: ["插画师", "接稿中"],
        online: true,
    },
    {
        username: "taro",
        displayName: "太狼",
        bio: "游戏开发者，正在做一款像素风牧场物语。",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Taro",
        instance: "misskey.io",
        followers: 640,
        following: 95,
        postsCount: 233,
        badges: ["独立游戏", "像素画"],
        online: false,
    },
    {
        username: "luna",
        displayName: "露娜",
        bio: "天文摄影 + 电子手账。今晚的月亮也很圆。",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Luna",
        instance: "lightap.social",
        followers: 980,
        following: 61,
        postsCount: 77,
        badges: ["天文", "电子手账"],
        online: false,
    },
];

export const seedPosts: Post[] = [
    {
        id: "p1",
        authorUsername: "sakura",
        content:
            "今天路过公园，樱花终于开啦！捡了一片花瓣夹进手账里 🌸 #二次元 #日常",
        createdAt: minutesAgo(8),
        likes: 42,
        likedByMe: false,
        boosts: 7,
        boostedByMe: false,
        replies: [
            reply("r1", "luna", "哇，好治愈！我也想去野餐～", 6),
            reply("r2", "taro", "夹进手账这个点子好可爱，学会啦", 4),
            reply("r3", "yuki", "樱花季来啦，画一张留念！", 2),
        ],
    },
    {
        id: "p2",
        authorUsername: "kuro",
        content:
            "给 LightAP 的 outbox 写了个小测试，ActivityPub 的协议比想象中优雅，收发 Activity 就像寄明信片一样～ #开发 #ActivityPub",
        createdAt: minutesAgo(32),
        likes: 18,
        likedByMe: true,
        boosts: 5,
        boostedByMe: false,
        replies: [
            reply("r4", "sakura", "太优雅了，发出去像寄卡片一样 ✉️", 20),
        ],
    },
    {
        id: "p3",
        authorUsername: "yuki",
        content:
            "新画的 winter girl 立绘完工！蓝色的斗篷配银色的发，大家觉得怎么样？ #插画 #二次元",
        createdAt: minutesAgo(65),
        likes: 130,
        likedByMe: false,
        boosts: 24,
        boostedByMe: true,
        replies: [
            reply("r5", "taro", "这个配色太干净了，求画一只小鸡！", 50),
            reply("r6", "luna", "银色发丝好有质感，喜欢 💙", 38),
            reply("r7", "mochi", "斗篷的褶皱画得好棒，学习！", 15, [
                reply("r7-1", "yuki", "嘿嘿，过奖啦～", 12),
            ]),
        ],
    },
    {
        id: "p4",
        authorUsername: "taro",
        content: "像素牧场 demo 第一版跑起来了，小鸡会跟着你走啦 #游戏开发 #像素画",
        createdAt: minutesAgo(180),
        likes: 56,
        likedByMe: false,
        boosts: 9,
        boostedByMe: false,
        replies: [
            reply("r8", "yuki", "毛茸茸的小鸡太治愈了，蹲一个！", 120),
            reply("r9", "mochi", "像素画风好可爱，想玩！", 60),
        ],
    },
    {
        id: "p5",
        authorUsername: "luna",
        content: "凌晨两点的木星冲日观测报告：视宁度一般但很值得。附一张手机目镜图。 #天文",
        createdAt: minutesAgo(300),
        likes: 77,
        likedByMe: false,
        boosts: 11,
        boostedByMe: false,
        replies: [
            reply("r10", "kuro", "这视宁度还能拍这么清楚，厉害了！", 240),
            reply("r11", "sakura", "星空总是让人安静下来呢 ✨", 120),
        ],
    },
    {
        id: "p6",
        authorUsername: "mochi",
        content: "把首页换成了液态玻璃风格，蓝蓝的很治愈～ #前端 #设计",
        createdAt: minutesAgo(420),
        likes: 25,
        likedByMe: false,
        boosts: 3,
        boostedByMe: false,
        replies: [],
    },
];

export const seedNotifications: AppNotification[] = [
    {
        id: "n1",
        type: "follow",
        actorUsername: "sakura",
        createdAt: minutesAgo(5),
        read: false,
    },
    {
        id: "n2",
        type: "like",
        actorUsername: "yuki",
        postId: "p6",
        excerpt: "把首页换成了液态玻璃风格…",
        createdAt: minutesAgo(26),
        read: false,
    },
    {
        id: "n3",
        type: "boost",
        actorUsername: "kuro",
        postId: "p6",
        excerpt: "把首页换成了液态玻璃风格…",
        createdAt: minutesAgo(48),
        read: false,
    },
    {
        id: "n4",
        type: "mention",
        actorUsername: "taro",
        postId: "p4",
        excerpt: "@mochi 要不要来给我的牧场画几只小鸡呀？",
        createdAt: minutesAgo(190),
        read: true,
    },
    {
        id: "n5",
        type: "like",
        actorUsername: "luna",
        postId: "p6",
        excerpt: "把首页换成了液态玻璃风格…",
        createdAt: minutesAgo(400),
        read: true,
    },
];

export const seedTrends: TrendingTag[] = [
    { name: "二次元", postsCount: 1284 },
    { name: "插画", postsCount: 964 },
    { name: "ActivityPub", postsCount: 512 },
    { name: "前端", postsCount: 388 },
    { name: "游戏开发", postsCount: 233 },
    { name: "天文", postsCount: 120 },
];
