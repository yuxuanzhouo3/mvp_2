/**
 * 支付系统初始化 - 国际版
 */

import { getPaymentCurrency } from "./adapter";

export function initPayment() {
  const currency = getPaymentCurrency();
  console.log(`💰 Payment system initialized for ${currency} currency`);

  // 可以在这里添加支付系统的初始化逻辑
  // 比如验证环境变量、连接测试等
}

export default initPayment;
