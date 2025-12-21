# ========== CloudBase 云托管优化版 Dockerfile ==========
# 使用多阶段构建减小镜像大小
FROM node:20-alpine AS base

# 安装必要工具和 pnpm
RUN apk add --no-cache libc6-compat && \
    npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# ========== 构建阶段环境变量 ==========
# 仅声明构建时需要的变量
ARG NODE_ENV=production
ARG NEXT_PUBLIC_DEPLOYMENT_REGION=CN
ARG DISABLE_REACT_PROFILING_ALIAS=true

# 构建时占位符（避免 Next.js 构建报错）
ARG NEXT_PUBLIC_SUPABASE_URL=https://build-placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder-key
ARG NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=cloudbase-build-placeholder

# 设置构建环境变量
ENV NODE_ENV=$NODE_ENV
ENV NEXT_PUBLIC_DEPLOYMENT_REGION=$NEXT_PUBLIC_DEPLOYMENT_REGION
ENV DISABLE_REACT_PROFILING_ALIAS=$DISABLE_REACT_PROFILING_ALIAS
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=$NEXT_PUBLIC_WECHAT_CLOUDBASE_ID

# 构建应用
RUN pnpm build

# ========== 生产阶段 ==========
FROM node:20-alpine AS production

# 安装必要工具和 pnpm
RUN apk add --no-cache libc6-compat && \
    npm install -g pnpm

# 设置工作目录
WORKDIR /app

# ========== 运行时环境变量 ==========
# 只设置固定不变的配置
ENV NODE_ENV=production
ENV NEXT_PUBLIC_DEPLOYMENT_REGION=CN
ENV DISABLE_REACT_PROFILING_ALIAS=true
ENV HOST=0.0.0.0
ENV PORT=3000

# ⚠️ 重要：以下环境变量由 CloudBase 云托管在运行时注入，不要在此声明
# 
# 认证相关：
# - NEXT_PUBLIC_WECHAT_CLOUDBASE_ID (CloudBase 环境 ID)
# - CLOUDBASE_SECRET_ID (CloudBase 密钥 ID)
# - CLOUDBASE_SECRET_KEY (CloudBase 密钥 Key)
# - JWT_SECRET (JWT 密钥)
# - NEXTAUTH_SECRET (NextAuth 密钥)
#
# 微信相关：
# - WECHAT_APP_ID (微信 AppID)
# - WECHAT_APP_SECRET (微信 AppSecret)
# - WECHAT_PAY_* (微信支付相关)
#
# 数据库相关：
# - NEXT_PUBLIC_SUPABASE_URL (Supabase URL)
# - NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase Key)
#
# 其他服务：
# - NEXT_PUBLIC_APP_URL (应用访问 URL)
# - ALIPAY_* (支付宝支付相关)
# - ZHIPU_API_KEY (AI 服务密钥)
#
# ❌ 错误示例（会覆盖运行时注入）：
# ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
#
# ✅ 正确做法：完全不声明，让云托管注入

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