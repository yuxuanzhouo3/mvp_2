#!/usr/bin/env node

/**
 * Supabase Configuration Checker
 * 检查Supabase环境配置是否正确
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '.env.local')

function checkEnvironment() {
    console.log('🔍 Checking Supabase Configuration...\n')

    // Check if .env.local exists
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env.local file not found')
        process.exit(1)
    }

    const envContent = fs.readFileSync(envPath, 'utf-8')
    const envVars: Record<string, string> = {}

    // Parse .env.local
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return

        const [key, ...valueParts] = trimmed.split('=')
        envVars[key.trim()] = valueParts.join('=').trim()
    })

    // Required variables for INTL region
    const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'NEXT_PUBLIC_APP_URL',
    ]

    console.log('📋 Required Environment Variables:\n')

    let allValid = true
    requiredVars.forEach(varName => {
        const value = envVars[varName]
        if (!value) {
            console.error(`❌ ${varName}: NOT SET`)
            allValid = false
        } else if (value === 'your_placeholder_value' || value.includes('placeholder')) {
            console.warn(`⚠️  ${varName}: PLACEHOLDER VALUE (needs to be configured)`)
            allValid = false
        } else {
            // Show first 20 chars and last 10 chars for security
            const display =
                value.length > 30
                    ? `${value.substring(0, 20)}...${value.substring(value.length - 10)}`
                    : value
            console.log(`✅ ${varName}: ${display}`)
        }
    })

    console.log('\n📍 URL Configuration:\n')

    const appUrl = envVars['NEXT_PUBLIC_APP_URL']
    const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']

    if (appUrl) {
        console.log(`✅ App URL: ${appUrl}`)
        console.log(`   Callback URL: ${appUrl}/auth/callback`)
    } else {
        console.error('❌ App URL not configured')
        allValid = false
    }

    if (supabaseUrl) {
        console.log(`✅ Supabase URL: ${supabaseUrl}`)
    } else {
        console.error('❌ Supabase URL not configured')
        allValid = false
    }

    console.log('\n⚙️  Configuration Checklist:\n')

    const checklist = [
        {
            item: 'Supabase URL is set',
            check: !!envVars['NEXT_PUBLIC_SUPABASE_URL'],
        },
        {
            item: 'Supabase Anon Key is set',
            check: !!envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
        },
        {
            item: 'Service Role Key is set',
            check: !!envVars['SUPABASE_SERVICE_ROLE_KEY'],
        },
        {
            item: 'App URL is configured',
            check: !!envVars['NEXT_PUBLIC_APP_URL'],
        },
        {
            item: 'Deployment region is INTL',
            check: envVars['NEXT_PUBLIC_DEPLOYMENT_REGION'] === 'INTL',
        },
    ]

    checklist.forEach(({ item, check }) => {
        console.log(`${check ? '✅' : '❌'} ${item}`)
    })

    console.log('\n📝 Manual Configuration Steps:\n')
    console.log('1. Visit https://app.supabase.com')
    console.log('2. Select your project: akffdzyqkbodxjjvwabt')
    console.log('3. Go to Authentication > URL Configuration')
    console.log('4. Add these Redirect URLs:')
    console.log('   - http://localhost:3000/auth/callback')
    console.log('   - https://random-life-seven.vercel.app/auth/callback')
    console.log('5. Verify Email provider is enabled')
    console.log('6. Check SMTP settings are configured')

    if (!allValid) {
        console.error('\n❌ Configuration issues found. Please fix the above.')
        process.exit(1)
    }

    console.log('\n✅ All configuration checks passed!')
    console.log('\nYou can now run: npm run dev')
}

checkEnvironment()
