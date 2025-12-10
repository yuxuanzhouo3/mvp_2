# 修复：[AI] 用户历史记录数总是显示为20的问题

## 问题描述
用户看到日志或界面显示 `[AI] 用户历史记录数: 20`，并且这个数字一直不变，即使用户实际上拥有不同数量的历史记录。

## 根本原因
在两个主要API中，`getUserRecommendationHistory()` 函数的调用使用了硬编码的数值：

1. **AI推荐API** (`app/api/recommend/ai/[category]/route.ts`)：硬编码 `20`
2. **用户偏好分析API** (`app/api/preferences/[userId]/route.ts`)：硬编码 `10`

这些硬编码值限制了从数据库返回的历史记录数量，导致：
- 用户有100条历史，但只取20条
- 日志总是显示最多20条（或实际更少）
- 无法灵活调整取值范围

## 解决方案

### 修改1：AI推荐API
**文件**: `app/api/recommend/ai/[category]/route.ts` (第62-76行)

**改动前**:
```typescript
[userHistory, userPreference] = await Promise.all([
  getUserRecommendationHistory(userId, category, 20),  // 硬编码
  getUserCategoryPreference(userId, category),
]);
```

**改动后**:
```typescript
// 从请求参数获取历史记录限制，默认为 50
const historyLimit = Math.min(Math.max(parseInt(searchParams.get("historyLimit") || "50"), 1), 100);
[userHistory, userPreference] = await Promise.all([
  getUserRecommendationHistory(userId, category, historyLimit),  // 可配置
  getUserCategoryPreference(userId, category),
]);
```

**特点**:
- 默认值改为 `50`（更完整的用户历史）
- 支持通过 `historyLimit` 查询参数自定义
- 范围验证：最小1，最大100

### 修改2：用户偏好分析API
**文件**: `app/api/preferences/[userId]/route.ts` (第59-62行)

**改动前**:
```typescript
if (includeHistory) {
  history = await getUserRecommendationHistory(userId, category, 10);  // 硬编码
}
```

**改动后**:
```typescript
if (includeHistory) {
  // 从请求参数获取历史记录限制，默认为 20
  const historyLimit = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("historyLimit") || "20"), 1), 100);
  history = await getUserRecommendationHistory(userId, category, historyLimit);  // 可配置
}
```

**特点**:
- 默认值为 `20`（适合偏好分析）
- 同样支持 `historyLimit` 查询参数自定义
- 相同的范围验证：最小1，最大100

## API使用示例

### AI推荐API

获取推荐时，日志现在会显示实际的历史记录数：

```bash
# 使用默认值（50条）
curl "http://localhost:3000/api/recommend/ai/entertainment?userId=xxx"
# 日志: [AI] 用户历史记录数: 50 (或实际数量，最多50)

# 自定义历史限制（30条）
curl "http://localhost:3000/api/recommend/ai/entertainment?userId=xxx&historyLimit=30"
# 日志: [AI] 用户历史记录数: 30 (或实际数量，最多30)

# 获取更多历史用于AI学习（100条最大）
curl "http://localhost:3000/api/recommend/ai/entertainment?userId=xxx&historyLimit=100"
# 日志: [AI] 用户历史记录数: 100 (或实际数量，最多100)
```

### 用户偏好分析API

```bash
# 获取偏好分析，包含历史记录（默认20条）
curl "http://localhost:3000/api/preferences/xxx?category=entertainment&includeHistory=true"

# 获取更多历史记录进行分析
curl "http://localhost:3000/api/preferences/xxx?category=entertainment&includeHistory=true&historyLimit=50"
```

## 验证方法

1. **查看服务器日志**：
   - 启动开发服务器
   - 访问推荐API
   - 观察 `[AI] 用户历史记录数:` 日志输出
   - 应该看到实际数量，而不是总是20

2. **测试不同的参数值**：
   - `historyLimit=10` → 应显示最多10条
   - `historyLimit=100` → 应显示最多100条
   - 无参数 → 应使用各API的默认值

3. **运行诊断脚本**：
   ```bash
   node scripts/test-history-limit-fix.ts
   ```

## 影响范围

- ✅ AI推荐生成：现在能获取更完整的用户历史用于AI学习
- ✅ 日志输出：更准确地反映实际取值
- ✅ API灵活性：支持根据需求调整历史记录数
- ✅ 性能优化：可以在需要时减少查询数据以提高响应速度

## 向后兼容性

✅ **完全向后兼容**
- 没有指定 `historyLimit` 参数的现有代码继续使用默认值
- 现有的前端代码无需修改
- 数据库和表结构完全不变

## 相关代码

- `lib/services/recommendation-service.ts`: `getUserRecommendationHistory()` 函数定义（未修改）
- `app/api/recommend/ai/[category]/route.ts`: AI推荐API（已修改）
- `app/api/preferences/[userId]/route.ts`: 用户偏好API（已修改）
