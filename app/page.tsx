"use client"

import { useEffect, useCallback, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { isChinaRegion } from "@/lib/config/region"
import {
  parseWxMpLoginCallback,
  clearWxMpLoginParams,
} from "@/lib/wechat-mp"
import { saveAuthState } from "@/lib/auth/auth-state-manager"
import { AppHome } from "@/components/home/AppHome"

export default function HomePage() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth()
  const [mpLoginProcessing, setMpLoginProcessing] = useState(false)

  // 处理小程序登录回调
  const handleMpLoginCallback = useCallback(async () => {
    const callback = parseWxMpLoginCallback()
    if (!callback) return

    setMpLoginProcessing(true)
    console.log('[HomePage] Processing MP login callback:', {
      hasToken: !!callback.token,
      hasOpenid: !!callback.openid,
      hasCode: !!callback.code
    })

    try {
      // 情况1：直接收到 token（推荐流程）
      if (callback.token && callback.openid) {
        const res = await fetch('/api/auth/mp-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            token: callback.token,
            openid: callback.openid,
            expiresIn: callback.expiresIn,
            nickName: callback.nickName,
            avatarUrl: callback.avatarUrl,
            userId: callback.userId,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          console.log('[HomePage] MP callback success:', data)

          // 保存认证状态到 localStorage
          if (data.user) {
            const refreshToken = callback.refreshToken || callback.token
            saveAuthState(
              callback.token,
              refreshToken,
              data.user,
              data.tokenMeta || {
                accessTokenExpiresIn: parseInt(callback.expiresIn || '604800', 10),
                refreshTokenExpiresIn: 604800,
              }
            )
            console.log('[HomePage] MP login state saved to localStorage')
          }

          clearWxMpLoginParams()
          // 刷新页面以更新认证状态
          window.location.reload()
          return
        } else {
          console.error('[HomePage] MP callback failed:', await res.text())
        }
      }

      // 情况2：收到 code（兜底流程）
      if (callback.code) {
        console.log('[HomePage] Processing code flow')
        const response = await fetch('/api/wxlogin/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code: callback.code }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // 设置 cookie
          const callbackRes = await fetch('/api/auth/mp-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              token: data.token,
              refreshToken: data.refreshToken,
              openid: data.openid,
              expiresIn: data.expiresIn,
              nickName: callback.nickName,
              avatarUrl: callback.avatarUrl,
              userId: data.userId,
            }),
          })

          if (callbackRes.ok) {
            const callbackData = await callbackRes.json()

            // 保存认证状态到 localStorage
            if (callbackData.user) {
              saveAuthState(
                data.token,
                data.refreshToken || data.token,
                callbackData.user,
                callbackData.tokenMeta || {
                  accessTokenExpiresIn: data.expiresIn || 604800,
                  refreshTokenExpiresIn: 604800,
                }
              )
              console.log('[HomePage] MP login state saved (code flow)')
            }
          }

          clearWxMpLoginParams()
          window.location.reload()
          return
        } else {
          console.error('[HomePage] Code exchange failed:', data)
        }
      }

      clearWxMpLoginParams()
    } catch (err) {
      console.error('[HomePage] MP callback error:', err)
      clearWxMpLoginParams()
    } finally {
      setMpLoginProcessing(false)
    }
  }, [])

  // 页面加载时检查小程序登录回调
  useEffect(() => {
    if (isChinaRegion()) {
      handleMpLoginCallback()
    }
  }, [handleMpLoginCallback])

  if (mpLoginProcessing || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{mpLoginProcessing ? "正在登录..." : "加载中..."}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AppHome user={null} isAuthenticated={false} signOut={signOut} />
  }

  return <AppHome user={user} isAuthenticated={isAuthenticated} signOut={signOut} />
}
