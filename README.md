# 辰汇个性推荐平台

基于 Next.js 14 + TypeScript 的多语言推荐应用，支持 **INTL（Supabase + Stripe/PayPal + OpenAI/Mistral）** 与 **CN（CloudBase + 支付宝/微信 + 智谱 AI）** 两套环境，前端一套代码通过环境变量自动适配。

## 核心特性
- AI 推荐：娱乐/购物/美食/旅行/健身多品类，支持智谱 / OpenAI / Mistral 等多提供商顺序与超时回退（`AI_FAST_MODE` 等可调）。
- 双区域适配：`NEXT_PUBLIC_DEPLOYMENT_REGION` 切换 CN/INTL，分别走 CloudBase 或 Supabase/Auth，支付通道跟随区域切换。
- 账号与订阅：邮箱登录，订阅档位（Free/Pro/Enterprise）与支付方式写入用户资料；包含登录、注册、设置、历史记录、引导流程等页面。
- 多语言：内置中/英文翻译，自动随区域选择，可在页面内手动切换。
- 下载入口：根据区域展示 App 下载/外链（CloudBase fileID 或外部 URL），含桌面与移动多平台占位。

## 技术栈
- Next.js 14（App Router）+ React 18 + TypeScript
- Tailwind CSS / Radix UI / framer-motion
- Supabase（INTL 数据库与 Auth）/ CloudBase（CN）
- Stripe & PayPal（INTL 支付）；支付宝 / 微信支付（CN，占位配置）
- AI 提供商：OpenAI、Mistral、智谱（可扩展 Groq/Google 等）

## 目录速览
```
app/                 # 页面与 API 路由（登录/注册/支付/下载/设置等）
components/          # UI 组件与语言切换
hooks/               # 认证、引导等客户端 Hook
lib/                 # AI、配置、支付、Auth 适配层
supabase/migrations/ # INTL 环境数据库迁移 SQL
docs/                # 架构、优化、验证文档
```

## 快速开始
1) 安装依赖（建议 Node 18+）  
   ```bash
   pnpm install
   ```
2) 配置环境变量  
   ```bash
   cp .env.example .env.local
   # 按需填写 INTL 或 CN 所需变量
   pnpm run verify:env   # 可选，检查必填项
   ```
   - INTL：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、AI 密钥（至少配置 OpenAI/Mistral 之一）、Stripe/PayPal 密钥。  
   - CN：`NEXT_PUBLIC_WECHAT_CLOUDBASE_ID`、`CLOUDBASE_SECRET_ID`、`CLOUDBASE_SECRET_KEY`、`ZHIPU_API_KEY`，可选支付宝/微信支付、微信 OAuth。  
   - 通用：`NEXT_PUBLIC_DEPLOYMENT_REGION`（INTL/CN）、`JWT_SECRET`、`NEXTAUTH_SECRET`、`NEXT_PUBLIC_APP_URL`、下载地址等。
3) （INTL）应用数据库迁移  
   使用 Supabase CLI/控制台执行 `supabase/migrations/*.sql`，确保用户、推荐、支付相关表结构已创建。
4) 本地开发
   ```bash
   pnpm dev
   # http://localhost:3000
   ```
5) 生产构建
   ```bash
   pnpm build && pnpm start
   ```

## 常用脚本
- `pnpm dev`：本地开发
- `pnpm build` / `pnpm start`：生产构建与启动
- `pnpm lint`：代码检查
- `pnpm run verify:env`：校验 CN/INTL 环境变量
- `pnpm run test:zhipu`：本地智谱 API 连通性测试

## 关键配置与提示
- AI 调优：`AI_FAST_MODE`、`AI_PROVIDER_TIMEOUT_MS`、`AI_HISTORY_LIMIT` 等位于 `.env.local`，详见 `docs/2025-12-24/AI_RECOMMENDATION_OPTIMIZATION.md`。
- 区域切换：`NEXT_PUBLIC_DEPLOYMENT_REGION=INTL|CN` 控制 Auth/DB/支付/AI 的适配逻辑，相关说明见 `docs/2025-12-19/DUAL_ENVIRONMENT_GUIDE.md`。
- 下载入口：INTL 使用 `NEXT_PUBLIC_INTL_*_URL` 外链，CN 使用 `CN_*_FILE_ID` CloudBase 文件 ID。
- 演示账户：`LOGIN_INFO.md` 提供 Free/Pro/Enterprise 示例账号（如需本地验证可按文档补充数据）。


