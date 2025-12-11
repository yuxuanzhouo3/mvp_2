/**
 * 测试推荐历史 API
 * 运行: npx ts-node scripts/test-history-api.ts
 */

const API_BASE = "http://localhost:3000/api"
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000"

async function testHistoryAPI() {
    console.log("🧪 开始测试推荐历史 API\n")

    try {
        // 1. 获取历史记录
        console.log("1️⃣  获取历史记录...")
        const getResponse = await fetch(
            `${API_BASE}/recommend/history?userId=${TEST_USER_ID}&limit=10`
        )
        const getData = await getResponse.json()
        console.log("   ✅ 获取成功")
        console.log(`   📊 返回 ${getData.count} 条记录\n`)

        if (getData.data && getData.data.length > 0) {
            const firstItem = getData.data[0]
            console.log("   📝 第一条记录:")
            console.log(`   - ID: ${firstItem.id}`)
            console.log(`   - 标题: ${firstItem.title}`)
            console.log(`   - 分类: ${firstItem.category}`)
            console.log(`   - 创建时间: ${firstItem.created_at}\n`)

            // 2. 测试删除（如果有记录）
            console.log("2️⃣  测试删除单条记录...")
            const deleteResponse = await fetch(
                `${API_BASE}/recommend/history`,
                {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: TEST_USER_ID,
                        historyIds: [firstItem.id],
                    }),
                }
            )
            const deleteData = await deleteResponse.json()
            console.log("   ✅ 删除成功")
            console.log(`   🗑️  已删除 ${deleteData.deletedCount} 条记录\n`)
        } else {
            console.log("   ⚠️  没有可用的历史记录，跳过删除测试\n")
        }

        // 3. 测试批量删除
        console.log("3️⃣  测试批量操作 (标记为点击)...")
        const putResponse = await fetch(
            `${API_BASE}/recommend/history`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: TEST_USER_ID,
                    action: "mark-as-clicked",
                    historyIds: ["test-id-1", "test-id-2"],
                }),
            }
        )
        const putData = await putResponse.json()
        if (putData.success) {
            console.log("   ✅ 操作成功\n")
        } else {
            console.log("   ⚠️  操作失败（可能是测试 ID 不存在）\n")
        }

        console.log("✨ API 测试完成！")
    } catch (error) {
        console.error("❌ 测试失败:", error)
        process.exit(1)
    }
}

testHistoryAPI()
