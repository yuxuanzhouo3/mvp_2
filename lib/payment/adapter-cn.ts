/**
 * 支付服务适配器 - 中国版 (CN)
 * 支持微信支付和支付宝支付
 *
 * 支付模式：
 * - qrcode: 扫码支付（PC端）
 * - h5: 网页跳转支付（移动端）
 *
 * 微信支付：Native 支付（扫码）/ H5 支付（网页跳转）
 * 支付宝：当面付（扫码）/ 手机网站支付（网页跳转）
 */

import crypto from "crypto";
import { PaymentMethodCN, PaymentModeCN } from "./payment-config-cn";
import { getBaseUrl } from "@/lib/utils/get-base-url";

/**
 * 生成北京时间格式的时间戳（支付宝要求）
 * 格式: yyyy-MM-dd HH:mm:ss
 */
function getBeijingTimestamp(): string {
  const now = new Date();
  // 转换为北京时间 (UTC+8)
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().replace("T", " ").substring(0, 19);
}

/**
 * 订单接口（统一数据结构）
 */
export interface PaymentOrderCN {
  id: string;
  amount: number;
  currency: string; // CNY
  status: "pending" | "completed" | "failed" | "cancelled";
  userId: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
  // CN 特有字段
  qrCodeUrl?: string; // 支付二维码 URL
  prepayId?: string; // 微信预支付 ID
  tradeNo?: string; // 支付宝交易号
}

/**
 * 支付结果接口
 */
export interface PaymentResultCN {
  success: boolean;
  orderId: string;
  transactionId?: string;
  error?: string;
}

/**
 * 支付适配器接口（中国版）
 */
export interface PaymentAdapterCN {
  /**
   * 创建支付订单
   * @param amount 支付金额（单位：元）
   * @param userId 用户 ID
   * @param method 支付方式
   * @param options 额外选项
   * @returns 支付订单信息（包含支付二维码或跳转链接）
   */
  createOrder(
    amount: number,
    userId: string,
    method: PaymentMethodCN,
    options?: {
      currency?: string;
      description?: string;
      billingCycle?: string;
      planType?: string;
      mode?: PaymentModeCN; // 支付模式：qrcode 扫码 / h5 网页跳转
      returnUrl?: string; // H5 支付完成后的回跳地址
    }
  ): Promise<{
    orderId: string;
    qrCodeUrl?: string; // 支付二维码（扫码模式）
    paymentUrl?: string; // H5 支付链接（网页跳转模式）
    prepayId?: string; // 微信小程序支付用
  }>;

  /**
   * 验证支付回调（异步通知）
   * @param params 支付回调参数
   * @returns 支付结果
   */
  verifyPayment(params: any): Promise<PaymentResultCN>;

  /**
   * 查询订单状态
   * @param orderId 订单 ID
   * @returns 订单信息
   */
  queryOrder(orderId: string): Promise<PaymentOrderCN>;

  /**
   * 关闭/取消订单
   * @param orderId 订单 ID
   */
  cancelOrder(orderId: string): Promise<void>;

  /**
   * 申请退款
   * @param orderId 订单 ID
   * @param amount 退款金额
   * @param reason 退款原因
   */
  refund?(orderId: string, amount: number, reason?: string): Promise<PaymentResultCN>;
}

// ============================================
// 微信支付适配器
// ============================================

/**
 * 微信支付 API v3 适配器
 * 
 * 使用 Native 支付（扫码支付）
 * 文档：https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_4_1.shtml
 */
class WeChatPayAdapter implements PaymentAdapterCN {
  private appId: string;
  private mchId: string;
  private serialNo: string;
  private privateKey: string;
  private apiV3Key: string;
  private notifyUrl: string;

  constructor() {
    this.appId = process.env.WECHAT_PAY_APPID || "";
    this.mchId = process.env.WECHAT_PAY_MCHID || "";
    this.serialNo = process.env.WECHAT_PAY_SERIAL_NO || "";
    this.privateKey = this.formatPrivateKey(process.env.WECHAT_PAY_PRIVATE_KEY || "");
    this.apiV3Key = process.env.WECHAT_PAY_API_V3_KEY || "";
    this.notifyUrl = `${getBaseUrl()}/api/payment/cn/wechat/notify`;
  }

