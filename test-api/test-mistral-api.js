// 替换成你自己的 API Key（在 Mistral 平台 -> API Keys 中生成）
const API_KEY = 'ef9oX29Hb55RLkrzMpJAfgxxxxxxxxxx';

// 要调用的模型，例如 Mistral Large（前沿模型）
const MODEL = 'mistral-large-latest';

// API 端点
const API_URL = 'https://api.mistral.ai/v1/chat/completions';

async function chatWithMistral() {
  const messages = [
    { role: 'system', content: '你是一个友好的助手，用中文回复。' },
    { role: 'user', content: '给我讲一个关于AI的冷笑话。' }
  ];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI 回复：');
    console.log(data.choices[0].message.content);
  } catch (error) {
    console.error('请求失败：', error);
  }
}

// 执行
chatWithMistral();