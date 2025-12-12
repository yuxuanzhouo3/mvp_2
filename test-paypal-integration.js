// test-paypal-integration.js - 测试 PayPal 集成修复
const https = require('https');

// 配置
const BASE_URL = 'https://58718c48.r24.cpolar.top';

async function testPayPalIntegration() {
  console.log('=== Testing PayPal Integration ===\n');

  // 1. 测试 capture-order API 端点
  console.log('1. Testing /api/paypal/capture-order endpoint...');

  const testData = {
    orderId: 'test-order-123'
  };

  const captureOrderOptions = {
    hostname: '58718c48.r24.cpolar.top',
    port: 443,
    path: '/api/paypal/capture-order',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(testData))
    }
  };

  try {
    const captureOrderResponse = await makeRequest(captureOrderOptions, JSON.stringify(testData));
    console.log('✅ Capture order API responded successfully');
    console.log('Response:', captureOrderResponse);
  } catch (error) {
    if (error.message.includes('400')) {
      console.log('✅ Capture order API is working (expected 400 error for test order)');
    } else {
      console.error('❌ Capture order API failed:', error.message);
    }
  }

  // 2. 测试 webhook 端点
  console.log('\n2. Testing /api/paypal/webhook endpoint...');

  const webhookData = {
    event_type: 'CHECKOUT.ORDER.APPROVED',
    resource: {
      id: 'test-order-123',
      status: 'APPROVED',
      purchase_units: [{
        reference_id: 'default',
        amount: {
          currency_code: 'USD',
          value: '9.99'
        }
      }]
    }
  };

  const webhookOptions = {
    hostname: '58718c48.r24.cpolar.top',
    port: 443,
    path: '/api/paypal/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(webhookData))
    }
  };

  try {
    const webhookResponse = await makeRequest(webhookOptions, JSON.stringify(webhookData));
    console.log('✅ Webhook endpoint handled CHECKOUT.ORDER.APPROVED event');
    console.log('Response:', webhookResponse);
  } catch (error) {
    console.error('❌ Webhook endpoint failed:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode < 400) {
            resolve(response);
          } else {
            reject(new Error(`${res.statusCode}: ${response.error || 'Unknown error'}`));
          }
        } catch (e) {
          reject(new Error(`Invalid response: ${body}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// 运行测试
testPayPalIntegration().catch(console.error);