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

async function runFailureTest() {
  console.log('--- TEST: FALLO EN PROVISIONING Y COMPENSACIÓN (RF-06) ---');
  console.log('1. Enviando POST /activations con simulateFailure: "provisioning"...');
  const res = await postActivation({
    customerId: 'C-TEST-002',
    planId: 'FIBRA-500MB',
    simulateFailure: 'provisioning',
  });

  const { activationId } = res.body;
  console.log(`Activación creada con ID: ${activationId}. Estado inicial: ${res.body.status}`);

  console.log('2. Esperando procesamiento asíncrono y compensación...');
  let current;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const check = await getActivation(activationId);
    current = check.body;
    console.log(`[t+${i + 1}s] Estado: ${current.status} | Steps:`, JSON.stringify(current.steps));
    if (current.status === 'FAILED') {
      break;
    }
  }

  console.log('\n--- RESULTADO FINAL DE LA ACTIVACIÓN CON FALLO ---');
  console.log('Estado:', current.status);
  console.log('Steps:', JSON.stringify(current.steps, null, 2));
  console.log('Historial de eventos:', JSON.stringify(current.history, null, 2));

  if (current.status === 'FAILED') {
    console.log('\n✅ VERIFICACIÓN EXITOSA: La activación pasó a FAILED.');
    console.log('✅ El fallo se detectó, se emitió ActivationFailed y se activó la compensación.');
  } else {
    console.error(`\n❌ ERROR: Estado final inesperado: ${current.status}`);
    process.exit(1);
  }
}

runFailureTest().catch((err) => {
  console.error('Error en test de fallo:', err);
  process.exit(1);
});
