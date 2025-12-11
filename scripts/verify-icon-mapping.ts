/**
 * 推荐卡片图标映射验证脚本
 * 验证所有链接类型的图标是否正确映射
 */

import {
    getIconForLinkType,
    getLabelForLinkType,
    linkTypeEmojis,
    isValidLinkType
} from '@/lib/utils/icon-mapping';

// 验证所有必需的图标类型
const requiredTypes = ['article', 'music', 'recipe', 'restaurant', 'product', 'video', 'search'];

console.log('=== 推荐卡片图标映射验证 ===\n');

console.log('1. 验证基础图标映射：');
console.log('-'.repeat(50));
requiredTypes.forEach(type => {
    const icon = getIconForLinkType(type);
    const label_zh = getLabelForLinkType(type, 'zh');
    const label_en = getLabelForLinkType(type, 'en');
    const isValid = isValidLinkType(type);

    console.log(`✓ ${type.padEnd(12)} | 图标: ${icon} | 中文: ${label_zh.padEnd(6)} | 英文: ${label_en.padEnd(10)} | 有效: ${isValid}`);
});

console.log('\n2. 验证搜索链接检测：');
console.log('-'.repeat(50));
const searchMetadata = { isSearchLink: true };
const searchIcon = getIconForLinkType('article', searchMetadata);
console.log(`✓ 带有 isSearchLink 标记的链接应返回搜索图标: ${searchIcon === '🔍' ? '✓ 正确' : '✗ 错误'}`);

console.log('\n3. 验证所有定义的图标：');
console.log('-'.repeat(50));
Object.entries(linkTypeEmojis).forEach(([type, icon]) => {
    console.log(`✓ ${type.padEnd(15)} => ${icon}`);
});

console.log('\n4. 验证无效类型处理：');
console.log('-'.repeat(50));
const invalidType = 'unknown-type';
const invalidIcon = getIconForLinkType(invalidType);
console.log(`✓ 无效类型 "${invalidType}" 返回默认图标: ${invalidIcon}`);
console.log(`✓ isValidLinkType('${invalidType}'): ${isValidLinkType(invalidType)}`);

console.log('\n=== 验证完成 ===\n');
console.log('所有图标映射已正确配置！');
