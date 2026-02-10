"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { auth } from '@/lib/auth/client'
import { RegionConfig, isChinaRegion } from '@/lib/config/region'
import { useIsIPhone, useIsMobile } from '@/hooks/use-device'
import { useLanguage } from '@/components/language-provider'
import { useTranslations } from '@/lib/i18n'
import {
  isMiniProgram,
  parseWxMpLoginCallback,
  clearWxMpLoginParams,
  requestWxMpLoginAsync,
} from '@/lib/wechat-mp'
import { isAppContainer } from '@/lib/app/app-container'
import { saveAuthState } from '@/lib/auth/auth-state-manager'

type LoginMode = 'password' | 'reset'

export default function LoginPage() {
  const router = useRouter()
  const isIPhone = useIsIPhone()
  const isMobile = useIsMobile()
  const { language } = useLanguage()
  const t = useTranslations(language)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [loginMode, setLoginMode] = useState<LoginMode>('password')
  const [sendingCode, setSendingCode] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [codeCooldown, setCodeCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false)
  const [isInMiniProgram, setIsInMiniProgram] = useState(false)
  const [mpLoginProcessing, setMpLoginProcessing] = useState(false)
  const isChineseLanguage = language === 'zh'
  const isChinaDeployment = RegionConfig.auth.provider === 'cloudbase'
  const isChina = isChinaRegion()

  // 检测小程序环境
  useEffect(() => {
    setIsInMiniProgram(isMiniProgram())
  }, [])

  // 处理小程序登录回调
  const handleMpLoginCallback = useCallback(async () => {
    const callback = parseWxMpLoginCallback()
    if (!callback) return

    setMpLoginProcessing(true)
    setError(null)

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
            console.log('[Login] MP login state saved to localStorage')
          }

          clearWxMpLoginParams()
          // 登录成功，刷新页面以更新状态
          window.location.href = '/'
          return
        } else {
          const errorData = await res.json().catch(() => ({}))
          setError(errorData.error || '小程序登录失败')
        }
      }

      // 情况2：收到 code（兜底流程）
      if (callback.code) {
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
              console.log('[Login] MP login state saved to localStorage (code flow)')
            }
          }

          clearWxMpLoginParams()
          window.location.href = '/'
          return
        } else {
          setError(data.message || '登录失败')
        }
      }

      clearWxMpLoginParams()
    } catch (err) {
      console.error('[Login] MP callback error:', err)
      setError(err instanceof Error ? err.message : '小程序登录处理失败')
      clearWxMpLoginParams()
    } finally {
      setMpLoginProcessing(false)
    }
  }, [])

  // 页面加载时检查小程序登录回调
  useEffect(() => {
    if (isChina) {
      handleMpLoginCallback()
    }
  }, [handleMpLoginCallback, isChina])

  useEffect(() => {
    if (codeCooldown <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      setCodeCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [codeCooldown])

  const handleSendResetCode = async () => {
    if (!isChinaDeployment) {
      setError(t.auth.sendOtpFailed)
      return
    }

    const emailValue = email.trim()
    if (!emailValue) {
      setError(t.auth.enterEmail)
      return
    }

    setError(null)
    setSuccess(null)
    setSendingCode(true)

    try {
      const result = await auth.sendEmailVerificationCode?.({
        email: emailValue,
        purpose: 'reset_password',
      })

      if (!result || result.error) {
        const errorCode = result?.code
        const errorMessage = result?.error?.message || t.auth.sendOtpFailed

        if (errorCode === 'USER_NOT_FOUND') {
          setError(isChineseLanguage ? '该邮箱未注册' : 'This email is not registered.')
        } else if (errorCode === 'SEND_TOO_FREQUENT') {
          const waitSeconds = result?.retryAfterSeconds ?? 60
          setCodeCooldown(waitSeconds)
          setError(
            isChineseLanguage
              ? `发送过于频繁，请 ${waitSeconds} 秒后重试`
              : `Sending too frequently. Please retry after ${waitSeconds} seconds.`
          )
        } else {
          setError(errorMessage)
        }
        return
      }

      const cooldown = result.data?.expiresInSeconds
        ? Math.min(60, result.data.expiresInSeconds)
        : 60
      setCodeCooldown(cooldown)
      setSuccess(t.auth.otpSent)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.sendOtpFailed)
    } finally {
      setSendingCode(false)
    }
  }

  const onResetPasswordSubmit = async () => {
    if (!isChinaDeployment) {
      setError(t.auth.setPasswordFailed)
      return
    }

    const emailValue = email.trim()
    if (!emailValue) {
      setError(t.auth.enterEmail)
      return
    }

    if (!resetCode.trim()) {
      setError(t.auth.enterOtpRequired)
      return
    }

    if (newPassword.length < 6) {
      setError(t.auth.passwordTooShort)
      return
    }

    if (newPassword !== confirmNewPassword) {
      setError(t.auth.passwordMismatch)
      return
    }

    setResettingPassword(true)

    try {
      const result = await auth.resetPasswordWithCode?.({
        email: emailValue,
        code: resetCode.trim(),
        password: newPassword,
        confirmPassword: confirmNewPassword,
      })

      if (!result || result.error) {
        setError(result?.error?.message || t.auth.setPasswordFailed)
        return
      }

      setSuccess(t.auth.passwordResetSuccess)
      setResetCode('')
      setNewPassword('')
      setConfirmNewPassword('')
      setLoginMode('password')
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.setPasswordFailed)
    } finally {
      setResettingPassword(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (loginMode === 'reset') {
      await onResetPasswordSubmit()
      return
    }

    // 所有区域都必须同意隐私政策
    if (!agreeToPrivacy) {
      setError(isChineseLanguage ? '请阅读并同意隐私政策' : 'Please read and agree to the Privacy Policy')
      return
    }

    setLoading(true)

    try {
      const result = await auth.signInWithPassword({ email, password })

      if (result.error) {
        // 根据错误码显示翻译后的消息
        const errorMessage = result.error.message || ''
        if (errorMessage === 'INVALID_CREDENTIALS' || errorMessage.includes('INVALID_CREDENTIALS')) {
          setError(t.auth.invalidCredentials)
        } else {
          setError(t.auth.loginFailed)
        }
        setLoading(false)
        return
      }

      if (result.data.user) {
        router.push('/')
        router.refresh()
      } else {
        setError('Login failed, please try again')
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setOauthLoading(provider)
    setError(null)

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const callbackUrl = new URL('/auth/callback', baseUrl)
      callbackUrl.searchParams.set('redirect', '/')
      const oauthOptions: Record<string, any> = {
        redirectTo: callbackUrl.toString(),
      }

      const result = await auth.signInWithOAuth({
        provider,
        options: oauthOptions,
      })

      if (result.error) {
        setError(result.error.message || `${provider} login failed`)
        setOauthLoading(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setOauthLoading(null)
    }
  }

  const handleWeChatLogin = async () => {
    setOauthLoading('wechat')
    setError(null)

    try {
      // Mini Program login when not in the app container
      if (isInMiniProgram && !isAppContainer()) {
        console.log('[Login] Detected miniprogram environment, requesting native login...')
        const success = await requestWxMpLoginAsync(window.location.href)
        if (!success) {
          throw new Error('Failed to start Mini Program login')
        }
        // Stop here; Mini Program flow handles the rest
        return
      }

      const nextPath = '/'

      // CN region + App container: native WeChat login
      if (isChina && isAppContainer()) {
        console.log('[Login] CN App container detected, using native WeChat login')

        const handleNativeSuccess = async (code: string, state?: string) => {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
            const callbackUrl = new URL('/auth/callback', baseUrl)
            callbackUrl.searchParams.set('provider', 'wechat_mobile')
            callbackUrl.searchParams.set('code', code)
            callbackUrl.searchParams.set('state', state || '')
            callbackUrl.searchParams.set('redirect', nextPath)

            window.location.href = callbackUrl.toString()
          } catch (err) {
            console.error('[Login] Failed to process WeChat callback:', err)
            setError('Failed to process WeChat callback')
            setOauthLoading(null)
          }
        }

        const handleNativeError = (message?: string, errCode?: number) => {
          const details = [
            message ? `errStr=${message}` : null,
            errCode != null ? `errCode=${errCode}` : null,
          ].filter(Boolean).join(' | ')
          const fallback = errCode != null ? `WeChat login failed (errCode=${errCode})` : 'WeChat login failed'
          const fullMessage = details ? `WeChat login failed: ${details}` : fallback
          console.error('[Login] WeChat login error:', { message, errCode })
          setError(fullMessage)
          setOauthLoading(null)
        }

        // Android JS Bridge callbacks
        ;(window as any).handleWeChatLoginSuccess = (code: string, state?: string) => {
          if (!code) {
            handleNativeError('Missing WeChat auth code')
            return
          }
          handleNativeSuccess(code, state)
        }
        ;(window as any).handleWeChatLoginError = (error: string) => {
          handleNativeError(error)
        }

        const callbackName = '__wechatNativeAuthCallback'

        // Scheme callback
        ;(window as any)[callbackName] = async (payload: any) => {
          console.log('[Login] Received native WeChat login callback:', payload)

          if (!payload || typeof payload !== 'object') {
            handleNativeError('Invalid native login payload')
            return
          }

          if (payload.errCode !== 0 || !payload.code) {
            handleNativeError(payload.errStr, payload.errCode)
            return
          }

          await handleNativeSuccess(payload.code, payload.state)
        }

        let signedState = ''
        try {
          const stateResponse = await fetch(
            `/api/auth/wechat/mobile/start?redirect=${encodeURIComponent(nextPath)}`
          )
          const stateData = await stateResponse.json().catch(() => ({}))
          if (!stateResponse.ok || !stateData.state) {
            throw new Error(stateData.error || 'Failed to fetch WeChat state')
          }
          signedState = stateData.state
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch WeChat state')
          setOauthLoading(null)
          return
        }

        const androidBridge = (window as any).AndroidWeChatBridge
        if (androidBridge && typeof androidBridge.startLogin === 'function') {
          androidBridge.startLogin(signedState)
          return
        }
        if (androidBridge && typeof androidBridge.loginWithState === 'function') {
          androidBridge.loginWithState(signedState)
          return
        }

        const scheme = `wechat-login://start?callback=${encodeURIComponent(
          callbackName
        )}&state=${encodeURIComponent(signedState)}`
        console.log('[Login] Launching native WeChat login, scheme:', scheme)
        window.location.href = scheme
        return
      }

      const w = window as any
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const callbackUrl = new URL('/auth/callback', baseUrl)
      callbackUrl.searchParams.set('provider', 'wechat_mobile')
      callbackUrl.searchParams.set('redirect', nextPath)

      const payload = JSON.stringify({
        type: 'wechat_mobile_login',
        callbackUrl: callbackUrl.toString(),
      })

      const sentToNative =
        typeof w.ReactNativeWebView?.postMessage === 'function'
          ? (w.ReactNativeWebView.postMessage(payload), true)
          : typeof w.webkit?.messageHandlers?.wechatLogin?.postMessage === 'function'
            ? (w.webkit.messageHandlers.wechatLogin.postMessage(payload), true)
            : typeof w.webkit?.messageHandlers?.native?.postMessage === 'function'
              ? (w.webkit.messageHandlers.native.postMessage(payload), true)
              : typeof w.Android?.wechatLogin === 'function'
                ? (w.Android.wechatLogin(callbackUrl.toString()), true)
                : false

      if (sentToNative) {
        return
      }

      if (isMobile || isAppContainer()) {
        throw new Error('WeChat login is only available in the app')
      }

      // PC/Browser: request QR code URL
      const response = await fetch(`/api/auth/wechat/qrcode?next=${encodeURIComponent(nextPath)}`)
      const data = await response.json()

      if (!response.ok || !data.qrcodeUrl) {
        throw new Error(data.error || 'Failed to get WeChat login URL')
      }

      // Redirect to QR code URL
      window.location.href = data.qrcodeUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WeChat login failed')
      setOauthLoading(null)
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      {/* Back to Home Button */}
      <Link href="/" className="fixed top-4 left-4">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {isChineseLanguage ? '返回首页' : 'Back to Home'}
        </Button>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isChineseLanguage ? '欢迎回来' : 'Welcome back'}
          </CardTitle>
          <CardDescription className="text-center">
            {isChineseLanguage ? '登录您的账户以继续' : 'Sign in to your account to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 小程序登录处理中提示 */}
          {mpLoginProcessing && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <LoadingSpinner />
              <p className="text-sm text-muted-foreground">
                {isChineseLanguage ? '正在处理登录...' : 'Processing login...'}
              </p>
            </div>
          )}

          {/* Email Login Form */}
          {!mpLoginProcessing && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.auth.enterEmail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || !!oauthLoading || sendingCode || resettingPassword}
              />
            </div>
            {loginMode === 'password' ? (
              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t.auth.enterPassword}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || !!oauthLoading}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="resetCode">{t.auth.enterOtp}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="resetCode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={t.auth.enterOtp}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      disabled={resettingPassword || loading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendResetCode}
                      disabled={
                        loading ||
                        resettingPassword ||
                        sendingCode ||
                        codeCooldown > 0 ||
                        !email.trim()
                      }
                      className="whitespace-nowrap"
                    >
                      {sendingCode
                        ? t.auth.sending
                        : codeCooldown > 0
                          ? `${t.auth.resendOtp} (${codeCooldown}s)`
                          : t.auth.sendOtp}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t.auth.enterNewPassword}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder={t.auth.enterNewPassword}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={resettingPassword || loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">{t.auth.confirmNewPassword}</Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    placeholder={t.auth.confirmNewPassword}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={resettingPassword || loading}
                  />
                </div>
              </>
            )}

            {/* 隐私政策同意 - 所有版本都强制同意 */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Checkbox
                id="privacy-agree-login"
                checked={agreeToPrivacy}
                onCheckedChange={(checked) => setAgreeToPrivacy(checked as boolean)}
                disabled={loading || !!oauthLoading}
                className="mt-1"
              />
              <label
                htmlFor="privacy-agree-login"
                className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
              >
                {isChineseLanguage ? (
                  <>
                    我已阅读并同意{' '}
                    <Link
                      href="/privacy"
                      className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      《隐私政策》
                    </Link>
                    {' '}和{' '}
                    <Link
                      href="/privacy"
                      className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      《服务条款》
                    </Link>
                  </>
                ) : (
                  <>
                    I have read and agree to the{' '}
                    <Link
                      href="/privacy"
                      className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </Link>
                    {' '}and{' '}
                    <Link
                      href="/privacy"
                      className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms of Service
                    </Link>
                  </>
                )}
                <span className="text-red-600 ml-1">*</span>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                {success}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !!oauthLoading || resettingPassword}
            >
              {loading || resettingPassword ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  {loginMode === 'reset' ? t.auth.setting : t.auth.loggingIn}
                </span>
              ) : (
                loginMode === 'reset' ? t.auth.setNewPassword : t.auth.login
              )}
            </Button>

            {isChinaDeployment && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setError(null)
                  setSuccess(null)
                  setLoginMode((prev) => (prev === 'password' ? 'reset' : 'password'))
                }}
                disabled={loading || resettingPassword || sendingCode}
              >
                {loginMode === 'password' ? t.auth.forgotPassword : t.auth.usePasswordLogin}
              </Button>
            )}
          </form>
          )}

          {/* Google Login for International */}
          {!isIPhone && !mpLoginProcessing && loginMode === 'password' && RegionConfig.auth.provider === 'supabase' && RegionConfig.auth.features.googleAuth && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t.auth.or}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthLogin('google')}
                disabled={!!oauthLoading || loading}
              >
                {oauthLoading === 'google' ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    {t.auth.loggingIn}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <GoogleIcon />
                    {t.auth.googleLogin}
                  </span>
                )}
              </Button>
            </>
          )}

          {/* WeChat Login for China */}
          {!isIPhone && !mpLoginProcessing && loginMode === 'password' && isChinaDeployment && RegionConfig.auth.features.wechatAuth && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t.auth.or}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full bg-[#07C160] hover:bg-[#06AE56] text-white border-0"
                onClick={handleWeChatLogin}
                disabled={!!oauthLoading || loading}
              >
                {oauthLoading === 'wechat' ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    {t.auth.loggingIn}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <WeChatIcon />
                    {t.auth.wechatLogin}
                  </span>
                )}
              </Button>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            {t.auth.noAccount}{' '}
            <Link
              href="/register"
              className="text-primary hover:underline font-medium"
            >
              {t.auth.signUpLink}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

// Icon Components
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function WeChatIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z"/>
    </svg>
  )
}
