'use server'

/**
 * CloudBase 认证服务函数
 * 仅在服务器端运行
 */

import cloudbase from '@cloudbase/node-sdk'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'

interface CloudBaseUser {
  _id?: string
  email: string | null
  password?: string | null
  name: string | null
  avatar?: string | null
  pro: boolean
  region: string
  createdAt?: string
  updatedAt?: string
  lastLoginAt?: string
  wechatOpenId?: string
  wechatUnionId?: string | null
  subscriptionTier?: string
  plan?: string | null
  plan_exp?: string | null
  paymentMethod?: string | null
  hide_ads?: boolean
}

/**
 * 初始化 CloudBase 应用
 */
function initCloudBase() {
  return cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY
  })
}

/**
 * 用户邮箱密码登录
 */
export async function cloudbaseSignInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: CloudBaseUser; message: string; token?: string }> {
  try {
    const app = initCloudBase()
    const db = app.database()
    const usersCollection = db.collection('users')

    // 查找用户
    const userResult = await usersCollection.where({ email }).get()

    if (!userResult.data || userResult.data.length === 0) {
      return { success: false, message: 'User not found or password incorrect' }
    }

    const user = userResult.data[0]

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return { success: false, message: 'User not found or password incorrect' }
    }

    // 生成 JWT Token
    const token = jwt.sign(
      { userId: user._id, email: user.email, region: 'china' },
      process.env.JWT_SECRET || 'fallback-secret-key-for-development-only',
      { expiresIn: user.pro ? '90d' : '30d' }
    )

    return {
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        pro: user.pro || false,
        region: 'china'
      },
      token
    }
  } catch (error) {
    console.error('[CloudBase Login] Error:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Login failed' }
  }
}

/**
 * 用户邮箱密码注册
 */
export async function cloudbaseSignUpWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: CloudBaseUser; message: string; token?: string }> {
  try {
    const app = initCloudBase()
    const db = app.database()
    const usersCollection = db.collection('users')

    // 检查邮箱是否已存在
    const existingUserResult = await usersCollection.where({ email }).get()

    if (existingUserResult.data && existingUserResult.data.length > 0) {
      return { success: false, message: 'Email already registered' }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建新用户
    const newUser = {
      email,
      password: hashedPassword,
      name: email.includes('@') ? email.split('@')[0] : email,
      pro: false,
      region: 'china',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const result = await usersCollection.add(newUser)

    // 生成 JWT Token
    const token = jwt.sign(
      { userId: result.id, email, region: 'china' },
      process.env.JWT_SECRET || 'fallback-secret-key-for-development-only',
      { expiresIn: '30d' }
    )

    return {
      success: true,
      message: 'Registration successful',
      user: {
        _id: result.id,
        email,
        name: newUser.name,
        pro: false,
        region: 'china'
      },
      token
    }
  } catch (error) {
    console.error('[CloudBase Signup] Error:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Registration failed' }
  }
}

/**
 * 刷新 Token
 */
export async function cloudbaseRefreshToken(
  userId: string
): Promise<{ success: boolean; token?: string; message: string }> {
  try {
    const app = initCloudBase()
    const db = app.database()
    const usersCollection = db.collection('users')

    // 获取用户信息
    const userResult = await usersCollection.doc(userId).get()

    if (!userResult.data || userResult.data.length === 0) {
      return { success: false, message: 'User not found' }
    }

    const user = userResult.data[0]

    // 生成新的 JWT Token
    const token = jwt.sign(
      { userId: user._id, email: user.email, region: 'china' },
      process.env.JWT_SECRET || 'fallback-secret-key-for-development-only',
      { expiresIn: user.pro ? '90d' : '30d' }
    )

    return { success: true, token, message: 'Token refreshed' }
  } catch (error) {
    console.error('[CloudBase Refresh] Error:', error)
    return { success: false, message: error instanceof Error ? error.message : 'Token refresh failed' }
  }
}

/**
 * 微信登录
 * 根据微信 openid 查找或创建用户
 */
export async function cloudbaseSignInWithWechat(params: {
  openid: string
  unionid?: string | null
  nickname?: string | null
  avatar?: string | null
}): Promise<{
  success: boolean
  user?: CloudBaseUser
  message: string
  accessToken?: string
  refreshToken?: string
  tokenMeta?: { accessTokenExpiresIn: number; refreshTokenExpiresIn: number }
}> {
  try {
    const { openid, unionid, nickname, avatar } = params
    const app = initCloudBase()
    const db = app.database()
    const usersCollection = db.collection('users')
    const now = new Date().toISOString()

    console.log('[CloudBase WeChat] Looking for user with openid:', openid)

    // 1. 优先按 wechatOpenId 查找现有用户
    let userResult = await usersCollection.where({ wechatOpenId: openid }).get()

    // 2. 兼容早期用 email 存储 openid 的情况
    if (!userResult.data || userResult.data.length === 0) {
      const wechatEmail = `wechat_${openid}@local.wechat`
      userResult = await usersCollection.where({ email: wechatEmail }).get()
    }

    let user: CloudBaseUser

    if (userResult.data && userResult.data.length > 0) {
      // 现有用户：更新登录信息
      user = userResult.data[0]
      console.log('[CloudBase WeChat] Found existing user:', user._id)

      // 更新用户信息
      const updateData: Partial<CloudBaseUser> = {
        lastLoginAt: now,
        updatedAt: now,
      }

      // 更新昵称和头像（如果有新的）
      if (nickname && nickname !== user.name) {
        updateData.name = nickname
      }
      if (avatar && avatar !== user.avatar) {
        updateData.avatar = avatar
      }
      // 确保 wechatOpenId 已设置
      if (!user.wechatOpenId) {
        updateData.wechatOpenId = openid
      }
      // 更新 unionid（如果有）
      if (unionid && !user.wechatUnionId) {
        updateData.wechatUnionId = unionid
      }

      await usersCollection.doc(user._id!).update(updateData)

      // 合并更新后的数据
      user = { ...user, ...updateData }
    } else {
      // 新用户：创建用户记录
      console.log('[CloudBase WeChat] Creating new user for openid:', openid)

      const newUser: Omit<CloudBaseUser, '_id'> = {
        email: `wechat_${openid}@local.wechat`,
        password: null,
        name: nickname || '微信用户',
        avatar: avatar || null,
        pro: false,
        region: 'CN',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        wechatOpenId: openid,
        wechatUnionId: unionid || null,
        subscriptionTier: 'free',
        plan: 'free',
        plan_exp: null,
        paymentMethod: null,
        hide_ads: false,
      }

      const result = await usersCollection.add(newUser)
      user = { _id: result.id, ...newUser }
      console.log('[CloudBase WeChat] Created new user:', result.id)
    }

    // 3. 生成 JWT Token
    const accessTokenExpiresIn = user.pro ? 90 * 24 * 60 * 60 : 60 * 60 // Pro 用户 90 天，普通用户 1 小时
    const refreshTokenExpiresIn = 7 * 24 * 60 * 60 // 7 天

    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, region: 'CN', wechatOpenId: openid },
      process.env.JWT_SECRET || 'fallback-secret-key-for-development-only',
      { expiresIn: accessTokenExpiresIn }
    )

    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh', region: 'CN' },
      process.env.JWT_SECRET || 'fallback-secret-key-for-development-only',
      { expiresIn: refreshTokenExpiresIn }
    )

    return {
      success: true,
      message: 'WeChat login successful',
      user,
      accessToken,
      refreshToken,
      tokenMeta: {
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
      },
    }
  } catch (error) {
    console.error('[CloudBase WeChat] Error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'WeChat login failed',
    }
  }
}
