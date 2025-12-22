"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { isChinaDeployment } from "@/lib/config/deployment.config";

export default function LegalPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [isChina, setIsChina] = useState(false);

  useEffect(() => {
    setIsChina(isChinaDeployment());
  }, []);

  // 获取平台名称
  const platformName = isChina ? "辰汇个性推荐平台" : "RandomLife-DailyDiscovory";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center space-x-2 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === "zh" ? "返回" : "Back"}</span>
        </Button>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold mb-2">
            {language === "zh" ? "法律与政策" : "Legal"}
          </h1>
          <p className="text-gray-600 mb-8">
            {language === "zh"
              ? "最后更新：2025年12月"
              : "Last updated: December 2025"}
          </p>

          <Tabs defaultValue="terms" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="terms">
                {language === "zh" ? "服务条款" : "Terms"}
              </TabsTrigger>
              <TabsTrigger value="privacy">
                {language === "zh" ? "隐私政策" : "Privacy"}
              </TabsTrigger>
              <TabsTrigger value="refund">
                {language === "zh" ? "退款政策" : "Refund"}
              </TabsTrigger>
            </TabsList>

            {/* 服务条款 */}
            <TabsContent value="terms" className="space-y-6">
              {isChina ? (
                <div className="prose prose-sm max-w-none space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">1. 服务描述</h2>
                    <p className="text-gray-700">
                      {platformName} 是一个AI驱动的个性化推荐服务平台，为用户提供智能推荐服务。我们的服务包括但不限于：
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>AI 个性化推荐</strong> - 基于用户偏好的智能推荐</li>
                      <li><strong>多类别推荐</strong> - 娱乐、购物、美食、旅行、健身等多维度推荐</li>
                      <li><strong>历史记录管理</strong> - 保存和管理推荐历史</li>
                      <li><strong>用户画像</strong> - 构建个性化用户偏好画像</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">2. 用户账户</h2>
                    <p className="text-gray-700">
                      为使用 {platformName} 的完整功能，您需要注册账户。注册时请提供准确的个人信息，并负责保护账户安全。
                    </p>
                    <p className="text-gray-700 font-semibold mt-4">您同意：</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>提供真实、准确、完整的注册信息</li>
                      <li>及时更新个人信息以保持准确性</li>
                      <li>保护您的账户密码安全</li>
                      <li>对您账户下的所有活动负责</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">3. 付费服务</h2>
                    <p className="text-gray-700 mb-4">
                      {platformName} 提供免费和付费订阅计划。付费计划提供更多推荐次数和高级功能。
                    </p>
                    <p className="text-gray-700 mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <strong>重要说明：</strong>{platformName} 不提供自动续费功能。所有订阅均为用户主动购买，订阅到期后不会自动扣费。
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">4. 联系我们</h2>
                    <p className="text-gray-700">如对本服务条款有任何疑问，请联系：</p>
                    <div className="bg-gray-100 p-6 rounded-lg mt-4">
                      <p className="text-gray-700"><strong>邮箱：</strong>mornscience@gmail.com</p>
                      <p className="text-gray-700 mt-2"><strong>工作时间：</strong>周一至周五 9:00-18:00</p>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">Service</h2>
                    <p className="text-gray-700">
                      {platformName} provides AI-powered personalized recommendation services. Users can receive intelligent recommendations based on their preferences across multiple categories including entertainment, shopping, food, travel, and fitness.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">User Account</h2>
                    <p className="text-gray-700">
                      Users may log in via Email or Google. You must keep your account credentials secure and are fully responsible for all activity under your account.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">Payment (One-Time Purchase)</h2>
                    <p className="text-gray-700">
                      {platformName} offers subscription plans with one-time purchases. There are no automatic renewals. Payment is non-recurring unless explicitly stated.
                    </p>
                  </section>
                </div>
              )}
            </TabsContent>

            {/* 隐私政策 */}
            <TabsContent value="privacy" className="space-y-6">
              {isChina ? (
                <div className="prose prose-sm max-w-none space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">1. 信息收集</h2>
                    <p className="text-gray-700">我们收集以下类型的信息：</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>账户信息：</strong>邮箱、用户名、密码（加密存储）、微信昵称、头像、OpenID</li>
                      <li><strong>使用数据：</strong>推荐记录、偏好设置、访问记录</li>
                      <li><strong>设备信息：</strong>设备型号、操作系统版本、浏览器类型、IP地址</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">2. 信息使用</h2>
                    <p className="text-gray-700">我们使用收集的信息用于：</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>提供和改善个性化推荐服务</li>
                      <li>构建用户偏好画像</li>
                      <li>技术支持和客服服务</li>
                      <li>安全监控和欺诈防护</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">3. 信息保护</h2>
                    <p className="text-gray-700">我们采用行业标准的安全措施保护您的信息：</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>数据加密传输和存储</li>
                      <li>访问控制和身份验证</li>
                      <li>定期安全审计</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">4. 信息共享</h2>
                    <p className="text-gray-700">
                      我们不会出售、出租或交易您的个人信息。仅在以下情况下共享：
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>获得您的明确同意</li>
                      <li>法律要求或法院命令</li>
                      <li>保护我们的权利和财产</li>
                      <li>与可信第三方服务提供商（如支付处理）</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">5. 您的权利</h2>
                    <p className="text-gray-700">根据《个人信息保护法》，您拥有以下权利：</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>访问权：</strong>查看和访问您的个人信息</li>
                      <li><strong>更正权：</strong>更正不准确的信息</li>
                      <li><strong>删除权：</strong>删除您的账户和数据</li>
                      <li><strong>携带权：</strong>获取您的数据副本</li>
                    </ul>
                    <p className="text-gray-700 mt-4">
                      如需行使这些权利，请发送邮件至 mornscience@gmail.com，我们将在 30 个工作日内处理您的请求。
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">6. 儿童隐私</h2>
                    <p className="text-gray-700">
                      我们的服务不针对 14 岁以下的儿童。如果我们发现收集了儿童的个人信息，将立即删除。
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">7. 联系我们</h2>
                    <p className="text-gray-700">如果您对本隐私政策有任何疑问，请发送邮件至：</p>
                    <div className="bg-gray-100 p-6 rounded-lg mt-4">
                      <p className="text-gray-700"><strong>邮箱：</strong>mornscience@gmail.com</p>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">Information We Collect</h2>
                    <p className="text-gray-700">We collect only information necessary to provide recommendation services:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Login credentials (Email or Google account)</li>
                      <li>Preference data (used for personalized recommendations)</li>
                      <li>Basic device information (model, OS version)</li>
                      <li>Payment records (processed via Stripe / PayPal)</li>
                    </ul>
                    <p className="text-gray-700 mt-4">We do not collect advertising, analytics, or tracking data.</p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">How We Use Data</h2>
                    <p className="text-gray-700">Data is used to:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Provide personalized AI recommendations</li>
                      <li>Build user preference profiles</li>
                      <li>Verify and manage payment status</li>
                      <li>Deliver basic customer support</li>
                      <li>Ensure service security</li>
                    </ul>
                    <p className="text-gray-700 mt-4">We do not sell or share user data with third parties.</p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">User Rights</h2>
                    <p className="text-gray-700">Users may at any time:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Delete their recommendation history</li>
                      <li>Delete their account</li>
                      <li>Request complete deletion of personal data by emailing: support@randomlife.com</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">Children</h2>
                    <p className="text-gray-700">
                      Services are not intended for children under 13. Parents or guardians should ensure compliance.
                    </p>
                  </section>
                </div>
              )}
            </TabsContent>

            {/* 退款政策 */}
            <TabsContent value="refund" className="space-y-6">
              {isChina ? (
                <div className="prose prose-sm max-w-none space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">1. 退款条件</h2>
                    <p className="text-gray-700">在以下情况下，您可以申请退款：</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>重复扣费：</strong>系统错误导致的重复扣费</li>
                      <li><strong>服务故障：</strong>连续 7 天无法正常使用服务</li>
                      <li><strong>功能不符：</strong>实际功能与宣传严重不符</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">2. 退款流程</h2>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>提交申请：</strong>发送邮件至 mornscience@gmail.com 提交退款申请</li>
                      <li><strong>审核处理：</strong>我们将在 1-3 个工作日内审核</li>
                      <li><strong>退款确认：</strong>审核通过后发送退款确认邮件</li>
                      <li><strong>资金退回：</strong>3-7 个工作日内原路退回</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">3. 不退款情况</h2>
                    <p className="text-gray-700">以下情况不予退款：</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>超过退款时限的申请</li>
                      <li>已充分使用服务功能</li>
                      <li>因用户个人原因导致的无法使用</li>
                      <li>违反服务条款被终止服务</li>
                    </ul>
                  </section>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">Refundable Cases</h2>
                    <p className="text-gray-700">We offer refunds in the following scenarios:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Duplicate payments</li>
                      <li>Inability to access or use the service for 7 consecutive days post-purchase</li>
                      <li>Major functional failures</li>
                      <li>Accidental purchase without using features</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">Non-Refundable Cases</h2>
                    <p className="text-gray-700">Refunds are not provided if:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Services have been used extensively</li>
                      <li>Service issues are due to user network or device problems</li>
                      <li>Refund requests are submitted long after purchase</li>
                      <li>Account suspension due to violations</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">Refund Procedure</h2>
                    <p className="text-gray-700">Email: <strong>support@randomlife.com</strong></p>
                    <p className="text-gray-700 mt-4">Provide:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Account details</li>
                      <li>Payment proof</li>
                      <li>Refund reason</li>
                    </ul>
                    <p className="text-gray-700 mt-4">
                      Review takes 1-3 business days. Refunds are returned via original payment method within 3-7 business days.
                    </p>
                  </section>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