  /**
   * 格式化私钥为标准 PEM 格式
   * 支持多种输入格式：带/不带头尾、使用\n或实际换行
   * 支持 PKCS#1 (RSA PRIVATE KEY) 和 PKCS#8 (PRIVATE KEY) 格式
   * 微信支付 API v3 推荐使用 PKCS#8 格式
   */
  private formatPrivateKey(key: string): string {
    if (!key) return "";

    // 处理转义的换行符
    const formattedKey = key.replace(/\\n/g, "\n");

    // 检测原始格式类型
    const isPKCS1 = formattedKey.includes("RSA PRIVATE KEY");
    const hasPKCS8Header = formattedKey.includes("BEGIN PRIVATE KEY");

    // 如果已经有正确的 PEM 格式，直接返回（只需处理换行）
    if (hasPKCS8Header || isPKCS1) {
      return formattedKey.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    }

    // 移除所有空白字符（纯 base64 内容）
    const cleanKey = formattedKey.replace(/\s/g, "");

    // 每 64 个字符换行
    const lines: string[] = [];
    for (let i = 0; i < cleanKey.length; i += 64) {
      lines.push(cleanKey.substring(i, i + 64));
    }

    // 默认使用 PKCS#8 格式
    const header = "-----BEGIN PRIVATE KEY-----";
    const footer = "-----END PRIVATE KEY-----";

    return `${header}\n${lines.join("\n")}\n${footer}`;
  }

  /**
   * 生成随机字符串
   */
  private generateNonceStr(length: number = 32): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成时间戳
   */
  private generateTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * 生成签名（微信支付 API v3）
   */
  private generateSignature(method: string, url: string, timestamp: number, nonceStr: string, body: string): string {
    const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(message);
    return sign.sign(this.privateKey, "base64");
  }

