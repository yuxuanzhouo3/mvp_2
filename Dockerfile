# ========== CloudBase 云托管优化版 Dockerfile ==========
# 使用多阶段构建减小镜像大小
FROM node:20-alpine AS base

# 安装必要工具和 pnpm
RUN apk add --no-cache libc6-compat && \
    npm install -g pnpm

# 设置工作目录
WORKDIR /app

# ========== 构建时环境变量声明 ==========
ARG NODE_ENV=production
ARG NEXT_PUBLIC_DEPLOYMENT_REGION=CN
ARG NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=cloudbase-build-placeholder
ARG DISABLE_REACT_PROFILING_ALIAS=true
ENV NODE_ENV=$NODE_ENV
ENV NEXT_PUBLIC_DEPLOYMENT_REGION=$NEXT_PUBLIC_DEPLOYMENT_REGION
ENV NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=$NEXT_PUBLIC_WECHAT_CLOUDBASE_ID
ENV DISABLE_REACT_PROFILING_ALIAS=$DISABLE_REACT_PROFILING_ALIAS

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 1. 声明构建参数 (ARG) 并提供【默认占位符】
# 关键修改：添加 =... 默认值。
# 这样即使腾讯云构建时不传这些参数，Docker 构建也能通过，
# 从而满足 Next.js 构建时对 process.env 的基本检查。
ARG NEXT_PUBLIC_SUPABASE_URL=https://build-placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder-key

# 2. 将 ARG 转为 ENV
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# 构建应用
# 此时 Next.js 会使用上面的假值完成构建。
# 只要你的代码里没有在 import 阶段就发起网络请求（通常是在组件 useEffect 或 Server Component 内部发起），
# 使用假值构建是完全安全的。
RUN pnpm build

# 生产阶段
FROM node:20-alpine AS production

# 安装必要工具和 pnpm
RUN apk add --no-cache libc6-compat && \
    npm install -g pnpm

# 设置工作目录
WORKDIR /app

# ========== 运行时配置说明 ==========
# CloudBase 云托管会通过环境变量注入配置
# 前端通过 /api/auth/config 接口在运行时获取 MY_NEXT_PUBLIC_... 变量

ARG NODE_ENV=production
ARG NEXT_PUBLIC_DEPLOYMENT_REGION=CN
ARG DISABLE_REACT_PROFILING_ALIAS=true

ENV NODE_ENV=$NODE_ENV
ENV NEXT_PUBLIC_DEPLOYMENT_REGION=$NEXT_PUBLIC_DEPLOYMENT_REGION
ENV DISABLE_REACT_PROFILING_ALIAS=$DISABLE_REACT_PROFILING_ALIAS

# ========== CloudBase 认证相关环境变量 ==========
# 这些变量由 CloudBase 云托管在运行时注入
# 必须在此声明，否则 Node.js 无法读取
ENV NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=${NEXT_PUBLIC_WECHAT_CLOUDBASE_ID}
ENV CLOUDBASE_SECRET_ID=${CLOUDBASE_SECRET_ID}
ENV CLOUDBASE_SECRET_KEY=${CLOUDBASE_SECRET_KEY}

# ========== 微信登录相关环境变量 ==========
ENV NEXT_PUBLIC_WECHAT_APP_ID=${NEXT_PUBLIC_WECHAT_APP_ID}
ENV WECHAT_APP_ID=${WECHAT_APP_ID}
ENV WECHAT_APP_SECRET=${WECHAT_APP_SECRET}

# ========== JWT 配置 ==========
ENV JWT_SECRET=${JWT_SECRET}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# ========== 应用 URL ==========
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# ========== 支付宝支付配置 (CN) ==========
ENV ALIPAY_APP_ID=${ALIPAY_APP_ID}
ENV ALIPAY_PRIVATE_KEY=${ALIPAY_PRIVATE_KEY}
ENV ALIPAY_PUBLIC_KEY=${ALIPAY_PUBLIC_KEY}
ENV ALIPAY_GATEWAY_URL=${ALIPAY_GATEWAY_URL}

# ========== 微信支付配置 (CN) ==========
ENV PAYMENT_TEST_MODE=${PAYMENT_TEST_MODE}
ENV WECHAT_PAY_APPID=${WECHAT_PAY_APPID}
ENV WECHAT_PAY_MCHID=${WECHAT_PAY_MCHID}
ENV WECHAT_PAY_SERIAL_NO=${WECHAT_PAY_SERIAL_NO}
ENV WECHAT_PAY_PRIVATE_KEY=${WECHAT_PAY_PRIVATE_KEY}
ENV WECHAT_PAY_API_V3_KEY=${WECHAT_PAY_API_V3_KEY}

# ========== AI 推荐配置 ==========
ENV ZHIPU_API_KEY=${ZHIPU_API_KEY}

# CloudBase 云托管固定监听端口 3000
ENV HOST=0.0.0.0
ENV PORT=3000

# 从构建阶段复制必要的文件
COPY --from=base /app/package.json /app/pnpm-lock.yaml ./
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/next.config.mjs ./

# 安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 创建非root用户（提高安全性）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 更改文件所有权
RUN chown -R nextjs:nodejs /app
USER nextjs

# 暴露端口 3000（CloudBase 云托管要求）
EXPOSE 3000

# 健康检查（CloudBase 云托管推荐）
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 启动应用
CMD ["pnpm", "start"]
