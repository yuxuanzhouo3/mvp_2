# Supabase Database Setup Guide

This document provides a comprehensive guide for setting up the Supabase database for the MVP Demo Platform.

## Overview

The project requires two main database systems:
1. **AI Recommendation System** - Tables for storing user preferences, recommendation history, and click tracking
2. **Payment & Subscription System** - Tables for managing user subscriptions and payment records

## Required Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Database Tables Required

### 1. AI Recommendation System Tables

#### `recommendation_history`
Stores all AI-generated recommendations for users.

```sql
CREATE TABLE recommendation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('entertainment', 'shopping', 'food', 'travel', 'fitness')),
  title TEXT NOT NULL,
  description TEXT,
  link TEXT NOT NULL,
  link_type TEXT CHECK (link_type IN ('product', 'video', 'book', 'location', 'article', 'app', 'music', 'movie', 'game', 'restaurant', 'recipe', 'hotel', 'course', 'search')),
  metadata JSONB DEFAULT '{}',
  reason TEXT,
  clicked BOOLEAN DEFAULT FALSE,
  saved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `user_preferences`
Stores user preferences for personalization.

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('entertainment', 'shopping', 'food', 'travel', 'fitness')),
  preferences JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  click_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);
```

#### `recommendation_clicks`
Tracks user interactions with recommendations.

```sql
CREATE TABLE recommendation_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  recommendation_id UUID REFERENCES recommendation_history(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'click', 'save', 'share', 'dismiss')),
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `recommendation_cache`
Caches AI-generated recommendations to reduce API calls.

```sql
CREATE TABLE recommendation_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('entertainment', 'shopping', 'food', 'travel', 'fitness')),
  preference_hash TEXT NOT NULL,
  recommendations JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, preference_hash)
);
```

### 2. Payment & Subscription System Tables

#### `user_subscriptions`
Manages user subscription status.

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  subscription_end TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  plan_type TEXT DEFAULT 'pro',
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `payments`
Stores all payment transaction records.

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('stripe', 'paypal')),
  transaction_id TEXT,
  subscription_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

#### `subscriptions` (Legacy table for compatibility)

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `user_profiles` (Optional - for extended user data)

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Setup Instructions

### Option 1: Using Migration Scripts (Recommended)

The project includes migration scripts in the `supabase/migrations/` directory:

1. **001_ai_recommendation_tables.sql** - Sets up the AI recommendation system
2. **002_add_search_link_type.sql** - Adds 'search' as a valid link type
3. **003_fix_link_type_constraint.sql** - Fixes the link_type constraint
4. **004_payment_subscription_tables.sql** - Sets up the payment system

To apply these migrations:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Option 2: Manual Setup via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration script in order:
   - First run `001_ai_recommendation_tables.sql`
   - Then run `004_payment_subscription_tables.sql`
   - The other migrations are updates and can be run afterward

## Important Notes

### Row Level Security (RLS)
All tables have RLS policies configured:
- Users can only access their own data
- Service role has full access for backend operations

### Database Extensions Required
- `uuid-ossp` - For UUID generation

### Database Functions
The migrations include several helpful functions:
- `get_user_recommendation_history()` - Retrieves user's recommendation history
- `upsert_user_preferences()` - Updates or inserts user preferences
- `cleanup_expired_cache()` - Cleans expired recommendation cache
- `get_user_active_subscription()` - Gets user's current active subscription
- `is_user_subscribed()` - Checks if user has an active subscription

### Indexes
Performance indexes are created on:
- All `user_id` columns
- `category` columns
- `created_at` columns (with DESC order)
- `metadata` JSONB columns (using GIN index)

## Common Issues and Solutions

### 1. 502 Bad Gateway Errors
If you're experiencing 502 errors with the `/api/auth/refresh-subscription` endpoint:

- Check that the `user_subscriptions` table exists
- Verify the `SUPABASE_SERVICE_ROLE_KEY` is correctly set
- Ensure RLS policies are properly configured

### 2. Permission Errors
Ensure:
- Environment variables are correctly set
- Service role key has necessary permissions
- RLS policies allow service role access

### 3. Missing Tables
Run the migration scripts to create all required tables. Check the `supabase/migrations/` directory for the latest schema.

## Verification

After setup, you can verify the database is working by:

1. Check the tables exist in the Supabase dashboard under **Table Editor**
2. Test the API endpoints:
   - `/api/recommend/generate` - Should work with AI recommendations
   - `/api/auth/refresh-subscription` - Should update user subscription status
3. Check the browser console for any remaining errors

## Support

For issues related to:
- Database setup: Check the migration scripts and this guide
- Supabase configuration: Refer to [Supabase Documentation](https://supabase.com/docs)
- API errors: Check the browser console and server logs