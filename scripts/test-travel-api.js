/**
 * Test travel recommendation links from API
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/recommend/ai/travel?userId=test&count=3&locale=zh',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);

      console.log('\n=== Travel Recommendations Analysis ===\n');

      result.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec.title}`);
        console.log(`   Description: ${rec.description}`);
        console.log(`   Reason: ${rec.reason}`);
        console.log(`   Tags: ${rec.tags?.join(', ') || 'N/A'}`);
        console.log(`   Search Query: ${rec.metadata?.searchQuery || rec.searchQuery || 'N/A'}`);
        console.log(`   Platform: ${rec.platform}`);
        console.log(`   Link: ${rec.link.substring(0, 100)}...`);
        console.log(`   Link Type: ${rec.linkType}`);
        console.log(`   Destination: ${rec.metadata?.destination?.name || 'N/A'}`);
        console.log(`   Country: ${rec.metadata?.destination?.country || 'N/A'}`);
        console.log('---');
      });

      console.log(`\nSource: ${result.source}`);
      console.log(`Success: ${result.success}`);

    } catch (error) {
      console.error('Error parsing JSON:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();