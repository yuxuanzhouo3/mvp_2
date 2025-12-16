// 测试认证状态
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";

export async function GET(request: NextRequest) {
  const debug = {
    timestamp: new Date().toISOString(),
    headers: {},
    tokenInfo: null,
    authResult: null,
    verificationResult: null
  };

  // 记录相关 headers
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');
  debug.headers = {
    authorization: authHeader ? `Bearer ${authHeader.substring(0, 20)}...` : null,
    cookie: cookieHeader ? `${cookieHeader.length} chars` : null
  };

  // 提取 token
  const { token, error } = extractTokenFromRequest(request);
  debug.tokenInfo = {
    exists: !!token,
    error,
    length: token ? token.length : 0
  };

  // 如果有 token，尝试验证
  if (token) {
    const verification = await verifyAuthToken(token);
    debug.verificationResult = {
      success: verification.success,
      userId: verification.userId,
      region: verification.region,
      error: verification.error
    };
  }

  // 尝试完整的认证流程
  const authResult = await requireAuth(request);
  debug.authResult = {
    success: !!authResult,
    userId: authResult?.user?.id,
    email: authResult?.user?.email
  };

  return NextResponse.json(debug);
}