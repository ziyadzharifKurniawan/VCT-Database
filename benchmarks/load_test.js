// To execute: Run inside an active terminal session: node benchmarks/load_test.js
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/api/player/TenZ',
  method: 'GET'
};

function dispatchRequest() {
  return new Promise((resolve) => {
    http.get(options, (res) => {
      let buffer = '';
      res.on('data', chunk => buffer += chunk);
      res.on('end', () => resolve(res.statusCode));
    }).on('error', () => resolve(500));
  });
}

async function runPerformanceValidation() {
  console.log("🚀 Initializing NoSQL Infrastructure Cluster Benchmarking Test...");
  
  // Warm up request to ensure the Redis cache key is built
  await dispatchRequest();
  
  const throughputTargetCycles = 250;
  const startTimer = Date.now();
  
  const executionPool = [];
  for (let i = 0; i < throughputTargetCycles; i++) {
    executionPool.push(dispatchRequest());
  }
  
  const statusCodes = await Promise.all(executionPool);
  const deltaExecutionDuration = Date.now() - startTimer;
  
  console.log(`\n📊 TEST COMPLETION PROFILE ANALYSIS`);
  console.log(`--------------------------------------------------`);
  console.log(`Aggregated Traffic Load volume   : ${throughputTargetCycles} Request Operations`);
  console.log(`Total System Resolution Duration : ${deltaExecutionDuration} ms`);
  console.log(`Computed Mean Latency Per Query  : ${(deltaExecutionDuration / throughputTargetCycles).toFixed(2)} ms`);
  console.log(`Calculated Infrastructure Capacity: ${((throughputTargetCycles / deltaExecutionDuration) * 1000).toFixed(0)} requests/sec`);
  console.log(`--------------------------------------------------`);
  console.log("✅ Benchmark tracking execution complete.");
}

runPerformanceValidation().catch(console.error);