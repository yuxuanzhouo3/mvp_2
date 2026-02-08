#!/usr/bin/env node

import { isValidPlatformLink } from '../lib/search/platform-validator'

const samples = [
  { platform: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { platform: 'TripAdvisor', url: 'https://www.tripadvisor.com/Search?q=travel' },
]

let passed = 0
for (const item of samples) {
  const ok = isValidPlatformLink(item.url, item.platform)
  if (ok) passed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${item.platform} -> ${item.url}`)
}

console.log(`Result: ${passed}/${samples.length}`)

