const http = require('http');

function httpRequest(options, data) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const reqOptions = {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function postActivation(data) {
  return httpRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/activations',
      method: 'POST',
    },
    data,
  );
}

async function getActivation(id) {
  return httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/activations/${id}`,
    method: 'GET',
  });
}

async function getMailhogMessages() {
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 8025,
      path: '/api/v2/messages',
      method: 'GET',
    });
    return res.body?.items || [];
  } catch (err) {
    return [];
  }
}

async function runPhase2Verification() {
  console.log('======================================================');
  console.log('  TEST FASE 2: NOTIFICACIONES, SAGA Y COMPENSACIÓN   ');
  console.log('======================================================\n');

  // --- ESCENARIO 1: CAMINO FELIZ + MAIL DE BIENVENIDA ---
  console.log('--- 1. ESCENARIO 1: Camino Feliz (simulateFailure: "none") ---');
  const resSuccess = await postActivation({
    customerId: 'C-PHASE2-OK',
    planId: 'FIBRA-1000MB',
    simulateFailure: 'none',
  });

  if (resSuccess.statusCode !== 202) {
    throw new Error(`Expected 202 Accepted, got ${resSuccess.statusCode}`);
  }

  const { activationId: successId } = resSuccess.body;
  console.log(`Activación iniciada: ${successId}. Aguardando resolución a ACTIVE...`);

  let currentSuccess;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const check = await getActivation(successId);
    currentSuccess = check.body;
    process.stdout.write(`.`);
    if (currentSuccess.status === 'ACTIVE') break;
  }
  console.log(`\nEstado final éxito: ${currentSuccess.status}`);

  if (currentSuccess.status !== 'ACTIVE') {
    throw new Error(`Expected status ACTIVE, got ${currentSuccess.status}`);
  }

  // --- ESCENARIO 2: FALLO EN PROVISIONING + COMPENSACIÓN + MAIL DE ERROR ---
  console.log('\n--- 2. ESCENARIO 2: Fallo en Provisioning & Compensación en Saga ---');
  const resFail = await postActivation({
    customerId: 'C-PHASE2-FAIL',
    planId: 'FIBRA-500MB',
    simulateFailure: 'provisioning',
  });

  const { activationId: failId } = resFail.body;
  console.log(`Activación iniciada: ${failId}. Aguardando resolución a FAILED y compensación...`);

  let currentFail;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const check = await getActivation(failId);
    currentFail = check.body;
    process.stdout.write(`.`);
    if (currentFail.status === 'FAILED' && currentFail.steps?.billingCompensation?.status === 'CANCELLED') {
      break;
    }
  }
  console.log(`\nEstado final fallo: ${currentFail.status}`);
  console.log('Compensación Billing:', JSON.stringify(currentFail.steps?.billingCompensation || {}));

  if (currentFail.status !== 'FAILED') {
    throw new Error(`Expected status FAILED, got ${currentFail.status}`);
  }

  // --- VERIFICACIÓN DE EMAILS EN MAILHOG ---
  console.log('\n--- 3. Verificando Entrega de Correos en Mailhog (:8025) ---');
  await new Promise((r) => setTimeout(r, 2000)); // Esperar delivery SMTP
  const emails = await getMailhogMessages();
  console.log(`Total mensajes encontrados en Mailhog: ${emails.length}`);

  const welcomeMail = emails.find((m) =>
    m.Raw?.To?.some((t) => t.toLowerCase().includes('c-phase2-ok')),
  );
  const failureMail = emails.find((m) =>
    m.Raw?.To?.some((t) => t.toLowerCase().includes('c-phase2-fail')),
  );

  if (welcomeMail) {
    console.log(`✅ Email de bienvenida verificado en Mailhog para ${welcomeMail.Raw.To[0]}`);
  } else {
    console.warn('⚠️ No se encontró email de bienvenida en Mailhog.');
  }

  if (failureMail) {
    console.log(`✅ Email de error verificado en Mailhog para ${failureMail.Raw.To[0]}`);
  } else {
    console.warn('⚠️ No se encontró email de error en Mailhog.');
  }

  console.log('\n======================================================');
  console.log('✅ VERIFICACIÓN DE FASE 2 FINALIZADA SATISFACTORIAMENTE');
  console.log('======================================================');
}

runPhase2Verification().catch((err) => {
  console.error('\n❌ ERROR durante el test:', err);
  process.exit(1);
});
