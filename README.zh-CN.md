# LightAP

> [!WARNING]
> **早期阶段。** LightAP 是一个非常早期的项目，在 AI 的帮助下完成。
> 可能会遇到 bug 和性能问题，接口和行为也可能随时发生变化。
> 发现 bug？请提 issue。

[English](./README.md) | **简体中文**

LightAP 是一个基于 [ActivityPub](https://activitypub.rocks/) 联邦协议的去中心化社交平台。它对外提供标准的 WebFinger 和 Actor 文档，让别的实例能够发现本站用户；发往远端的活动都带 HTTP 签名，递送到对方的 inbox。你可以和任何支持 ActivityPub 的实例上的用户自由交流——无论是 Mastodon、Misskey、Pleroma，还是别人自建的服务器。

这是一个 Serverless 项目：整站最终打包成一个 Cloudflare Worker，部署后跑在 Cloudflare Workers 上，前后端来自同一份构建产物。数据落在 D1，长连接用 Durable Objects，异步投递用 Queues。

## 功能

**联邦**

- `/.well-known/webfinger` 提供 WebFinger 发现，Actor 文档在 `/users/[username]`
- 收件箱 `/users/[username]/inbox` 处理 `Follow`、`Accept`、`Create`、`Delete`、`Like`、`Undo`
- HTTP 签名：RFC 9421 与 draft-cavage（legacy）。发往远端时先试 RFC 9421，被拒则回退到 draft-cavage；收到的请求两种都接受
- 收到的请求先用来件方的公钥验签，验签通过才会写库
- `Digest` / `Content-Digest` 请求体摘要，用 SHA-256 计算
- 每个用户注册时生成一对 RSA 密钥（RSASSA-PKCS1-v1_5，2048 位）
- 发出的活动通过 Cloudflare Queue 异步投递，失败自动重试，远端响应慢不会阻塞请求
- `followers` 与 `following` 是真实的 ActivityPub `OrderedCollection`
- 已删除的帖子返回 `410 Gone` 和 `Tombstone`

**应用**

- 时间线：全部 / 本地 / 已关注，无限滚动加载
- 发帖、回复、点赞、关注 / 取关、删帖
- 关注、点赞、回复三类通知
- SSE 实时推送：新帖、回复、点赞、通知都无需刷新即可出现，断线重连后还会自动补齐漏掉的内容
- 跨实例搜索用户，支持 `@user@domain`
- 个人主页，含帖子、关注与粉丝数量
- 可以修改自己的昵称和简介；两者与 Actor 文档来自同一张表，远端实例下次抓取时会同步更新
- 未登录也能浏览时间线和个人主页
- 界面支持中文与 English，可随时切换；选择存在 Cookie 里并在服务端生效，首屏就是选定的语言

**账号**

- 用用户名和密码注册、登录
- 密码用 PBKDF2-SHA256 哈希（10 万次迭代，16 字节随机盐）
- 会话是自实现的 HS256 JWT，放在 HttpOnly Cookie 里（`Secure`、`SameSite=Lax`），有效期 7 天
- 远程用户和本站用户存在同一张表里，这样他们的帖子能显示昵称和头像；但远程用户无法登录

## 技术栈

| 层次 | 选型 |
| --- | --- |
| 框架 | [vinext](https://vinext.dev)（React Server Components，App Router）1.0.0-beta |
| 构建 | Vite 8 + `@cloudflare/vite-plugin` |
| 运行时 | Cloudflare Workers —— 一个 Worker，含 `fetch` 与 `queue` 两个入口 |
| 数据库 | Cloudflare D1（SQLite）+ Drizzle ORM |
| 实时 | Durable Objects + Server-Sent Events |
| 异步投递 | Cloudflare Queues |
| 样式 | Tailwind CSS v4 |
| 多语言 | 自实现的有类型字典（zh / en），没有引入 i18n 依赖 |
| 密码学 | 全部使用 Web Crypto，没有引入任何第三方鉴权或 JWT 依赖 |

## 目录结构

```
├── app/                          # 路由（App Router）
│   ├── page.tsx                  # 时间线
│   ├── post/[uuid]/              # 帖子线程 / 详情
│   ├── u/[username]/             # 个人主页
│   ├── search/                   # 搜索
│   ├── notifications/            # 通知
│   ├── settings/                 # 设置 + 关于
│   └── (backend)/                # 只在服务端执行的路由
│       ├── .well-known/webfinger/
│       ├── api/v1/               # JSON 接口
│       ├── notes/[uuid]/         # ActivityPub Note 对象
│       └── users/[username]/
├── src/
│   ├── activitypub/              # AP 类型、构建器、远程请求与投递
│   ├── db/                       # Drizzle schema 与 D1 客户端
│   ├── lib/                      # 鉴权、Actor、帖子、通知
│   ├── queue/                    # Queue 生产者与消费者
│   ├── realtime/                 # SSE Durable Object
│   ├── utils/                    # JWT、RSA 密钥对、PBKDF2、签名
│   └── web/                      # React 组件、状态、i18n、API 客户端
├── drizzle/                      # D1 迁移文件
├── worker.ts                     # Worker 入口：fetch + queue
├── proxy.ts                      # /api/* 的鉴权中间件
├── vite.config.ts                # Vite + vinext + Cloudflare 插件
├── wrangler.example.jsonc        # wrangler.jsonc 的模板
└── .dev.vars.example             # .dev.vars 的模板
```

## HTTP 接口

联邦接口返回 `application/activity+json`：

| 接口 | 说明 |
| --- | --- |
| `GET /.well-known/webfinger` | WebFinger 查询，返回 `application/jrd+json` |
| `GET /users/[username]` | Actor 文档 |
| `POST /users/[username]/inbox` | 收件箱——先验签，再处理活动 |
| `GET /users/[username]/followers` | 粉丝，返回 `OrderedCollection` |
| `GET /users/[username]/following` | 关注，返回 `OrderedCollection` |
| `GET /notes/[uuid]` | `Note`；已删除则返回 `410` 和 `Tombstone` |
| `GET /users/[username]/outbox` | 占位实现，见[实现范围](#实现范围) |

应用接口在 `/api/v1` 下，除了标注「公开」的以外都需要会话 Cookie：

| 接口 | 说明 |
| --- | --- |
| `POST /register`、`POST /login`、`POST /logout` | 公开 |
| `GET /feed?type=all\|local\|following` | 时间线。`all` / `local` 公开，`following` 需要登录 |
| `POST /notes` | 发帖；带 `inReplyTo` 时是回复 |
| `GET /notes/[uuid]` | 线程：先祖先，再直接回复 |
| `DELETE /notes/[uuid]` | 删除自己的帖子 |
| `POST /notes/[uuid]/like`、`DELETE /notes/[uuid]/like` | 点赞 / 取消点赞 |
| `POST /follow`、`POST /unfollow` | 关注 / 取关 |
| `GET /search?q=@user@domain` | 搜索本站用户，并解析远程用户 |
| `GET /users/[username]`、`GET /users/[username]/posts` | 个人资料与帖子（公开） |
| `PATCH /me` | 修改自己的昵称和简介（部分更新） |
| `GET /notifications`、`POST /notifications/read` | 通知列表与标记已读 |
| `GET /events` | SSE 事件流（公开；登录后会收到只属于该用户的事件） |

## 本地开发

### 前置条件

- Node.js **>= 22**
- 一个 Cloudflare 账号（免费版即可）
- npm（仓库以 npm 为准，已提交 `package-lock.json`）

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 Cloudflare 资源

需要一个 D1 数据库和一个 Queue。Durable Objects 不用手动创建，它们在 `wrangler.jsonc` 里声明。

```bash
npx wrangler d1 create lightap-db
npx wrangler queues create ap-delivery
```

`wrangler d1 create` 会打印出 `database_id`，下一步要用。

### 3. 生成 Wrangler 配置

```bash
# macOS / Linux
cp wrangler.example.jsonc wrangler.jsonc

# Windows（CMD）
copy /Y wrangler.example.jsonc wrangler.jsonc

# Windows（PowerShell）
Copy-Item wrangler.example.jsonc wrangler.jsonc
```

然后编辑 `wrangler.jsonc`，把 `d1_databases` 里的 `database_id` 改成上一步拿到的 id。本地开发可填占位 UUID —— D1 会跑在本地 SQLite 文件上。

模板已指向 Drizzle 的输出目录，以下两项无需修改：

```jsonc
"migrations_dir": "drizzle",
"migrations_pattern": "drizzle/*/migration.sql",
```

> `wrangler.jsonc` 在 `.gitignore` 里，不会提交。Vite 开发服务器也会读取它，因此开发环境无需额外配置即可使用 binding。

### 4. 创建本地密钥文件

开发环境的密钥放在 `.dev.vars`（已 gitignore）里：

```bash
# macOS / Linux
cp .dev.vars.example .dev.vars

# Windows（CMD）
copy /Y .dev.vars.example .dev.vars

# Windows（PowerShell）
Copy-Item .dev.vars.example .dev.vars
```

在 `.dev.vars` 中设置密钥：

```bash
JWT_SECRET="<一串足够长的随机字符串>"
```

> **不要**把 `JWT_SECRET` 写进 `wrangler.jsonc`。开发环境放在 `.dev.vars`，生产环境用 `wrangler secret put` 设置。

### 5. 执行数据库迁移

```bash
npx wrangler d1 migrations apply lightap-db --local
```

这会把表建到 `.wrangler/state` 下的本地 SQLite 数据库里。开发时 D1 binding 会自动指向它。

### 6. 启动开发服务器

```bash
npm run dev
```

打开开发服务器打印出的地址，注册账号即可开始使用。

> 会话 Cookie 带 `Secure` 属性，浏览器只会在 HTTPS 下发送。`http://localhost` 属于安全上下文，可直接使用；其他纯 HTTP 主机（例如局域网 IP）不属于，登录会表现为无任何反应。请使用 `localhost`，或为开发服务器启用 HTTPS。

### 查看本地数据库

```bash
npx wrangler d1 execute lightap-db --local --command "SELECT id, username, domain FROM users"
```

## 部署到生产

### 1. 登录 Cloudflare

```bash
npx wrangler login
```

### 2. 准备 `wrangler.jsonc`

若尚未创建（例如从新的 clone 直接部署），先从模板复制一份：

```bash
# macOS / Linux
cp wrangler.example.jsonc wrangler.jsonc

# Windows（CMD）
copy /Y wrangler.example.jsonc wrangler.jsonc

# Windows（PowerShell）
Copy-Item wrangler.example.jsonc wrangler.jsonc
```

生产环境请**单独建一个 D1 数据库**，不要复用本地的：

```bash
npx wrangler d1 create lightap-db
```

把新的 `database_id` 填进 `wrangler.jsonc`。

### 3. 创建生产环境的 Queue

```bash
npx wrangler queues create ap-delivery
```

### 4. 把迁移应用到远程数据库

```bash
npx wrangler d1 migrations apply lightap-db --remote
```

### 5. 设置生产环境密钥

```bash
npx wrangler secret put JWT_SECRET
```

Wrangler 会提示输入值。该值加密存储，并在运行时作为环境变量注入，不会出现在 `wrangler.jsonc` 里。

### 6. 构建并部署

```bash
npm run deploy
```

`npm run deploy` 实际执行 `vinext-cloudflare deploy`，会先用 Vite 构建，再部署生成的 Worker。如果想在推送前先在本地验证一份生产构建：

```bash
npm run preview
```

它会先构建，再用 Wrangler 把构建产物跑起来，这是最接近生产环境的本地验证方式。

### 7. 用真实域名

默认情况下 Worker 在 `*.workers.dev` 上提供服务，而这对联邦账号是不合适的身份：该域名位于 Public Suffix List 上，很多实例会将其视为共享域名并屏蔽；用户的地址也会变成 `acct:you@xxx.workers.dev` 这种形式。

可以在 Cloudflare 控制台绑定自定义域名，或者在 `wrangler.jsonc` 里配置 `routes`。

> 应在注册账号**之前**绑定域名。`actorUrl` 在注册时根据请求 origin 生成，在 `workers.dev` 上创建的账号会保留该域名，之后绑定自定义域名也不会改变它；如需更改则要迁移所有账号。

## 实现范围

LightAP 只实现跑通联邦所必需的部分，以下功能尚未实现：

- **公开 outbox** —— 投递由内部 API 与 Queue 完成。`GET /users/[username]/outbox` 返回空集合，`POST` 返回 `501`。
- **收件箱 GET** —— 返回空集合，只有 `POST` 是真实实现。
- **头像上传** —— 本站账号使用默认头像，没有上传接口，也没有填写链接的入口。`avatar_url` 仅对远程用户写入（取自对方 Actor 的 `icon`），本站 Actor 文档不带 `icon`。
- **审核与限流** —— 未实现。
- **远程回复** —— 线程页只显示已存于本地库的回复。
- **Mention** —— 通知类型定义中存在，但没有代码会创建它。
- **`/@username` 路由** —— WebFinger 将其声明为 profile-page 别名，实际只路由了 `/u/[username]`。
- **PBKDF2 迭代次数** —— 10 万次，低于 OWASP 目前对 PBKDF2-HMAC-SHA256 建议的 60 万次。存储的哈希自带迭代次数，因此日后提高不会使已有密码失效。

## 开源许可

目前还没有确定许可证。
