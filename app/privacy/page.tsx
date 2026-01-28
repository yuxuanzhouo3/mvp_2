"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { getSiteInfo } from "@/lib/config/site-info";

export default function LegalPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const site = getSiteInfo();
  const isChina = site.region === "CN";

  // 获取平台名称
  const platformName = isChina ? "辰汇个性推荐" : "RandomLife-DailyDiscovory";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center space-x-2 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === "zh" ? "返回" : "Back"}</span>
        </Button>

        <div className="bg-card text-card-foreground rounded-lg shadow-sm p-8 border border-border">
          <h1 className="text-3xl font-bold mb-2">
            {language === "zh" ? "法律与政策" : "Legal & Policies"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {language === "zh"
              ? "最后更新：2025年12月"
              : "Last updated: December 2025"}
          </p>

          <div className="rounded-xl border border-border bg-muted/50 p-6 mb-8">
            <h2 className="text-lg font-semibold">
              {language === "zh" ? "基础服务信息" : "Service Information"}
            </h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {language === "zh" ? "应用名称：" : "App Name: "}
                </span>
                {platformName}
              </p>
              <p>
                <span className="font-medium text-foreground">
                  {language === "zh" ? "版权所有者/运营者：" : "Owner/Operator: "}
                </span>
                {site.ownerName}
              </p>
              <p className="break-all">
                <span className="font-medium text-foreground">
                  {language === "zh" ? "联系邮箱：" : "Contact Email: "}
                </span>
                {site.contactEmail}
              </p>
              {isChina && site.icpBeian ? (
                <p>
                  <span className="font-medium text-foreground">
                    {language === "zh" ? "网站备案：" : "ICP Filing: "}
                  </span>
                  <a
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:opacity-90 transition-opacity"
                  >
                    {site.icpBeian}
                  </a>
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/">{language === "zh" ? "首页" : "Home"}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/about">{language === "zh" ? "关于我们" : "About"}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/contact">{language === "zh" ? "联系我们" : "Contact"}</Link>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="terms" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="terms">
                <span className="text-blue-600">{language === "zh" ? "服务条款" : "Terms of Service"}</span>
              </TabsTrigger>
              <TabsTrigger value="privacy">
                <span className="text-blue-600">{language === "zh" ? "隐私政策" : "Privacy Policy"}</span>
              </TabsTrigger>
              <TabsTrigger value="refund">
                {language === "zh" ? "退款政策" : "Refund Policy"}
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
                    <h2 className="text-2xl font-bold mt-6 mb-4">1. Service Description</h2>
                    <p className="text-gray-700">
                      {platformName} is an AI-powered personalized recommendation platform that provides intelligent recommendation services to users. Our services include but are not limited to:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>AI Personalized Recommendations</strong> - Smart recommendations based on user preferences</li>
                      <li><strong>Multi-Category Recommendations</strong> - Entertainment, shopping, food, travel, fitness and more</li>
                      <li><strong>History Management</strong> - Save and manage your recommendation history</li>
                      <li><strong>User Profiles</strong> - Build personalized preference profiles</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">2. User Account</h2>
                    <p className="text-gray-700">
                      To use the full features of {platformName}, you need to register an account. Please provide accurate personal information when registering and be responsible for protecting your account security.
                    </p>
                    <p className="text-gray-700 font-semibold mt-4">You agree to:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Provide true, accurate, and complete registration information</li>
                      <li>Update your personal information promptly to maintain accuracy</li>
                      <li>Keep your account password secure</li>
                      <li>Be responsible for all activities under your account</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">3. Paid Services</h2>
                    <p className="text-gray-700 mb-4">
                      {platformName} offers both free and paid subscription plans. Paid plans provide more recommendation quotas and premium features.
                    </p>
                    <p className="text-gray-700 mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <strong>Important Notice:</strong> {platformName} does not offer automatic renewal. All subscriptions are manually purchased by users, and no automatic charges will occur when the subscription expires.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">4. Acceptable Use</h2>
                    <p className="text-gray-700">When using our services, you agree not to:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Use the service for any illegal or unauthorized purpose</li>
                      <li>Attempt to bypass, disable, or interfere with security features</li>
                      <li>Share your account credentials with others</li>
                      <li>Use automated systems to access the service without permission</li>
                      <li>Engage in any activity that disrupts or interferes with the service</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">5. Intellectual Property</h2>
                    <p className="text-gray-700">
                      All content, features, and functionality of {platformName} are owned by us and are protected by international copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">6. Limitation of Liability</h2>
                    <p className="text-gray-700">
                      {platformName} provides recommendations for informational purposes only. We are not liable for any decisions made based on our recommendations. The service is provided &quot;as is&quot; without warranties of any kind.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">7. Contact Us</h2>
                    <p className="text-gray-700">If you have any questions about these Terms of Service, please contact us:</p>
                    <div className="bg-gray-100 p-6 rounded-lg mt-4">
                      <p className="text-gray-700"><strong>Email:</strong> mornscience@gmail.com</p>
                      <p className="text-gray-700 mt-2"><strong>Business Hours:</strong> Monday - Friday, 9:00 AM - 6:00 PM (UTC)</p>
                    </div>
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
                    <h2 className="text-2xl font-bold mt-6 mb-4">1. Information We Collect</h2>
                    <p className="text-gray-700">We collect the following types of information:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Account Information:</strong> Email address, username, password (encrypted), Google account details, profile picture</li>
                      <li><strong>Usage Data:</strong> Recommendation history, preference settings, access logs</li>
                      <li><strong>Device Information:</strong> Device model, operating system version, browser type, IP address</li>
                      <li><strong>Payment Information:</strong> Transaction records processed securely via Stripe / PayPal (we do not store full payment card details)</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">2. How We Use Your Information</h2>
                    <p className="text-gray-700">We use the collected information to:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Provide and improve personalized recommendation services</li>
                      <li>Build user preference profiles for better recommendations</li>
                      <li>Process payments and manage subscriptions</li>
                      <li>Provide technical support and customer service</li>
                      <li>Ensure security monitoring and fraud prevention</li>
                      <li>Communicate service updates and important notices</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">3. Data Protection</h2>
                    <p className="text-gray-700">We employ industry-standard security measures to protect your information:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Data encryption in transit and at rest</li>
                      <li>Access control and authentication mechanisms</li>
                      <li>Regular security audits and vulnerability assessments</li>
                      <li>Secure data centers with physical security controls</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">4. Information Sharing</h2>
                    <p className="text-gray-700">
                      We do not sell, rent, or trade your personal information. We only share information in the following circumstances:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>With your explicit consent</li>
                      <li>When required by law or court order</li>
                      <li>To protect our rights and property</li>
                      <li>With trusted third-party service providers (e.g., payment processors) under strict confidentiality agreements</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">5. Your Rights</h2>
                    <p className="text-gray-700">Under applicable privacy laws (including GDPR and CCPA), you have the following rights:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Right to Access:</strong> View and access your personal information</li>
                      <li><strong>Right to Rectification:</strong> Correct inaccurate information</li>
                      <li><strong>Right to Erasure:</strong> Delete your account and data</li>
                      <li><strong>Right to Data Portability:</strong> Obtain a copy of your data</li>
                      <li><strong>Right to Object:</strong> Object to certain processing of your data</li>
                    </ul>
                    <p className="text-gray-700 mt-4">
                      To exercise these rights, please email mornscience@gmail.com. We will process your request within 30 business days.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">6. Cookies and Tracking</h2>
                    <p className="text-gray-700">
                      We use essential cookies to maintain your session and preferences. We do not use advertising or third-party tracking cookies. You can control cookie settings through your browser.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">7. Children&apos;s Privacy</h2>
                    <p className="text-gray-700">
                      Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children. If we discover that we have collected information from a child, we will delete it immediately.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">8. International Data Transfers</h2>
                    <p className="text-gray-700">
                      Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with applicable laws.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">9. Contact Us</h2>
                    <p className="text-gray-700">If you have any questions about this Privacy Policy, please contact us:</p>
                    <div className="bg-gray-100 p-6 rounded-lg mt-4">
                      <p className="text-gray-700"><strong>Email:</strong> mornscience@gmail.com</p>
                      <p className="text-gray-700 mt-2"><strong>Data Protection Officer:</strong> mornscience@gmail.com</p>
                    </div>
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
                    <h2 className="text-2xl font-bold mt-6 mb-4">1. Refund Eligibility</h2>
                    <p className="text-gray-700">You may request a refund under the following circumstances:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Duplicate Charges:</strong> System errors resulting in duplicate payments</li>
                      <li><strong>Service Outage:</strong> Inability to access or use the service for 7 consecutive days</li>
                      <li><strong>Feature Mismatch:</strong> Actual functionality significantly differs from advertised features</li>
                      <li><strong>Accidental Purchase:</strong> Unintended purchase without using any features</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">2. Refund Process</h2>
                    <p className="text-gray-700">To request a refund, please follow these steps:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li><strong>Submit Request:</strong> Email mornscience@gmail.com with your refund request</li>
                      <li><strong>Review Period:</strong> We will review your request within 1-3 business days</li>
                      <li><strong>Confirmation:</strong> You will receive a confirmation email once approved</li>
                      <li><strong>Fund Return:</strong> Refunds are processed within 3-7 business days via the original payment method</li>
                    </ul>
                    <p className="text-gray-700 mt-4">Please include the following information in your request:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Your account email address</li>
                      <li>Transaction ID or payment receipt</li>
                      <li>Reason for refund request</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">3. Non-Refundable Cases</h2>
                    <p className="text-gray-700">Refunds will not be provided in the following situations:</p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      <li>Request submitted beyond the refund time limit (30 days after purchase)</li>
                      <li>Service features have been extensively used</li>
                      <li>Issues caused by user&apos;s own network or device problems</li>
                      <li>Account terminated due to Terms of Service violations</li>
                      <li>Change of mind after significant use of the service</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mt-6 mb-4">4. Contact Us</h2>
                    <p className="text-gray-700">For refund inquiries, please contact:</p>
                    <div className="bg-gray-100 p-6 rounded-lg mt-4">
                      <p className="text-gray-700"><strong>Email:</strong> mornscience@gmail.com</p>
                      <p className="text-gray-700 mt-2"><strong>Response Time:</strong> Within 24-48 hours</p>
                    </div>
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