  /**
   * 生成 Authorization 头
   */
  private generateAuthHeader(method: string, url: string, body: string): string {
    const timestamp = this.generateTimestamp();
    const nonceStr = this.generateNonceStr();
    const signature = this.generateSignature(method, url, timestamp, nonceStr, body);

    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.serialNo}"`;
  }

  /**
   * 解密 AEAD_AES_256_GCM
   */
  private decryptAesGcm(ciphertext: string, associatedData: string, nonce: string): string {
    const key = Buffer.from(this.apiV3Key);
    const iv = Buffer.from(nonce);
    const authTag = Buffer.from(ciphertext.slice(-16), "base64");
    const data = Buffer.from(ciphertext.slice(0, -16), "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(associatedData));

    let decrypted = decipher.update(data, undefined, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  async createOrder(
    amount: number,
    userId: string,
    method: PaymentMethodCN,
    options: {
      currency?: string;
      description?: string;
      billingCycle?: string;
      planType?: string;
      mode?: PaymentModeCN;
      returnUrl?: string;
    } = {}
  ): Promise<{
    orderId: string;
    qrCodeUrl?: string;
    paymentUrl?: string;
    prepayId?: string;
  }> {
    // 检查配置
    if (!this.appId || !this.mchId || !this.privateKey || !this.apiV3Key) {
      throw new Error("微信支付配置不完整，请检查环境变量");
    }

    const orderId = generateOrderIdCN();
    const amountInCents = Math.round(amount * 100); // 转换为分

    const baseRequestBody = {
      appid: this.appId,
      mchid: this.mchId,
      description: options.description || `${options.planType || "Pro"} 会员 - ${options.billingCycle === "yearly" ? "年度" : "月度"}`,
      out_trade_no: orderId,
      notify_url: this.notifyUrl,
      amount: {
        total: amountInCents,
        currency: "CNY",
      },
      attach: JSON.stringify({
        userId,
        planType: options.planType,
        billingCycle: options.billingCycle,
      }),
    };

    // Native 扫码支付（微信只支持二维码模式）
    const url = "/v3/pay/transactions/native";
    const body = JSON.stringify(baseRequestBody);
    const authorization = this.generateAuthHeader("POST", url, body);

    try {
      const response = await fetch(`https://api.mch.weixin.qq.com${url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": authorization,
        },
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("微信支付创建订单失败:", data);
        throw new Error(data.message || "微信支付创建订单失败");
      }

      return {
        orderId,
        qrCodeUrl: data.code_url,
      };
    } catch (error: any) {
      console.error("微信支付创建订单错误:", error);
      throw new Error(`微信支付创建订单失败: ${error.message}`);
    }
  }

  async verifyPayment(params: any): Promise<PaymentResultCN> {
    try {
      // 验证签名
      const { resource, event_type } = params;
      
      if (event_type !== "TRANSACTION.SUCCESS") {
        return {
          success: false,
          orderId: "",
          error: `非成功事件: ${event_type}`,
        };
      }

      // 解密通知数据
      const decrypted = this.decryptAesGcm(
        resource.ciphertext,
        resource.associated_data,
        resource.nonce
      );

      const paymentData = JSON.parse(decrypted);

      if (paymentData.trade_state !== "SUCCESS") {
        return {
          success: false,
          orderId: paymentData.out_trade_no,
          error: `支付状态: ${paymentData.trade_state}`,
        };
      }

      return {
        success: true,
        orderId: paymentData.out_trade_no,
        transactionId: paymentData.transaction_id,
      };
    } catch (error: any) {
      console.error("微信支付回调验证失败:", error);
      return {
        success: false,
        orderId: "",
        error: error.message,
      };
    }
  }

  async queryOrder(orderId: string): Promise<PaymentOrderCN> {
    const url = `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${this.mchId}`;
    const authorization = this.generateAuthHeader("GET", url, "");

    const response = await fetch(`https://api.mch.weixin.qq.com${url}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": authorization,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "查询订单失败");
    }

    const statusMap: Record<string, PaymentOrderCN["status"]> = {
      SUCCESS: "completed",
      NOTPAY: "pending",
      CLOSED: "cancelled",
      PAYERROR: "failed",
    };

    return {
      id: orderId,
      amount: data.amount.total / 100,
      currency: "CNY",
      status: statusMap[data.trade_state] || "pending",
      userId: JSON.parse(data.attach || "{}").userId || "",
      createdAt: new Date(data.success_time || Date.now()),
      metadata: {
        transactionId: data.transaction_id,
        tradeState: data.trade_state,
      },
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    const url = `/v3/pay/transactions/out-trade-no/${orderId}/close`;
    const body = JSON.stringify({ mchid: this.mchId });
    const authorization = this.generateAuthHeader("POST", url, body);

    const response = await fetch(`https://api.mch.weixin.qq.com${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": authorization,
      },
      body,
    });

    if (!response.ok && response.status !== 204) {
      const data = await response.json();
      throw new Error(data.message || "关闭订单失败");
    }
  }

  async refund(orderId: string, amount: number, reason?: string): Promise<PaymentResultCN> {
    const refundNo = `RF${generateOrderIdCN()}`;
    const url = "/v3/refund/domestic/refunds";
    
    const requestBody = {
      out_trade_no: orderId,
      out_refund_no: refundNo,
      reason: reason || "用户申请退款",
      amount: {
        refund: Math.round(amount * 100),
        total: Math.round(amount * 100),
        currency: "CNY",
      },
    };

    const body = JSON.stringify(requestBody);
    const authorization = this.generateAuthHeader("POST", url, body);

    const response = await fetch(`https://api.mch.weixin.qq.com${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": authorization,
      },
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        orderId,
        error: data.message || "退款失败",
      };
    }

    return {
      success: true,
      orderId,
      transactionId: data.refund_id,
    };
  }
}

// ============================================
// 支付宝支付适配器
// ============================================

/**
 * 支付宝当面付适配器
 * 
 * 使用扫码支付（预创建接口）
 * 文档：https://opendocs.alipay.com/apis/api_1/alipay.trade.precreate
 */
class AlipayAdapter implements PaymentAdapterCN {
  private appId: string;
  private privateKey: string;
  private publicKey: string;
  private notifyUrl: string;
  private gatewayUrl: string;

  constructor() {
    this.appId = process.env.ALIPAY_APP_ID || "";
    this.privateKey = (process.env.ALIPAY_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    this.publicKey = (process.env.ALIPAY_PUBLIC_KEY || "").replace(/\\n/g, "\n");
    this.notifyUrl = `${getBaseUrl()}/api/payment/cn/alipay/notify`;
    this.gatewayUrl = process.env.ALIPAY_GATEWAY_URL || "https://openapi.alipay.com/gateway.do";
  }

  /**
   * 格式化私钥
   */
  private formatPrivateKey(key: string): string {
    if (key.includes("-----BEGIN")) return key;
    return `-----BEGIN RSA PRIVATE KEY-----\n${key}\n-----END RSA PRIVATE KEY-----`;
  }

  /**
   * 格式化公钥
   */
  private formatPublicKey(key: string): string {
    if (key.includes("-----BEGIN")) return key;
    return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
  }

  /**
   * 生成签名（RSA2）
   */
  private generateSignature(params: Record<string, string>): string {
    // 按照支付宝要求排序参数
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys
      .filter((key) => params[key] !== undefined && params[key] !== "")
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signStr, "utf8");
    return sign.sign(this.formatPrivateKey(this.privateKey), "base64");
  }

  /**
   * 验证签名
   */
  private verifySignature(params: Record<string, string>, sign: string): boolean {
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys
      .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== undefined && params[key] !== "")
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(signStr, "utf8");
    return verify.verify(this.formatPublicKey(this.publicKey), sign, "base64");
  }

  /**
   * 调用支付宝接口
   */
  private async callAlipayApi(method: string, bizContent: Record<string, any>): Promise<any> {
    const timestamp = getBeijingTimestamp();

    const params: Record<string, string> = {
      app_id: this.appId,
      method,
      format: "JSON",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp,
      version: "1.0",
      notify_url: this.notifyUrl,
      biz_content: JSON.stringify(bizContent),
    };

    params.sign = this.generateSignature(params);

    const formBody = Object.keys(params)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join("&");

    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: formBody,
    });

    const data = await response.json();
    const responseKey = method.replace(/\./g, "_") + "_response";
    
    return data[responseKey];
  }

  async createOrder(
    amount: number,
    userId: string,
    method: PaymentMethodCN,
    options: {
      currency?: string;
      description?: string;
      billingCycle?: string;
      planType?: string;
      mode?: PaymentModeCN;
      returnUrl?: string;
    } = {}
  ): Promise<{
    orderId: string;
    qrCodeUrl?: string;
    paymentUrl?: string;
  }> {
    // 检查配置
    if (!this.appId || !this.privateKey || !this.publicKey) {
      throw new Error("支付宝配置不完整，请检查环境变量");
    }

    const mode = options.mode || "qrcode";
    const orderId = generateOrderIdCN();

    const baseBizContent = {
      out_trade_no: orderId,
      total_amount: amount.toFixed(2),
      subject: options.description || `${options.planType || "Pro"} 会员 - ${options.billingCycle === "yearly" ? "年度" : "月度"}`,
      passback_params: encodeURIComponent(JSON.stringify({
        userId,
        planType: options.planType,
        billingCycle: options.billingCycle,
      })),
    };

    try {
      if (mode === "page") {
        // 电脑网站支付（PC端跳转）
        const bizContent = {
          ...baseBizContent,
          product_code: "FAST_INSTANT_TRADE_PAY",
        };

        // 构建支付宝电脑网站支付链接
        const timestamp = getBeijingTimestamp();

        const params: Record<string, string> = {
          app_id: this.appId,
          method: "alipay.trade.page.pay",
          format: "JSON",
          charset: "utf-8",
          sign_type: "RSA2",
          timestamp,
          version: "1.0",
          notify_url: this.notifyUrl,
          return_url: options.returnUrl || `${getBaseUrl()}/payment/result`,
          biz_content: JSON.stringify(bizContent),
        };

        params.sign = this.generateSignature(params);

        // 构建完整的支付 URL
        const paymentUrl = `${this.gatewayUrl}?${Object.keys(params)
          .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
          .join("&")}`;

        return {
          orderId,
          paymentUrl,
        };
      } else {
        // 扫码支付（当面付）
        const response = await this.callAlipayApi("alipay.trade.precreate", baseBizContent);

        if (response.code !== "10000") {
          console.error("支付宝创建订单失败:", response);
          throw new Error(response.sub_msg || response.msg || "支付宝创建订单失败");
        }

        return {
          orderId,
          qrCodeUrl: response.qr_code,
        };
      }
    } catch (error: any) {
      console.error("支付宝创建订单错误:", error);
      throw new Error(`支付宝创建订单失败: ${error.message}`);
    }
  }

  async verifyPayment(params: Record<string, string>): Promise<PaymentResultCN> {
    try {
      const sign = params.sign;
      
      // 验证签名
      if (!this.verifySignature(params, sign)) {
        return {
          success: false,
          orderId: params.out_trade_no || "",
          error: "签名验证失败",
        };
      }

      // 检查交易状态
      if (params.trade_status !== "TRADE_SUCCESS" && params.trade_status !== "TRADE_FINISHED") {
        return {
          success: false,
          orderId: params.out_trade_no,
          error: `交易状态: ${params.trade_status}`,
        };
      }

      return {
        success: true,
        orderId: params.out_trade_no,
        transactionId: params.trade_no,
      };
    } catch (error: any) {
      console.error("支付宝回调验证失败:", error);
      return {
        success: false,
        orderId: "",
        error: error.message,
      };
    }
  }

  async queryOrder(orderId: string): Promise<PaymentOrderCN> {
    const bizContent = {
      out_trade_no: orderId,
    };

    const response = await this.callAlipayApi("alipay.trade.query", bizContent);

    if (response.code !== "10000") {
      throw new Error(response.sub_msg || response.msg || "查询订单失败");
    }

    const statusMap: Record<string, PaymentOrderCN["status"]> = {
      TRADE_SUCCESS: "completed",
      TRADE_FINISHED: "completed",
      WAIT_BUYER_PAY: "pending",
      TRADE_CLOSED: "cancelled",
    };

    let passbackParams = {};
    try {
      passbackParams = JSON.parse(decodeURIComponent(response.passback_params || "{}"));
    } catch {}

    return {
      id: orderId,
      amount: parseFloat(response.total_amount),
      currency: "CNY",
      status: statusMap[response.trade_status] || "pending",
      userId: (passbackParams as any).userId || "",
      createdAt: new Date(response.send_pay_date || Date.now()),
      tradeNo: response.trade_no,
      metadata: {
        tradeNo: response.trade_no,
        tradeStatus: response.trade_status,
      },
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    const bizContent = {
      out_trade_no: orderId,
    };

    const response = await this.callAlipayApi("alipay.trade.cancel", bizContent);

    if (response.code !== "10000") {
      throw new Error(response.sub_msg || response.msg || "取消订单失败");
    }
  }

  async refund(orderId: string, amount: number, reason?: string): Promise<PaymentResultCN> {
    const refundNo = `RF${generateOrderIdCN()}`;
    
    const bizContent = {
      out_trade_no: orderId,
      refund_amount: amount.toFixed(2),
      out_request_no: refundNo,
      refund_reason: reason || "用户申请退款",
    };

    const response = await this.callAlipayApi("alipay.trade.refund", bizContent);

    if (response.code !== "10000") {
      return {
        success: false,
        orderId,
        error: response.sub_msg || response.msg || "退款失败",
      };
    }

    return {
      success: true,
      orderId,
      transactionId: response.trade_no,
    };
  }
}

// ============================================
// 工厂函数和辅助函数
// ============================================

/**
 * 创建支付适配器实例（中国版）
 */
export function createPaymentAdapterCN(method: PaymentMethodCN): PaymentAdapterCN {
  if (method === "wechat") {
    return new WeChatPayAdapter();
  } else if (method === "alipay") {
    return new AlipayAdapter();
  } else {
    throw new Error(`不支持的支付方式: ${method}`);
  }
}

/**
 * 获取支付实例（中国版）
 */
export function getPaymentCN(method: PaymentMethodCN): PaymentAdapterCN {
  return createPaymentAdapterCN(method);
}

/**
 * 获取支付货币（中国版）
 */
export function getPaymentCurrencyCN(): string {
  return "CNY";
}

/**
 * 格式化金额显示（中国版）
 */
export function formatAmountCN(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

/**
 * 生成订单号（中国版）
 * 格式：日期 + 随机数
 */
export function generateOrderIdCN(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = date.getTime().toString().slice(-6);
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CN${dateStr}${timeStr}${randomStr}`;
}
