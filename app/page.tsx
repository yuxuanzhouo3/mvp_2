"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Settings, Globe, Crown } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import { useTranslations } from "@/lib/i18n"

const categoryIds = ["entertainment", "shopping", "food", "travel", "fitness"] as const

const categoryIcons: Record<string, string> = {
  entertainment: "🎲",
  shopping: "🛍️",
  food: "🍜",
  travel: "🏞️",
  fitness: "💪",
}

const categoryColors: Record<string, string> = {
  entertainment: "from-purple-400 to-pink-400",
  shopping: "from-blue-400 to-cyan-400",
  food: "from-green-400 to-teal-400",
  travel: "from-yellow-400 to-orange-400",
  fitness: "from-red-400 to-pink-400",
}

export default function HomePage() {
  const { user, isAuthenticated, signOut } = useAuth()
  const { language, toggleLanguage } = useLanguage()
  const t = useTranslations(language)

  return (
    <div className="min-h-screen bg-[#F7F9FC] p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pt-6 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t.randomLife.title}</h1>
            <p className="text-gray-600 text-sm">{t.randomLife.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleLanguage}
              title={t.header.switchLanguage}
            >
              <Globe className="h-4 w-4" />
            </Button>
            {isAuthenticated ? (
              <>
                <Link href="/settings">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
                {/* 订阅等级显示 */}
                {user?.subscriptionTier === "enterprise" ? (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                    Enterprise
                  </span>
                ) : user?.subscriptionTier === "pro" ? (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                    Pro
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                    Free
                  </span>
                )}
                {/* Pro页面链接 */}
                <Link href="/pro">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-600 hover:text-yellow-700">
                    <Crown className="h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={() => signOut()}>{t.auth.logout}</Button>
              </>
            ) : (
              <>
                <Link href="/login"><Button size="sm" variant="secondary">{t.auth.login}</Button></Link>
                <Link href="/register"><Button size="sm">{t.auth.register}</Button></Link>
              </>
            )}
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <p className="text-gray-600">{t.randomLife.chooseCategory}</p>
        </motion.div>

        {/* Category Cards */}
        <div className="space-y-4">
          {categoryIds.map((categoryId, index) => {
            const categoryTranslation = t.randomLife.categories[categoryId]
            return (
              <motion.div
                key={categoryId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link href={`/category/${categoryId}`}>
                  <Card className="p-6 cursor-pointer hover:shadow-lg transition-all duration-300 border-0 overflow-hidden relative">
                    <div className={`absolute inset-0 bg-gradient-to-r ${categoryColors[categoryId]} opacity-10`} />
                    <div className="relative flex items-center space-x-4">
                      <motion.div
                        animate={{
                          y: [0, -5, 0],
                          rotate: [0, 5, -5, 0],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }}
                        className="text-4xl"
                      >
                        {categoryIcons[categoryId]}
                      </motion.div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-800 mb-1">{categoryTranslation.title}</h3>
                        <p className="text-gray-600 text-sm">{categoryTranslation.subtitle}</p>
                      </div>
                      <div className="text-gray-400">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-12 pb-8"
        >
          <p className="text-gray-500 text-sm">{t.randomLife.discoverNew}</p>
        </motion.div>
      </div>
    </div>
  )
}
