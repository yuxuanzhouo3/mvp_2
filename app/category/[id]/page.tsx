"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Recommendation {
  id: string
  type: string
  title: string
  description?: string
  image?: string
  price?: string
  calories?: number
  reason?: string
  duration?: string
  weather?: string
}

const categoryConfig = {
  entertainment: {
    title: "随机娱乐",
    icon: "🎲",
    color: "from-purple-400 to-pink-400",
  },
  shopping: {
    title: "随机购物",
    icon: "🛍️",
    color: "from-blue-400 to-cyan-400",
  },
  food: {
    title: "随机吃",
    icon: "🍜",
    color: "from-green-400 to-teal-400",
  },
  travel: {
    title: "随机出行",
    icon: "🏞️",
    color: "from-yellow-400 to-orange-400",
  },
  fitness: {
    title: "随机健身",
    icon: "💪",
    color: "from-red-400 to-pink-400",
  },
}

export default function CategoryPage({ params }: { params: { id: string } }) {
  const [currentRecommendation, setCurrentRecommendation] = useState<Recommendation | null>(null)
  const [history, setHistory] = useState<Recommendation[]>([])
  const [isShaking, setIsShaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const category = categoryConfig[params.id as keyof typeof categoryConfig]

  useEffect(() => {
    // Load history from localStorage
    const savedHistory = localStorage.getItem(`history_${params.id}`)
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [params.id])

  const handleShake = async () => {
    setIsShaking(true)
    setIsLoading(true)

    try {
      const response = await fetch(`/api/recommend/${params.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: "default" }),
      })

      const recommendation = await response.json()

      setTimeout(() => {
        setCurrentRecommendation(recommendation)

        // Update history
        const newHistory = [recommendation, ...history.slice(0, 2)]
        setHistory(newHistory)
        localStorage.setItem(`history_${params.id}`, JSON.stringify(newHistory))

        setIsShaking(false)
        setIsLoading(false)
      }, 1500)
    } catch (error) {
      console.error("Error fetching recommendation:", error)
      setIsShaking(false)
      setIsLoading(false)
    }
  }

  const renderRecommendation = (rec: Recommendation) => {
    switch (params.id) {
      case "entertainment":
        return (
          <Card className="p-6 text-center">
            <div className="w-32 h-48 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-4xl">
                {rec.type === "sci-fi" ? "📚" : rec.type === "game" ? "🎮" : rec.type === "song" ? "🎵" : "🎬"}
              </span>
            </div>
            <h3 className="text-xl font-semibold mb-2">{rec.title}</h3>
            <p className="text-gray-600">{rec.description}</p>
          </Card>
        )

      case "shopping":
        return (
          <Card className="p-6 text-center">
            <div className="w-32 h-32 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-4xl">
                {rec.type === "fashion" ? "👕" : rec.type === "shoes" ? "👟" : rec.type === "gadget" ? "📱" : "🏠"}
              </span>
            </div>
            <h3 className="text-xl font-semibold mb-2">{rec.title}</h3>
            <p className="text-2xl font-bold text-[#FF6B6B] mb-4">{rec.price}</p>
            <Button className="w-full bg-[#FF6B6B] hover:bg-[#FF5252]">Buy Now</Button>
          </Card>
        )

      case "food":
        return (
          <Card className="p-6 text-center">
            <Badge className="mb-4 bg-[#4ECDC4] text-white">AI Recommendation</Badge>
            <div className="w-32 h-32 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-4xl">🍜</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">{rec.title}</h3>
            {rec.reason && <p className="text-sm text-gray-600 mb-2">{rec.reason}</p>}
            {rec.calories && <p className="text-lg font-medium text-[#4ECDC4]">{rec.calories} calories</p>}
          </Card>
        )

      case "travel":
      case "fitness":
        return (
          <Card className="p-6 text-center">
            <div className="w-full h-32 mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-4xl">{params.id === "travel" ? "🗺️" : "🏃‍♂️"}</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">{rec.title}</h3>
            <p className="text-gray-600 mb-2">{rec.description}</p>
            {rec.duration && <p className="text-sm text-gray-500 mb-1">Duration: {rec.duration}</p>}
            {rec.weather && <p className="text-sm text-gray-500">Weather: {rec.weather}</p>}
          </Card>
        )

      default:
        return null
    }
  }

  if (!category) {
    return <div>Category not found</div>
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8 pt-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </Button>
          </Link>
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{category.icon}</span>
            <h1 className="text-2xl font-bold text-gray-800">{category.title}</h1>
          </div>
        </div>

        {/* Shake Button */}
        <div className="text-center mb-8">
          <motion.div
            animate={
              isShaking
                ? {
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.1, 1, 1.1, 1],
                  }
                : {}
            }
            transition={{ duration: 0.5, repeat: isShaking ? Number.POSITIVE_INFINITY : 0 }}
          >
            <Button
              onClick={handleShake}
              disabled={isLoading}
              className="w-32 h-32 rounded-full bg-[#FF6B6B] hover:bg-[#FF5252] text-white text-lg font-semibold shadow-lg"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  ⏳
                </motion.div>
              ) : (
                "摇一摇"
              )}
            </Button>
          </motion.div>
          <p className="text-gray-600 mt-4">Tap to get a random recommendation</p>
        </div>

        {/* Current Recommendation */}
        <AnimatePresence mode="wait">
          {currentRecommendation && (
            <motion.div
              key={currentRecommendation.id}
              initial={{ opacity: 0, rotateY: -90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: 90 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              {renderRecommendation(currentRecommendation)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent History</h2>
            <div className="space-y-3">
              {history.map((item, index) => (
                <motion.div
                  key={`${item.id}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-xl">
                          {params.id === "entertainment"
                            ? "🎭"
                            : params.id === "shopping"
                              ? "🛒"
                              : params.id === "food"
                                ? "🍽️"
                                : "🏃‍♂️"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{item.title}</h4>
                        <p className="text-sm text-gray-600 truncate">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
