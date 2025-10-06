"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

const categories = [
  {
    id: "entertainment",
    title: "随机娱乐",
    subtitle: "How to Play Today",
    icon: "🎲",
    color: "from-purple-400 to-pink-400",
  },
  {
    id: "shopping",
    title: "随机购物",
    subtitle: "What to Buy Today",
    icon: "🛍️",
    color: "from-blue-400 to-cyan-400",
  },
  {
    id: "food",
    title: "随机吃",
    subtitle: "What to Eat Today",
    icon: "🍜",
    color: "from-green-400 to-teal-400",
  },
  {
    id: "travel",
    title: "随机出行",
    subtitle: "Where to Go Today",
    icon: "🏞️",
    color: "from-yellow-400 to-orange-400",
  },
  {
    id: "fitness",
    title: "随机健身",
    subtitle: "How to Exercise Today",
    icon: "💪",
    color: "from-red-400 to-pink-400",
  },
]

export default function HomePage() {
  const { data: session } = useSession()
  return (
    <div className="min-h-screen bg-[#F7F9FC] p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pt-6 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">RandomLife</h1>
            <p className="text-gray-600 text-sm">Daily Discovery</p>
          </div>
          <div className="flex items-center gap-2">
            {(session as any)?.user?.subscriptionTier === "pro" && (
              <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">PRO</span>
            )}
            {(session as any)?.user?.subscriptionTier === "enterprise" && (
              <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 font-medium">ENTERPRISE</span>
            )}
            {session ? (
              <>
                <Link href="/settings">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/pro" className="text-sm text-blue-600">Pro</Link>
                <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>Logout</Button>
              </>
            ) : (
              <>
                <Link href="/login"><Button size="sm" variant="secondary">Login</Button></Link>
                <Link href="/register"><Button size="sm">Register</Button></Link>
              </>
            )}
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <p className="text-gray-600">Choose a category</p>
        </motion.div>

        {/* Category Cards */}
        <div className="space-y-4">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link href={`/category/${category.id}`}>
                <Card className="p-6 cursor-pointer hover:shadow-lg transition-all duration-300 border-0 overflow-hidden relative">
                  <div className={`absolute inset-0 bg-gradient-to-r ${category.color} opacity-10`} />
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
                      {category.icon}
                    </motion.div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-800 mb-1">{category.title}</h3>
                      <p className="text-gray-600 text-sm">{category.subtitle}</p>
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
          ))}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-12 pb-8"
        >
          <p className="text-gray-500 text-sm">Discover something new every day</p>
        </motion.div>
      </div>
    </div>
  )
}
