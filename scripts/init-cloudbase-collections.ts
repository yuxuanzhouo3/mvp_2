/**
 * CloudBase 集合初始化脚本
 * 
 * 用于在 CloudBase 中创建所需的集合和索引
 * 
 * 使用方法：
 * 1. 确保环境变量已正确配置（支持 .env 和 .env.local）
 * 2. 运行：npx tsx scripts/init-cloudbase-collections.ts
 */

import cloudbase from '@cloudbase/node-sdk';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// ==================== 环境变量加载（支持 Next.js 风格） ====================
function loadEnvFiles() {
  // 1. 先加载 .env（如果存在）
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('[dotenv] Loaded .env');
  } else {
    console.log('[dotenv] No .env file found');
  }

  // 2. 再加载 .env.local（优先级更高，会覆盖 .env）
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
    console.log('[dotenv] Loaded .env.local (overrides .env)');
  } else {
    console.log('[dotenv] No .env.local file found');
  }
}

loadEnvFiles();

// CloudBase 集合定义（保持不变）
const COLLECTIONS = {
  // 用户相关
  USERS: {
    name: 'users',
    indexes: [
      { name: 'email_index', field: 'email', unique: true },
      { name: 'created_at_index', field: 'createdAt' },
    ],
  },
  USER_PROFILES: {
    name: 'user_profiles',
    indexes: [
      { name: 'email_index', field: 'email' },
      { name: 'subscription_tier_index', field: 'subscription_tier' },
    ],
  },
  AUTH_EMAIL_CODES: {
    name: 'auth_email_codes',
    indexes: [
      { name: 'email_index', field: 'email' },
      { name: 'purpose_index', field: 'purpose' },
      { name: 'created_at_index', field: 'createdAt', order: 'desc' },
      { name: 'expires_at_index', field: 'expiresAt' },
    ],
  },

  // 推荐系统相关
  RECOMMENDATION_HISTORY: {
    name: 'recommendation_history',
    indexes: [
      { name: 'user_id_index', field: 'user_id' },
      { name: 'category_index', field: 'category' },
      { name: 'user_category_index', fields: ['user_id', 'category'] },
      { name: 'created_at_index', field: 'created_at', order: 'desc' },
    ],
  },
  USER_PREFERENCES: {
    name: 'user_preferences',
    indexes: [
      { name: 'user_id_index', field: 'user_id' },
      { name: 'category_index', field: 'category' },
      { name: 'user_category_unique', fields: ['user_id', 'category'], unique: true },
    ],
  },
  RECOMMENDATION_CLICKS: {
    name: 'recommendation_clicks',
    indexes: [
      { name: 'user_id_index', field: 'user_id' },
      { name: 'recommendation_id_index', field: 'recommendation_id' },
      { name: 'action_index', field: 'action' },
      { name: 'clicked_at_index', field: 'clicked_at', order: 'desc' },
    ],
  },
  RECOMMENDATION_CACHE: {
    name: 'recommendation_cache',
    indexes: [
      { name: 'category_index', field: 'category' },
      { name: 'preference_hash_index', field: 'preference_hash' },
      { name: 'category_hash_unique', fields: ['category', 'preference_hash'], unique: true },
      { name: 'expires_at_index', field: 'expires_at' },
    ],
  },
  RECOMMENDATION_USAGE: {
    name: 'recommendation_usage',
    indexes: [
      { name: 'user_id_index', field: 'user_id' },
      { name: 'created_at_index', field: 'created_at', order: 'desc' },
      { name: 'user_id_created_at_index', fields: ['user_id', 'created_at'] },
    ],
  },

  // 用户 Onboarding 相关
  ONBOARDING_PROGRESS: {
    name: 'onboarding_progress',
    indexes: [
      { name: 'user_id_index', field: 'user_id', unique: true },
      { name: 'updated_at_index', field: 'updated_at', order: 'desc' },
    ],
  },

  // 订阅和支付相关
  USER_SUBSCRIPTIONS: {
    name: 'user_subscriptions',
    indexes: [
      { name: 'user_id_index', field: 'user_id' },
      { name: 'status_index', field: 'status' },
      { name: 'subscription_end_index', field: 'subscription_end' },
    ],
  },
  PAYMENTS: {
    name: 'payments',
    indexes: [
      { name: 'user_id_index', field: 'user_id' },
      { name: 'status_index', field: 'status' },
      { name: 'transaction_id_index', field: 'transaction_id' },
      { name: 'created_at_index', field: 'created_at', order: 'desc' },
    ],
  },
  SUBSCRIPTIONS: {
    name: 'subscriptions',
    indexes: [
      { name: 'user_id_index', field: 'user_id' },
      { name: 'status_index', field: 'status' },
    ],
  },

  ANALYTICS_EVENTS: {
    name: 'analytics_events',
    indexes: [
      { name: 'event_type_index', field: 'event_type' },
      { name: 'created_at_index', field: 'created_at', order: 'desc' },
      { name: 'session_id_index', field: 'session_id' },
      { name: 'user_id_index', field: 'user_id' },
    ],
  },

  // 用户反馈相关
  USER_FEEDBACKS: {
    name: 'user_feedbacks',
    indexes: [
      { name: 'user_id_index', field: 'user_id' },
      { name: 'recommendation_id_index', field: 'recommendation_id' },
      { name: 'feedback_type_index', field: 'feedback_type' },
      { name: 'created_at_index', field: 'created_at', order: 'desc' },
    ],
  },
  RELEASES: {
    name: 'releases',
    indexes: [
      { name: 'platform_index', field: 'platform' },
      { name: 'arch_index', field: 'arch' },
      { name: 'active_index', field: 'active' },
      { name: 'created_at_index', field: 'created_at', order: 'desc' },
    ],
  },
  ASSISTANT_NEARBY_STORES: {
    name: 'assistant_nearby_stores',
    indexes: [
      { name: 'region_index', field: 'region' },
      { name: 'city_index', field: 'city' },
      { name: 'category_index', field: 'category' },
      { name: 'is_active_index', field: 'is_active' },
      { name: 'region_category_active_index', fields: ['region', 'category', 'is_active'] },
      { name: 'latitude_index', field: 'latitude' },
      { name: 'longitude_index', field: 'longitude' },
    ],
  },
};

