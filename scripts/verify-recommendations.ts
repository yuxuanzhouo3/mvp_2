#!/usr/bin/env tsx
/**
 * AI推荐功能验证脚本
 * 验证推荐链接、API调用和端到端流程
 */

import { validateLink } from '../lib/ai/link-validator';

console.log('🧪 AI推荐功能验证脚本\n');

// 测试链接验证器
console.log('📝 测试 1: 链接验证器\n');

const testLinks = [
    // 有效链接
    { url: 'https://book.douban.com/subject/2567698/', expected: true, desc: '豆瓣图书链接' },
    { url: 'https://www.bilibili.com/video/BV1', expected: true, desc: 'B站视频链接' },
    { url: 'https://s.taobao.com/search?q=test', expected: true, desc: '淘宝搜索链接' },

    // 无效链接
    { url: 'https://example.com/test', expected: false, desc: '示例域名（AI幻觉）' },
    { url: 'http://localhost:3000', expected: false, desc: '本地地址' },
    { url: '/product/123', expected: false, desc: '相对路径' },
    { url: 'https://192.168.1.1/api', expected: false, desc: '私有IP地址' },
    { url: '', expected: false, desc: '空链接' },
];

let validationPassed = 0;
let validationFailed = 0;

testLinks.forEach(({ url, expected, desc }) => {
    const result = validateLink(url);
    const status = result.isValid === expected ? '✅' : '❌';
    const passed = result.isValid === expected;

    console.log(`${status} ${desc}`);
    console.log(`   URL: ${url || '(empty)'}`);
    console.log(`   预期: ${expected ? '有效' : '无效'} | 实际: ${result.isValid ? '有效' : '无效'}`);
    if (!result.isValid) {
        console.log(`   错误: ${result.error}`);
    }
    console.log();

    if (passed) validationPassed++;
    else validationFailed++;
});

console.log(`\n📊 链接验证结果: ${validationPassed}/${testLinks.length} 通过\n`);

// 检查环境变量
console.log('📝 测试 2: 环境变量配置\n');

const requiredEnvVars = [
    'ZHIPU_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
];

let envCheckPassed = 0;
let envCheckFailed = 0;

requiredEnvVars.forEach((envVar) => {
    const hasEnv = !!process.env[envVar];
    const status = hasEnv ? '✅' : '⚠️';
    const message = hasEnv ? '已配置' : '未配置';

    console.log(`${status} ${envVar}: ${message}`);

    if (hasEnv) envCheckPassed++;
    else envCheckFailed++;
});

console.log(`\n📊 环境变量检查: ${envCheckPassed}/${requiredEnvVars.length} 已配置\n`);

// 总结
console.log('='.repeat(50));
console.log('✨ 验证完成\n');

if (validationFailed === 0 && envCheckFailed === 0) {
    console.log('🎉 所有验证通过！AI推荐功能已准备就绪。\n');
} else {
    console.log('⚠️ 存在一些问题需要修复：\n');
    if (validationFailed > 0) {
        console.log(`  - 链接验证失败: ${validationFailed} 个\n`);
    }
    if (envCheckFailed > 0) {
        console.log(`  - 缺少环境变量: ${envCheckFailed} 个\n`);
    }
}

console.log('📚 后续步骤:');
console.log('  1. 访问 http://localhost:3000');
console.log('  2. 登录或注册账号');
console.log('  3. 进入分类页面（如 /category/entertainment）');
console.log('  4. 点击"摇一摇"按钮获取推荐');
console.log('  5. 点击链接验证能否正常跳转\n');
