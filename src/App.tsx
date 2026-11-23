import { useEffect, useState } from 'react';
import {
  Activity,
  FileCheck2,
  Menu,
  PhoneCall,
  RotateCcw,
  Sun,
  X,
} from 'lucide-react';
import { BillingDisputeView } from './components/BillingDisputeView';
import { FeederMapView } from './components/FeederMapView';
import { SolarPaygView } from './components/SolarPaygView';
import { UssdLabView } from './components/UssdLabView';
import {
  INITIAL_FEEDERS,
  INITIAL_OUTAGE_REPORTS,
  INITIAL_PAYG_TXS,
  INITIAL_PETITIONS,
  INITIAL_SME_METERS,
  INITIAL_SOLAR_CLUSTERS,
  INITIAL_TELEMETRY_LOGS,
} from './data/awkaSeed';
import {
  computeChainHash,
  computePayloadHash,
  generateSts20DigitToken,
  generateUuidV7,
} from './lib/cryptoHash';
import { clearPersistedState, loadPersistedState, savePersistedState } from './lib/offlineDb';
import {
  BillingAuditResult,
  DisputePetition,
  FaultCategory,
  Feeder,
  OutageReport,
  PaygTokenTransaction,
  PowerState,
  SmeMeter,
  TelemetryLogEntry,
} from './types/awka';

