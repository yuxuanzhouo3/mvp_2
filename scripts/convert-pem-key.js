/**
 * 将 PEM 私钥文件转换为 .env 格式（单行，\n 连接）
 *
 * 使用方法：
 * node scripts/convert-pem-key.js <私钥文件路径>
 *
 * 例如：
 * node scripts/convert-pem-key.js ./apiclient_key.pem
 */

const fs = require('fs');
const path = require('path');

const pemFilePath = process.argv[2];

if (!pemFilePath) {
  console.log('❌ 请提供私钥文件路径');
  console.log('');
  console.log('使用方法：');
  console.log('  node scripts/convert-pem-key.js <私钥文件路径>');
  console.log('');
  console.log('例如：');
  console.log('  node scripts/convert-pem-key.js ./apiclient_key.pem');
  process.exit(1);
}

const fullPath = path.resolve(pemFilePath);

if (!fs.existsSync(fullPath)) {
  console.log(`❌ 文件不存在: ${fullPath}`);
  process.exit(1);
}

const pemContent = fs.readFileSync(fullPath, 'utf8');

// 将换行符替换为 \n 字符串（用于 .env 文件）
const envFormat = pemContent.trim().replace(/\n/g, '\\n');

console.log('');
console.log('✅ 转换成功！请将以下内容复制到 .env.local 文件中：');
console.log('');
console.log('─'.repeat(60));
console.log(`WECHAT_PAY_PRIVATE_KEY="${envFormat}"`);
console.log('─'.repeat(60));
console.log('');
console.log('注意：整个值需要用双引号包裹！');
