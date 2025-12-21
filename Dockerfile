# =====================================================
# 构建阶段（仅用于 Next.js build）
# =====================================================
FROM node:20-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 构建参数（仅 build-time 使用）
ARG NODE_ENV=production
ARG NEXT_PUBLIC_SUPABASE_URL=https://build-placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder-key
ARG NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=cloudbase-build-placeholder
ARG NEXT_PUBLIC_DEPLOYMENT_REGION=CN
ARG DISABLE_REACT_PROFILING_ALIAS=true

# ⚠️ 关键点：
# 这里只在 builder 阶段设置 ENV
# 这些值不会进入最终镜像
ENV NODE_ENV=$NODE_ENV \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=$NEXT_PUBLIC_WECHAT_CLOUDBASE_ID \
    NEXT_PUBLIC_DEPLOYMENT_REGION=$NEXT_PUBLIC_DEPLOYMENT_REGION \
    DISABLE_REACT_PROFILING_ALIAS=$DISABLE_REACT_PROFILING_ALIAS

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖（含 devDependencies）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建 Next.js
RUN pnpm build



# =====================================================
# 生产阶段（完全依赖 CloudBase 注入）
# =====================================================
FROM node:20-alpine AS runner

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# ❌ 不声明任何 NEXT_PUBLIC_* / Supabase / 微信 / AI 相关 ENV
# ❌ 不声明 NODE_ENV（CloudBase 会注入）
# ❌ 不声明 APP_URL / JWT_SECRET 等

ARG PORT=3000
ENV PORT=$PORT

# 仅复制运行必需文件
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# 仅安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 非 root 用户
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["pnpm", "start"]
# =====================================================
# 构建阶段（仅用于 Next.js build）
# =====================================================
FROM node:20-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 构建参数（仅 build-time 使用）
ARG NODE_ENV=production
ARG NEXT_PUBLIC_SUPABASE_URL=https://build-placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder-key
ARG NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=cloudbase-build-placeholder
ARG NEXT_PUBLIC_DEPLOYMENT_REGION=CN
ARG DISABLE_REACT_PROFILING_ALIAS=true

# ⚠️ 关键点：
# 这里只在 builder 阶段设置 ENV
# 这些值不会进入最终镜像
ENV NODE_ENV=$NODE_ENV \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=$NEXT_PUBLIC_WECHAT_CLOUDBASE_ID \
    NEXT_PUBLIC_DEPLOYMENT_REGION=$NEXT_PUBLIC_DEPLOYMENT_REGION \
    DISABLE_REACT_PROFILING_ALIAS=$DISABLE_REACT_PROFILING_ALIAS

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖（含 devDependencies）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建 Next.js
RUN pnpm build



# =====================================================
# 生产阶段（完全依赖 CloudBase 注入）
# =====================================================
FROM node:20-alpine AS runner

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# ❌ 不声明任何 NEXT_PUBLIC_* / Supabase / 微信 / AI 相关 ENV
# ❌ 不声明 NODE_ENV（CloudBase 会注入）
# ❌ 不声明 APP_URL / JWT_SECRET 等

ARG PORT=3000
ENV PORT=$PORT

# 仅复制运行必需文件
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# 仅安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 非 root 用户
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["pnpm", "start"]
# =====================================================
# 构建阶段（仅用于 Next.js build）
# =====================================================
FROM node:20-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 构建参数（仅 build-time 使用）
ARG NODE_ENV=production
ARG NEXT_PUBLIC_SUPABASE_URL=https://build-placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder-key
ARG NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=cloudbase-build-placeholder
ARG NEXT_PUBLIC_DEPLOYMENT_REGION=CN
ARG DISABLE_REACT_PROFILING_ALIAS=true

# ⚠️ 关键点：
# 这里只在 builder 阶段设置 ENV
# 这些值不会进入最终镜像
ENV NODE_ENV=$NODE_ENV \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_WECHAT_CLOUDBASE_ID=$NEXT_PUBLIC_WECHAT_CLOUDBASE_ID \
    NEXT_PUBLIC_DEPLOYMENT_REGION=$NEXT_PUBLIC_DEPLOYMENT_REGION \
    DISABLE_REACT_PROFILING_ALIAS=$DISABLE_REACT_PROFILING_ALIAS

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖（含 devDependencies）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建 Next.js
RUN pnpm build



# =====================================================
# 生产阶段（完全依赖 CloudBase 注入）
# =====================================================
FROM node:20-alpine AS runner

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# ❌ 不声明任何 NEXT_PUBLIC_* / Supabase / 微信 / AI 相关 ENV
# ❌ 不声明 NODE_ENV（CloudBase 会注入）
# ❌ 不声明 APP_URL / JWT_SECRET 等

ARG PORT=3000
ENV PORT=$PORT

# 仅复制运行必需文件
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# 仅安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 非 root 用户
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["pnpm", "start"]