type ActiveTab = 'feeders' | 'disputes' | 'solar' | 'ussd';

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  subtitle: string;
  icon: typeof Activity;
}> = [
  {
    id: 'feeders',
    label: 'Feeder Transparency',
    subtitle: 'IoT Telemetry & Hash Logs',
    icon: Activity,
  },
  {
    id: 'disputes',
    label: 'NERC Billing & Disputes',
    subtitle: 'Cap Audit & Exhibit A PDF',
    icon: FileCheck2,
  },
  {
    id: 'solar',
    label: 'Solar PAYG Micro-Grid',
    subtitle: 'STS Tokens & Fuel Savings',
    icon: Sun,
  },
  {
    id: 'ussd',
    label: 'USSD & Offline Sync',
    subtitle: '*347*842# & IndexedDB Lab',
    icon: PhoneCall,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('feeders');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feeders, setFeeders] = useState<Feeder[]>(INITIAL_FEEDERS);
  const [selectedFeederId, setSelectedFeederId] = useState<string>(INITIAL_FEEDERS[0].id);
  const [telemetryLogs, setTelemetryLogs] =
    useState<Record<string, TelemetryLogEntry[]>>(INITIAL_TELEMETRY_LOGS);
  const [outageReports, setOutageReports] = useState<OutageReport[]>(INITIAL_OUTAGE_REPORTS);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [petitions, setPetitions] = useState<DisputePetition[]>(INITIAL_PETITIONS);
  const [meters, setMeters] = useState<SmeMeter[]>(INITIAL_SME_METERS);
  const [transactions, setTransactions] = useState<PaygTokenTransaction[]>(INITIAL_PAYG_TXS);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted offline reports, hash-chain blocks, petitions & PAYG logs from IndexedDB
  useEffect(() => {
    let mounted = true;
    loadPersistedState().then((saved) => {
      if (!mounted) return;
      if (saved) {
        if (saved.telemetryLogs) setTelemetryLogs(saved.telemetryLogs);
        if (saved.outageReports) setOutageReports(saved.outageReports);
        if (saved.petitions) setPetitions(saved.petitions);
        if (saved.transactions) setTransactions(saved.transactions);
      }
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePersistedState({
      telemetryLogs,
      outageReports,
      petitions,
      transactions,
    });
  }, [hydrated, telemetryLogs, outageReports, petitions, transactions]);

  const handleResetDemoState = async () => {
    await clearPersistedState();
    setFeeders(INITIAL_FEEDERS);
    setTelemetryLogs(INITIAL_TELEMETRY_LOGS);
    setOutageReports(INITIAL_OUTAGE_REPORTS);
    setPetitions(INITIAL_PETITIONS);
    setMeters(INITIAL_SME_METERS);
    setTransactions(INITIAL_PAYG_TXS);
    setIsOfflineMode(false);
  };

  const handleInjectTelemetry = (feederId: string, state: PowerState, voltage: number) => {
    const nowIso = new Date().toISOString();
    const freq = state === 'ON' ? 50.01 : state === 'LOW_VOLTAGE' ? 49.38 : 0.0;

    setTelemetryLogs((prev) => {
      const existing = prev[feederId] ?? [];
      const last = existing[existing.length - 1];
      const nextSeq = (last?.sequenceNo ?? 1000) + 1;
      const prevHash = last?.chainHash ?? '0'.repeat(64);
      const payloadHash = computePayloadHash({
        feederId,
        recordedAt: nowIso,
        voltageL1V: voltage,
        frequencyHz: freq,
        rawDeviceState: state,
      });
      const chainHash = computeChainHash({
        prevHash,
        feederId,
        sequenceNo: nextSeq,
        recordedAt: nowIso,
        consensusState: state,
        voltageL1V: voltage,
        payloadHash,
      });

      const nextEntry: TelemetryLogEntry = {
        feederId,
        sequenceNo: nextSeq,
        recordedAt: nowIso,
        consensusState: state,
        rawDeviceState: state,
        voltageL1V: voltage,
        frequencyHz: freq,
        intervalSeconds: 300,
        supplyCreditedSec: state === 'ON' ? 300 : state === 'LOW_VOLTAGE' ? 150 : 0,
        consensusConfidence: 0.96,
        crowdConfirmCount: 2,
        prevHash,
        payloadHash,
        chainHash,
        signingKeyId: 'ACTDA-ED25519-KEY-2026',
      };

      return {
        ...prev,
        [feederId]: [...existing, nextEntry],
      };
    });

    setFeeders((prev) =>
      prev.map((f) =>
        f.id === feederId
          ? {
              ...f,
              currentState: state,
              lastVoltageV: voltage,
              lastFrequencyHz: freq,
              lastTelemetryAt: nowIso,
            }
          : f
      )
    );
  };

  const handleSubmitOutageReport = (payload: {
    feederId: string;
    reportedState: PowerState;
    faultCategory: FaultCategory;
    description: string;
  }) => {
    const feeder = feeders.find((f) => f.id === payload.feederId) ?? feeders[0];
    const report: OutageReport = {
      id: `rep-${Date.now()}`,
      clientIdempotencyKey: generateUuidV7(),
      feederId: feeder.id,
      feederName: feeder.name,
      source: 'PWA',
      reportedState: payload.reportedState,
      faultCategory: payload.faultCategory,
      description: payload.description,
      distanceToFeederM: 54.0,
      validationWeight: 0.85,
      occurredAt: new Date().toISOString(),
      syncStatus: isOfflineMode ? 'QUEUED_OFFLINE' : 'SYNCED',
    };

    setOutageReports((prev) => [report, ...prev]);

    if (!isOfflineMode && payload.reportedState === 'OFF') {
      handleInjectTelemetry(feeder.id, 'OFF', 0.0);
    }
  };

  const handleSyncOfflineQueue = () => {
    setIsOfflineMode(false);
    setOutageReports((prev) =>
      prev.map((rep) => (rep.syncStatus === 'QUEUED_OFFLINE' ? { ...rep, syncStatus: 'SYNCED' } : rep))
    );
  };

  const handleToggleTamperDemo = (feederId: string, sequenceNo: number) => {
    setTelemetryLogs((prev) => ({
      ...prev,
      [feederId]: (prev[feederId] ?? []).map((entry) => {
        if (entry.sequenceNo !== sequenceNo) return entry;
        if (!entry.tampered) {
          return {
            ...entry,
            tampered: true,
            voltageL1V: entry.voltageL1V === 0 ? 225.0 : 0.0,
            consensusState: entry.consensusState === 'OFF' ? 'ON' : 'OFF',
          };
        }
        const restoredState: PowerState = entry.supplyCreditedSec === 300 ? 'ON' : 'OFF';
        const restoredVoltage = restoredState === 'ON' ? 221.4 : 0.0;
        return {
          ...entry,
          tampered: false,
          consensusState: restoredState,
          voltageL1V: restoredVoltage,
        };
      }),
    }));
  };

  const handleCreatePetition = (audit: BillingAuditResult) => {
    const nextNum = 420 + petitions.length;
    const now = new Date();
    const due = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    const newPet: DisputePetition = {
      id: `pet-${Date.now()}`,
      ticketReference: `AWK-NERC-2026-00${nextNum}`,
      audit,
      status: 'SUBMITTED_TO_EEDC',
      eedcTicketNo: `EEDC-AWK-${883000 + nextNum}`,
      submittedAt: now.toISOString(),
      statutoryDueAt: due.toISOString(),
      adjustedRefundNgn: 0,
      targetRecipients: ['EEDC Customer Care', 'NERC Awka Forum Office', 'FCCPC'],
    };
    setPetitions((prev) => [newPet, ...prev]);
  };

  const handleEscalatePetition = (petitionId: string) => {
    setPetitions((prev) =>
      prev.map((p) =>
        p.id === petitionId
          ? {
              ...p,
              status: 'ESCALATED_TO_NERC',
              nercDocketNo: `NERC/AWK/FORUM/2026/${120 + Math.floor(Math.random() * 50)}`,
            }
          : p
      )
    );
  };

  const handleVendToken = (params: {
    meterDrn: string;
    amountNgn: number;
    channel: 'PAYSTACK_USSD' | 'MONNIFY_TRANSFER' | 'PAYSTACK_CARD';
  }): PaygTokenTransaction => {
    const meter = meters.find((m) => m.meterDrn === params.meterDrn) ?? meters[0];
    const cluster =
      INITIAL_SOLAR_CLUSTERS.find((c) => c.id === meter.clusterId) ?? INITIAL_SOLAR_CLUSTERS[0];
    const kwhUnits = Number((params.amountNgn / cluster.tariffNgnPerKwh).toFixed(3));
    const nowMs = Date.now();
    const { token20Digit, tokenTid } = generateSts20DigitToken({
      meterDrn: meter.meterDrn,
      kwhUnits,
      sgc: cluster.stsSupplyGroupCode,
      timestampMs: nowMs,
    });

    const tx: PaygTokenTransaction = {
      id: `tx-${nowMs}`,
      idempotencyKey: `payg-${generateUuidV7()}`,
      gatewayReference: `AWK-PAYG-${nowMs.toString().slice(-6)}`,
      meterDrn: meter.meterDrn,
      businessName: meter.businessName,
      phoneE164: meter.phoneE164,
      channel: params.channel,
      amountNgn: params.amountNgn,
      kwhUnits,
      token20Digit,
      tokenTid,
      smsProvider: params.channel === 'PAYSTACK_USSD' ? 'TERMII' : 'AFRICAS_TALKING',
      smsStatus: params.channel === 'PAYSTACK_USSD' ? 'SENT_FAILOVER' : 'DELIVERED',
      vendedAt: new Date(nowMs).toISOString(),
    };

    setTransactions((prev) => [tx, ...prev]);
    setMeters((prev) =>
      prev.map((m) =>
        m.meterDrn === meter.meterDrn
          ? {
              ...m,
              cumulativeKwhVended: Number((m.cumulativeKwhVended + kwhUnits).toFixed(3)),
              cumulativeSolarSpendNgn: m.cumulativeSolarSpendNgn + params.amountNgn,
            }
          : m
      )
    );
    return tx;
  };

  const handleToggleRelay = (meterId: string) => {
    setMeters((prev) =>
      prev.map((m) => {
        if (m.id !== meterId) return m;
        const tripped = m.relayState === 'TRIPPED_OVERLOAD';
        return {
          ...m,
          relayState: tripped ? 'CONNECTED' : 'TRIPPED_OVERLOAD',
          currentLoadW: tripped ? Math.round(m.maxLoadLimitW * 0.65) : m.maxLoadLimitW + 210,
        };
      })
    );
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 no-print">
        <div className="h-16 flex items-center px-5 border-b border-slate-200">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Awka Power Hub
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Main modules">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <span className="block text-xs font-semibold leading-snug">{item.label}</span>
                  <span
                    className={`block text-[11px] mt-0.5 ${
                      isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {item.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-2">
          <div>
            <p className="font-semibold text-slate-700">Regulatory Alignment</p>
            <p>ACTDA · NERC Awka Forum · FCCPC</p>
            <p className="font-mono pt-1 text-slate-600">USSD: *347*842#</p>
          </div>
          <button
            type="button"
            onClick={handleResetDemoState}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 underline"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Reset IndexedDB Cache</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200">
              <span className="text-base font-bold text-slate-900">Awka Power Hub</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-600 hover:text-slate-900"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-xs font-semibold ${
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate">Anambra State Power Initiative</span>
                <span aria-hidden="true">/</span>
                <span className="font-medium text-slate-900 truncate">{activeNav.label}</span>
              </div>
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                {activeNav.subtitle}
              </h1>
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'disputes' ? 'feeders' : 'disputes')}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {activeTab === 'disputes' ? 'View Live Feeders' : 'Audit EEDC Bill'}
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1320px] w-full mx-auto">
          {activeTab === 'feeders' && (
            <FeederMapView
              feeders={feeders}
              selectedFeederId={selectedFeederId}
              onSelectFeeder={setSelectedFeederId}
              telemetryLogs={telemetryLogs}
              outageReports={outageReports}
              isOfflineMode={isOfflineMode}
              onToggleOffline={() => setIsOfflineMode((v) => !v)}
              onInjectTelemetry={handleInjectTelemetry}
              onSubmitOutageReport={handleSubmitOutageReport}
              onSyncOfflineQueue={handleSyncOfflineQueue}
              onToggleTamperDemo={handleToggleTamperDemo}
            />
          )}

          {activeTab === 'disputes' && (
            <BillingDisputeView
              feeders={feeders}
              telemetryLogs={telemetryLogs}
              petitions={petitions}
              onCreatePetition={handleCreatePetition}
              onEscalatePetition={handleEscalatePetition}
            />
          )}

          {activeTab === 'solar' && (
            <SolarPaygView
              clusters={INITIAL_SOLAR_CLUSTERS}
              meters={meters}
              transactions={transactions}
              onVendToken={handleVendToken}
              onToggleRelay={handleToggleRelay}
            />
          )}

          {activeTab === 'ussd' && (
            <UssdLabView
              feeders={feeders}
              petitions={petitions}
              meters={meters}
              outageReports={outageReports}
              onSyncOfflineQueue={handleSyncOfflineQueue}
              onVendFromUssd={handleVendToken}
            />
          )}
        </main>
      </div>
    </div>
  );
}
