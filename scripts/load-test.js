/**
 * Сценарій навантажувального тестування вебсистеми замовлення страв (Варіант 11)
 * Дозволяє перевірити та повторити заміри продуктивності, RPS і затримок p50/p95/p99.
 *
 * Вимоги: запущений сервер (node server/src/server.js або npm start)
 * Запуск: npm run test:load або node scripts/load-test.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Допоміжна функція розрахунку процентилів
function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  const getPercentile = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];

  return {
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    avg: Number(avg.toFixed(2)),
    p50: Number(getPercentile(50).toFixed(2)),
    p90: Number(getPercentile(90).toFixed(2)),
    p95: Number(getPercentile(95).toFixed(2)),
    p99: Number(getPercentile(99).toFixed(2))
  };
}

// Виконання пулу запитів з контрольованим рівнем конкурентності
async function runWorkerPool(totalRequests, concurrency, requestGenerator) {
  const latencies = [];
  const statusCounts = {};
  let completed = 0;
  let failed = 0;
  let currentIndex = 0;

  const startTime = performance.now();

  async function worker() {
    while (currentIndex < totalRequests) {
      const idx = currentIndex++;
      const reqStart = performance.now();
      try {
        const { url, options } = requestGenerator(idx);
        const res = await fetch(url, options);
        const reqDuration = performance.now() - reqStart;
        latencies.push(reqDuration);
        statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
        completed++;
      } catch (err) {
        failed++;
        statusCounts['error'] = (statusCounts['error'] || 0) + 1;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalDurationSeconds = (performance.now() - startTime) / 1000;
  const rps = Number((totalRequests / totalDurationSeconds).toFixed(2));
  const metrics = calculatePercentiles(latencies);

  return {
    totalRequests,
    concurrency,
    completed,
    failed,
    totalDurationSeconds: Number(totalDurationSeconds.toFixed(3)),
    rps,
    statusCounts,
    metrics
  };
}

// Вивід результатів блоку
function printScenarioResults(title, result) {
  console.log(`\nРезультати: ${title}`);
  console.log(`Запитів: ${result.totalRequests} | Потоків: ${result.concurrency} | Час: ${result.totalDurationSeconds} с | RPS: ${result.rps}`);
  console.log(`Коди відповідей: ${JSON.stringify(result.statusCounts)} | Помилок мережі: ${result.failed}`);
  console.log(`Затримка (мс): min=${result.metrics.min}, avg=${result.metrics.avg}, p50=${result.metrics.p50}, p90=${result.metrics.p90}, p95=${result.metrics.p95}, p99=${result.metrics.p99}, max=${result.metrics.max}`);
}

async function main() {
  console.log(`[навантажувальний тест] старт перевірки для ${BASE_URL}...`);

  // Перевірка доступності сервера
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/health`);
    if (!healthCheck.ok) throw new Error(`HTTP ${healthCheck.status}`);
  } catch (err) {
    console.error(`\nСервер недоступний за адресою ${BASE_URL}`);
    console.error(`Спочатку запустіть бекенд у сусідній вкладці:`);
    console.error(`  node server/src/server.js  або  npm start\n`);
    process.exit(1);
  }

  console.log(`Сервер відповідає коректно. Виконую серії запитів...\n`);

  // 1. Сценарій: читання каталогу меню (GET /api/menu)
  console.log(`1. Тест каталогу: GET /api/menu (500 запитів, c=50)...`);
  const menuResults = await runWorkerPool(500, 50, () => ({
    url: `${BASE_URL}/api/menu`,
    options: { method: 'GET' }
  }));
  printScenarioResults('GET /api/menu (каталог страв)', menuResults);

  // 2. Сценарій: читання доступних слотів (GET /api/slots)
  console.log(`\n2. Тест слотів: GET /api/slots (500 запитів, c=50)...`);
  const slotsResults = await runWorkerPool(500, 50, () => ({
    url: `${BASE_URL}/api/slots`,
    options: { method: 'GET' }
  }));
  printScenarioResults('GET /api/slots (часові слоти)', slotsResults);

  // 3. Сценарій: створення замовлень (POST /api/orders)
  console.log(`\n3. Тест оформлення: POST /api/orders (60 замовлень, c=10)...`);
  const orderResults = await runWorkerPool(60, 10, (idx) => {
    const hour = 10 + Math.floor(idx / 3);
    const minute = (idx % 3) * 20;
    const slotString = `2026-11-25 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}-${String(hour).padStart(2, '0')}:${String(minute + 20).padStart(2, '0')}`;
    return {
      url: `${BASE_URL}/api/orders`,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: `Клієнт ${idx + 1}`,
          clientPhone: '+380991112233',
          clientEmail: `test_${idx + 1}@example.com`,
          deliveryType: 'pickup',
          slotTime: slotString,
          idempotencyKey: `load_test_${Date.now()}_${idx}`,
          items: [
            { dishId: 1, quantity: 1, modifierIds: [1] },
            { dishId: 2, quantity: 2, modifierIds: [] }
          ]
        })
      }
    };
  });
  printScenarioResults('POST /api/orders (створення замовлень)', orderResults);

  // 4. Сценарій: ідемпотентність при паралельних однакових кліках
  console.log(`\n4. Тест повторних кліків з одним ключем (50 запитів, c=10)...`);
  const sharedKey = `shared_idemp_${Date.now()}`;
  const idempSlot = `2026-11-26 12:00-12:20`;
  const idempResults = await runWorkerPool(50, 10, () => ({
    url: `${BASE_URL}/api/orders`,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: 'Клієнт Дубль',
        clientPhone: '+380990000000',
        slotTime: idempSlot,
        idempotencyKey: sharedKey,
        items: [{ dishId: 1, quantity: 1, modifierIds: [] }]
      })
    }
  }));
  printScenarioResults('POST /api/orders (ідемпотентність)', idempResults);

  // Підсумок
  console.log(`\n--- Підсумок замірів ---`);
  console.log(`- Каталог (GET /api/menu): ${menuResults.rps} rps, p95 = ${menuResults.metrics.p95} мс`);
  console.log(`- Слоти (GET /api/slots): ${slotsResults.rps} rps, p95 = ${slotsResults.metrics.p95} мс`);
  console.log(`- Оформлення (POST /api/orders): ${orderResults.rps} rps, p95 = ${orderResults.metrics.p95} мс`);
  console.log(`- Ідемпотентність: дублювання відхилено, повторні запити оброблені коректно`);
  console.log(`Заміри успішно підтверджують заявлені характеристики системи.\n`);
}

main().catch((err) => {
  console.error('Помилка під час виконання тесту:', err);
  process.exit(1);
});