async function initCloudBase() {
  const envId = process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID;
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;

  if (!envId || !secretId || !secretKey) {
    console.error('❌ Missing CloudBase environment variables:');
    console.error('  - NEXT_PUBLIC_WECHAT_CLOUDBASE_ID:', envId ? '✓' : '✗');
    console.error('  - CLOUDBASE_SECRET_ID:', secretId ? '✓' : '✗');
    console.error('  - CLOUDBASE_SECRET_KEY:', secretKey ? '✓' : '✗');
    console.error('\n💡 Tip: Variables should be defined in .env or .env.local in project root.');
    process.exit(1);
  }

  console.log(`\n🚀 Initializing CloudBase environment: ${envId}\n`);

  const app = cloudbase.init({
    env: envId,
    secretId,
    secretKey,
  });

  const db = app.database();

  return { app, db };
}

async function createCollection(db: any, collectionName: string): Promise<boolean> {
  try {
    // 检查集合是否已存在
    const result = await db.collection(collectionName).count();
    console.log(`  ✓ Collection '${collectionName}' already exists (${result.total} documents)`);
    return true;
  } catch (error: any) {
    if (error.code === 'DATABASE_COLLECTION_NOT_EXIST') {
      try {
        await db.createCollection(collectionName);
        console.log(`  ✓ Created collection '${collectionName}'`);
        return true;
      } catch (createError: any) {
        console.error(`  ✗ Failed to create collection '${collectionName}':`, createError.message);
        return false;
      }
    }
    console.error(`  ✗ Error checking collection '${collectionName}':`, error.message);
    return false;
  }
}

async function main() {
  try {
    const { db } = await initCloudBase();

    console.log('📦 Creating collections...\n');

    let successCount = 0;
    let failCount = 0;

    for (const [key, config] of Object.entries(COLLECTIONS)) {
      const success = await createCollection(db, config.name);
      if (success) successCount++;
      else failCount++;
    }

    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`  ✓ Successfully created/verified: ${successCount} collections`);
    if (failCount > 0) {
      console.log(`  ✗ Failed: ${failCount} collections`);
    }

    console.log('\n📝 Note:');
    console.log('  - CloudBase indexes are created automatically based on queries');
    console.log('  - For optimal performance, consider creating indexes in the CloudBase console');
    console.log('  - Recommended indexes are listed below\n');

    console.log('🔧 Index Recommendations:');
    for (const [key, config] of Object.entries(COLLECTIONS)) {
      if (config.indexes && config.indexes.length > 0) {
        console.log(`\n  ${config.name}:`);
        config.indexes.forEach((idx: any) => {
          const fields = idx.fields ? idx.fields.join(', ') : idx.field;
          const unique = idx.unique ? ' (unique)' : '';
          const order = idx.order ? ` (${idx.order})` : '';
          console.log(`    - ${idx.name}: [${fields}]${unique}${order}`);
        });
      }
    }

    console.log('\n✅ CloudBase initialization completed!\n');
  } catch (error) {
    console.error('\n❌ Initialization failed:', error);
    process.exit(1);
  }
}

main();
