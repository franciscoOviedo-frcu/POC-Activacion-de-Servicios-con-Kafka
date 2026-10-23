const http = require('http');

function postActivation(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/activations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getActivation(id) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/activations/${id}`,
        method: 'GET',
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  console.log('--- TEST FASE 1: CAMINO FELIZ (RF-01 a RF-05) ---');
  console.log('1. Enviando POST /activations...');
  const res = await postActivation({
    customerId: 'C-TEST-001',
    planId: 'FIBRA-1000MB',
    simulateFailure: 'none',
  });

  console.log(`Respuesta HTTP: ${res.statusCode}`, res.body);
  if (res.statusCode !== 202) {
    throw new Error(`Expected 202 Accepted, got ${res.statusCode}`);
  }

  const { activationId } = res.body;
  console.log(`Activación creada con ID: ${activationId}. Estado inicial: ${res.body.status}`);

  console.log('2. Esperando procesamiento asíncrono en Kafka (billing + provisioning)...');
  let current;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const check = await getActivation(activationId);
    current = check.body;
    console.log(`[t+${i + 1}s] Estado: ${current.status} | Steps:`, JSON.stringify(current.steps));
    if (current.status === 'ACTIVE' || current.status === 'FAILED') {
      break;
    }
  }

  console.log('\n--- RESULTADO FINAL DE LA ACTIVACIÓN ---');
  console.log('Estado:', current.status);
  console.log('Steps:', JSON.stringify(current.steps, null, 2));
  console.log('Historial de eventos:', JSON.stringify(current.history, null, 2));

  if (current.status === 'ACTIVE') {
    console.log('\n✅ VERIFICACIÓN EXITOSA: La activación pasó a ACTIVE.');
    console.log('✅ Billing y Provisioning confirmaron en paralelo y el agregador completó la Saga.');
  } else {
    console.error(`\n❌ ERROR: Estado final inesperado: ${current.status}`);
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Error en test:', err);
  process.exit(1);
});
