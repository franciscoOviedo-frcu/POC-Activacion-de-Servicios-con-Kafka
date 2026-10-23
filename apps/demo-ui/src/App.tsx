import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Server,
  Mail,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Zap,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Radio,
  FileText,
  User,
  Package,
} from 'lucide-react';

interface StepInfo {
  status: string;
  at?: string;
  reason?: string;
}

interface StepsRecord {
  billing?: StepInfo;
  provisioning?: StepInfo;
  billingCompensation?: StepInfo;
}

interface HistoryItem {
  eventType: string;
  at: string;
}

interface Activation {
  _id: string;
  customerId: string;
  planId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'ACTIVE' | 'FAILED';
  simulateFailure: 'none' | 'billing' | 'provisioning';
  steps: StepsRecord;
  history: HistoryItem[];
  createdAt: string;
}

const API_BASE_URL = 'http://localhost:3000';
const WS_URL = 'http://localhost:3000';

export default function App() {
  const [activations, setActivations] = useState<Activation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [customerId, setCustomerId] = useState<string>('C-1001');
  const [planId, setPlanId] = useState<string>('FIBRA-1000MB');
  const [simulateFailure, setSimulateFailure] = useState<'none' | 'billing' | 'provisioning'>('none');

  // Load Initial Activations
  const loadActivations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/activations`);
      if (res.ok) {
        const data: Activation[] = await res.json();
        setActivations(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0]._id);
        }
      }
    } catch (err) {
      console.warn('Could not fetch activations from API:', err);
    }
  };

  useEffect(() => {
    loadActivations();

    const socket: Socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Connected to activation-api WebSocket:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    });

    socket.on('activation:update', (payload: { activation: Activation; lastEvent?: any }) => {
      console.log('Received activation:update via WS:', payload);
      const updated = payload.activation;
      setActivations((prev) => {
        const exists = prev.some((a) => a._id === updated._id);
        if (exists) {
          return prev.map((a) => (a._id === updated._id ? { ...a, ...updated } : a));
        }
        return [updated, ...prev];
      });

      setSelectedId((current) => current || updated._id);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCreateActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/activations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          planId,
          simulateFailure,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const created = await res.json();
      setSelectedId(created.activationId);
      // Wait for WS or refresh list
      await loadActivations();
    } catch (err: any) {
      alert(`Error al iniciar activación: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedActivation = useMemo(() => {
    return activations.find((a) => a._id === selectedId) || activations[0] || null;
  }, [activations, selectedId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              POC Telecom: Activación con Kafka
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800">
                Fase 2: Demo Reactiva
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              UTN FRCU — Sistemas Distribuidos (2026) | Coreografía con Agregador & Sagas
            </p>
          </div>
        </div>

        {/* Status & Quick Links */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-slate-900 border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 animate-ping'
              }`}
            />
            <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
              {isConnected ? 'WebSocket Conectado' : 'Reconectando...'}
            </span>
          </div>

          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 text-xs transition"
          >
            <Mail className="w-3.5 h-3.5" /> Mailhog (:8025) <ExternalLink className="w-3 h-3" />
          </a>

          <a
            href="http://localhost:8080"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/30 text-xs transition"
          >
            <Layers className="w-3.5 h-3.5" /> Kafka UI (:8080) <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Activation Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Form Panel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              Solicitar Nueva Contratación
            </h2>

            <form onSubmit={handleCreateActivation} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Cliente (Key de particionado Kafka)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                    placeholder="Ej. C-1001"
                  />
                  {['C-1001', 'C-1002', 'C-1003'].map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCustomerId(id)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition ${
                        customerId === id
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Plan de Servicio</label>
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="FIBRA-1000MB">Fibra Óptica 1000 Mbps (Simétrica)</option>
                  <option value="FIBRA-500MB">Fibra Óptica 500 Mbps</option>
                  <option value="FIBRA-300MB">Fibra Óptica 300 Mbps</option>
                  <option value="MOVIL-5G-ILIMITADO">Móvil 5G Datos Ilimitados</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Simulación de Fallo de Negocio
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                      simulateFailure === 'none'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="failure"
                      value="none"
                      checked={simulateFailure === 'none'}
                      onChange={() => setSimulateFailure('none')}
                      className="mt-0.5 text-emerald-500 focus:ring-0 mr-3"
                    />
                    <div>
                      <div className="font-semibold text-xs text-white">Camino Feliz (Sin Fallos)</div>
                      <div className="text-[11px] text-slate-400">
                        Billing y Provisioning completan OK → Activación exitosa → Email de bienvenida.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                      simulateFailure === 'provisioning'
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="failure"
                      value="provisioning"
                      checked={simulateFailure === 'provisioning'}
                      onChange={() => setSimulateFailure('provisioning')}
                      className="mt-0.5 text-rose-500 focus:ring-0 mr-3"
                    />
                    <div>
                      <div className="font-semibold text-xs text-white">Fallo en Aprovisionamiento (Saga)</div>
                      <div className="text-[11px] text-slate-400">
                        Provisioning emite ProvisioningFailed → API emite ActivationFailed → Billing anula cuenta
                        (Compensación).
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                      simulateFailure === 'billing'
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="failure"
                      value="billing"
                      checked={simulateFailure === 'billing'}
                      onChange={() => setSimulateFailure('billing')}
                      className="mt-0.5 text-amber-500 focus:ring-0 mr-3"
                    />
                    <div>
                      <div className="font-semibold text-xs text-white">Fallo en Facturación</div>
                      <div className="text-[11px] text-slate-400">
                        Billing rechaza el alta de cuenta → ActivationFailed → Notificación de error.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-medium rounded-lg shadow transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Enviando solicitud...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Iniciar Activación (POST /activations)
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Recent Activations List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Historial de Activaciones ({activations.length})
              </h3>
              <button
                onClick={loadActivations}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Actualizar
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activations.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No hay activaciones registradas aún. ¡Inicia una arriba!
                </div>
              ) : (
                activations.map((act) => {
                  const isSelected = selectedActivation?._id === act._id;
                  return (
                    <button
                      key={act._id}
                      onClick={() => setSelectedId(act._id)}
                      className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-sky-950/50 border-sky-500/50 text-white'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div>
                        <div className="font-mono text-xs font-semibold text-slate-200">{act._id}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{act.customerId}</span>
                          <span>•</span>
                          <span>{act.planId}</span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          act.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : act.status === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {act.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Saga Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedActivation ? (
            <>
              {/* Header Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <span className="text-xs font-mono text-sky-400 bg-sky-950/80 px-2.5 py-1 rounded border border-sky-800">
                      ID: {selectedActivation._id}
                    </span>
                    <h2 className="text-lg font-bold text-white mt-2 flex items-center gap-2">
                      <Package className="w-5 h-5 text-slate-400" />
                      Plan: {selectedActivation.planId}
                    </h2>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                      Estado de la Saga
                    </span>
                    <div
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        selectedActivation.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : selectedActivation.status === 'FAILED'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      }`}
                    >
                      {selectedActivation.status === 'ACTIVE' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {selectedActivation.status === 'FAILED' && <XCircle className="w-4 h-4 text-rose-400" />}
                      {selectedActivation.status === 'PENDING' && <Clock className="w-4 h-4 text-amber-400" />}
                      {selectedActivation.status === 'IN_PROGRESS' && <RotateCcw className="w-4 h-4 text-sky-400 animate-spin" />}
                      {selectedActivation.status}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Cliente</span>
                    <span className="font-semibold text-slate-200">{selectedActivation.customerId}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Simulación</span>
                    <span className="font-semibold text-slate-200 uppercase">{selectedActivation.simulateFailure}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Fecha Creación</span>
                    <span className="font-semibold text-slate-200">
                      {new Date(selectedActivation.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reactive Timeline */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Timeline Coreografiado en Tiempo Real
                </h3>

                <div className="space-y-4 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-800">
                  {/* Step 1: ActivationRequested */}
                  <TimelineStep
                    stepNumber={1}
                    title="1. Solicitud Recibida (ActivationRequested)"
                    service="activation-api"
                    topic="activation.requested"
                    status="OK"
                    statusText="Solicitud publicada a Kafka con key = customerId"
                  />

                  {/* Step 2: Billing Service */}
                  <TimelineStep
                    stepNumber={2}
                    title="2. Facturación (billing-service)"
                    service="billing-service (Consumer Group: billing-svc)"
                    topic="billing.events"
                    status={selectedActivation.steps?.billing?.status || 'PENDING'}
                    statusText={
                      selectedActivation.steps?.billing?.status === 'OK'
                        ? 'Cuenta creada (BillingAccountCreated)'
                        : selectedActivation.steps?.billing?.status === 'FAILED'
                        ? 'Fallo en facturación simulado (BillingFailed)'
                        : 'Aguardando consumo del evento...'
                    }
                  />

                  {/* Step 3: Provisioning Service */}
                  <TimelineStep
                    stepNumber={3}
                    title="3. Aprovisionamiento de Red (provisioning-service)"
                    service="provisioning-service (Consumer Group: provisioning-svc)"
                    topic="provisioning.events"
                    status={selectedActivation.steps?.provisioning?.status || 'PENDING'}
                    statusText={
                      selectedActivation.steps?.provisioning?.status === 'OK'
                        ? 'Aprovisionamiento finalizado con éxito (ProvisioningCompleted)'
                        : selectedActivation.steps?.provisioning?.status === 'FAILED'
                        ? 'Fallo de red/infraestructura simulado (ProvisioningFailed)'
                        : 'Aguardando simulación de red (1 a 2s)...'
                    }
                  />

                  {/* Step 4: Saga Aggregator (activation-api) */}
                  <TimelineStep
                    stepNumber={4}
                    title="4. Agregación de la Saga (activation-api)"
                    service="activation-api (Consumer Group: activation-api-svc)"
                    topic="activation.events"
                    status={
                      selectedActivation.status === 'ACTIVE'
                        ? 'OK'
                        : selectedActivation.status === 'FAILED'
                        ? 'FAILED'
                        : 'PENDING'
                    }
                    statusText={
                      selectedActivation.status === 'ACTIVE'
                        ? 'Ambos pasos confirmaron OK → Transición a ACTIVE (ActivationCompleted)'
                        : selectedActivation.status === 'FAILED'
                        ? 'Paso fallido detectado → Transición a FAILED (ActivationFailed)'
                        : 'Esperando confirmación paralela de Billing y Provisioning...'
                    }
                  />

                  {/* Step 5: Compensation (if failed) */}
                  {selectedActivation.status === 'FAILED' && (
                    <TimelineStep
                      stepNumber={5}
                      title="5. Transacción Compensatoria (Saga Rollback)"
                      service="billing-service (Compensación reactiva sin RPC)"
                      topic="billing.events"
                      status="COMPENSATION"
                      statusText={
                        selectedActivation.steps?.billingCompensation?.status === 'CANCELLED'
                          ? `Cuenta revertida y anulada (BillingAccountCancelled). Motivo: ${selectedActivation.steps.billingCompensation.reason || 'ActivationFailed'}`
                          : 'Procesando anulación de cuenta en billing-service...'
                      }
                    />
                  )}

                  {/* Step 6: Notification Service */}
                  {(selectedActivation.status === 'ACTIVE' || selectedActivation.status === 'FAILED') && (
                    <TimelineStep
                      stepNumber={selectedActivation.status === 'FAILED' ? 6 : 5}
                      title="6. Notificación por Correo (notification-service)"
                      service="notification-service (Consumer Group: notification-svc)"
                      topic="activation.events → Mailhog SMTP :1025"
                      status="MAIL"
                      statusText={
                        selectedActivation.status === 'ACTIVE'
                          ? `Email de bienvenida enviado a ${selectedActivation.customerId.toLowerCase()}@example.com (Mailhog)`
                          : `Email de aviso de error enviado a ${selectedActivation.customerId.toLowerCase()}@example.com`
                      }
                    />
                  )}
                </div>
              </div>

              {/* Event History Logs */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Registro de Eventos Cronológicos ({selectedActivation.history?.length || 0})
                </h3>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedActivation.history && selectedActivation.history.length > 0 ? (
                    selectedActivation.history.map((h, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-900/80">
                        <span className="text-sky-400 font-semibold">{h.eventType}</span>
                        <span className="text-slate-500 text-[10px]">{new Date(h.at).toLocaleTimeString()}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500">Sin historial aún.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              Selecciona o crea una activación para ver su flujo en tiempo real.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TimelineStep({
  stepNumber,
  title,
  service,
  topic,
  status,
  statusText,
}: {
  stepNumber: number;
  title: string;
  service: string;
  topic: string;
  status: 'OK' | 'FAILED' | 'PENDING' | 'COMPENSATION' | 'MAIL' | string;
  statusText: string;
}) {
  let icon = <Clock className="w-4 h-4 text-amber-400" />;
  let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';

  if (status === 'OK') {
    icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
  } else if (status === 'FAILED') {
    icon = <XCircle className="w-4 h-4 text-rose-400" />;
    badgeColor = 'bg-rose-950/80 text-rose-300 border-rose-800';
  } else if (status === 'COMPENSATION') {
    icon = <RotateCcw className="w-4 h-4 text-purple-400" />;
    badgeColor = 'bg-purple-950/80 text-purple-300 border-purple-800';
  } else if (status === 'MAIL') {
    icon = <Mail className="w-4 h-4 text-sky-400" />;
    badgeColor = 'bg-sky-950/80 text-sky-300 border-sky-800';
  }

  return (
    <div className="relative pl-9 text-xs">
      {/* Node Dot on line */}
      <div className="absolute left-2 top-1.5 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
        {icon}
      </div>

      <div className={`p-3 rounded-lg border ${badgeColor}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-white text-xs">{title}</span>
          <span className="font-mono text-[10px] text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded">
            Topic: {topic}
          </span>
        </div>
        <p className="text-slate-300 text-[11px] mb-1">{statusText}</p>
        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
          <span>Servicio:</span>
          <span className="text-slate-300">{service}</span>
        </div>
      </div>
    </div>
  );
}
