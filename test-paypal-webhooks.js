// test-paypal-webhooks.js - 测试 PayPal Webhook 事件
const https = require('https');

// 配置
const BASE_URL = 'https://58718c48.r24.cpolar.top';

async function testPayPalWebhooks() {
  console.log('=== Testing PayPal Webhook Events ===\n');

  const webhookEvents = [
    {
      name: 'CHECKOUT.ORDER.APPROVED',
      data: {
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: {
          id: '2AW66401VC015820T',
          status: 'APPROVED',
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: 'default',
            amount: {
              currency_code: 'USD',
              value: '9.99'
            },
            description: '1 Month Pro Membership'
          }]
        }
      }
    },
    {
      name: 'CHECKOUT.ORDER.COMPLETED',
      data: {
        event_type: 'CHECKOUT.ORDER.COMPLETED',
        resource: {
          id: '2AW66401VC015820T',
          status: 'COMPLETED',
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: 'default',
            amount: {
              currency_code: 'USD',
              value: '9.99'
            },
            description: '1 Month Pro Membership'
          }]
        }
      }
    },
    {
      name: 'PAYMENT.CAPTURE.COMPLETED',
      data: {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: '3J123456AB7890123',
          status: 'COMPLETED',
          amount: {
            currency_code: 'USD',
            value: '9.99'
          },
          custom_id: 'user_123'
        }
      }
    },
    {
      name: 'PAYMENT.CAPTURE.DENIED',
      data: {
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          id: '3J123456AB7890123',
          status: 'DENIED',
          amount: {
            currency_code: 'USD',
            value: '9.99'
          }
        }
      }
    },
    {
      name: 'PAYMENT.CAPTURE.DECLINED',
      data: {
        event_type: 'PAYMENT.CAPTURE.DECLINED',
        resource: {
          id: '3J123456AB7890123',
          status: 'DECLINED',
          amount: {
            currency_code: 'USD',
            value: '9.99'
          }
        }
      }
    }
  ];

  for (const event of webhookEvents) {
    console.log(`Testing webhook: ${event.name}...`);

    const webhookOptions = {
      hostname: '58718c48.r24.cpolar.top',
      port: 443,
      path: '/api/paypal/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(event.data))
      }
    };

    try {
      const response = await makeRequest(webhookOptions, JSON.stringify(event.data));
      console.log(`✅ ${event.name} handled successfully`);
      console.log(`Response:`, response);
    } catch (error) {
      console.error(`❌ ${event.name} failed:`, error.message);
    }
    console.log('---\n');
  }

  console.log('=== Webhook Testing Complete ===');
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
testPayPalWebhooks().catch(console.error);