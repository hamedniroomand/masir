import process from 'node:process';

function parseArgs() {
  const args = process.argv.slice(2);
  let targetUrl = process.env.BENCH_URL ?? 'http://127.0.0.1:3000/health';
  let requestCount = Number.parseInt(process.env.BENCH_COUNT ?? '100', 10);
  let workerConcurrency = Number.parseInt(process.env.BENCH_CONCURRENCY ?? '10', 10);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const nextArgument = args[index + 1];
    if (argument === '--url' && nextArgument) {
      targetUrl = nextArgument;
      index += 1;
    }
    else if ((argument === '-n' || argument === '--count') && nextArgument) {
      requestCount = Number.parseInt(nextArgument, 10);
      index += 1;
    }
    else if ((argument === '-c' || argument === '--concurrency') && nextArgument) {
      workerConcurrency = Number.parseInt(nextArgument, 10);
      index += 1;
    }
    else if (argument && !argument.startsWith('-')) {
      targetUrl = argument;
    }
  }

  return { targetUrl, requestCount, workerConcurrency };
}

export async function runRedirectBenchmark(targetUrl: string, totalCount: number, batchConcurrency: number) {
  const durations: number[] = [];
  let completed = 0;

  async function sendWorker() {
    while (completed < totalCount) {
      completed += 1;
      const startTime = performance.now();
      try {
        await fetch(targetUrl, { redirect: 'manual' });
      }
      catch {
        // Record latency even when the mock connection drops
      }
      const endTime = performance.now();
      durations.push(endTime - startTime);
    }
  }

  const workers = Array.from({ length: batchConcurrency }, () => sendWorker());
  await Promise.all(workers);

  durations.sort((firstDuration, secondDuration) => firstDuration - secondDuration);
  const percentile50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
  const percentile95 = durations[Math.floor(durations.length * 0.95)] ?? 0;

  return {
    totalRequests: durations.length,
    percentile50: Number(percentile50.toFixed(2)),
    percentile95: Number(percentile95.toFixed(2)),
  };
}

const benchmarkConfig = parseArgs();
console.log(`Sending ${benchmarkConfig.requestCount} requests to ${benchmarkConfig.targetUrl}...`);
const benchmarkResult = await runRedirectBenchmark(
  benchmarkConfig.targetUrl,
  benchmarkConfig.requestCount,
  benchmarkConfig.workerConcurrency,
);
console.log(`Results: ${benchmarkResult.totalRequests} requests`);
console.log(`p50: ${benchmarkResult.percentile50} ms`);
console.log(`p95: ${benchmarkResult.percentile95} ms`);
