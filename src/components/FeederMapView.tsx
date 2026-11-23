import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Download,
  RefreshCw,
  ShieldCheck,
  Wifi,
  Zap,
} from 'lucide-react';
import { NERC_TARIFF_BANDS } from '../data/awkaSeed';
import { verifyFeederChain } from '../lib/cryptoHash';
import {
  FaultCategory,
  Feeder,
  OutageReport,
  PowerState,
  TelemetryLogEntry,
} from '../types/awka';
import { PowerStateLabel } from './StatusLabel';

interface FeederMapViewProps {
  feeders: Feeder[];
  selectedFeederId: string;
  onSelectFeeder: (id: string) => void;
  telemetryLogs: Record<string, TelemetryLogEntry[]>;
  outageReports: OutageReport[];
  isOfflineMode: boolean;
  onToggleOffline: () => void;
  onInjectTelemetry: (feederId: string, state: PowerState, voltage: number) => void;
  onSubmitOutageReport: (payload: {
    feederId: string;
    reportedState: PowerState;
    faultCategory: FaultCategory;
    description: string;
  }) => void;
  onSyncOfflineQueue: () => void;
  onToggleTamperDemo: (feederId: string, sequenceNo: number) => void;
}

function build24hProfile(feeder: Feeder): Array<{ hourLabel: string; state: PowerState; voltage: number }> {
  const slots: Array<{ hourLabel: string; state: PowerState; voltage: number }> = [];
  for (let h = 0; h < 24; h++) {
    const label = `${h.toString().padStart(2, '0')}:00`;
    let state: PowerState = 'OFF';
    let voltage = 0;

    if (feeder.id === 'feeder-aroma-02') {
      if (h >= 6 && h <= 20) {
        state = h === 13 ? 'LOW_VOLTAGE' : 'ON';
        voltage = h === 13 ? 184.2 : 221.6;
      }
    } else if (feeder.id === 'feeder-eke-05') {
      if ((h >= 9 && h <= 11) || (h >= 12 && h <= 14)) {
        state = h === 11 ? 'LOW_VOLTAGE' : 'ON';
        voltage = h === 11 ? 164.0 : 217.8;
      }
    } else if (feeder.id === 'feeder-zik-03') {
      if (h >= 8 && h <= 13) {
        state = h >= 11 ? 'LOW_VOLTAGE' : 'ON';
        voltage = h >= 11 ? 158.4 : 214.0;
      }
    } else if (feeder.id === 'feeder-ifite-01') {
      if (h >= 2 && h <= 4 || h === 12) {
        state = 'ON';
        voltage = 212.5;
      }
    } else {
      if (h >= 3 && h <= 5) {
        state = 'ON';
        voltage = 208.0;
      }
    }

    if (h === 13) {
      state = feeder.currentState;
      voltage = feeder.lastVoltageV;
    }

    slots.push({ hourLabel: label, state, voltage });
  }
  return slots;
}

export const FeederMapView: React.FC<FeederMapViewProps> = ({
  feeders,
  selectedFeederId,
  onSelectFeeder,
  telemetryLogs,
  outageReports,
  isOfflineMode,
  onToggleOffline,
  onInjectTelemetry,
  onSubmitOutageReport,
  onSyncOfflineQueue,
  onToggleTamperDemo,
}) => {
  const selectedFeeder = feeders.find((f) => f.id === selectedFeederId) ?? feeders[0];
  const selectedBand = NERC_TARIFF_BANDS[selectedFeeder.bandCode];
  const feederLogs = useMemo(
    () => [...(telemetryLogs[selectedFeeder.id] ?? [])].sort((a, b) => b.sequenceNo - a.sequenceNo),
    [telemetryLogs, selectedFeeder.id]
  );

  const chainVerification = useMemo(
    () => verifyFeederChain(telemetryLogs[selectedFeeder.id] ?? []),
    [telemetryLogs, selectedFeeder.id]
  );

  const hourlyProfile = useMemo(() => build24hProfile(selectedFeeder), [selectedFeeder]);

  const [reportState, setReportState] = useState<PowerState>('OFF');
  const [faultCategory, setFaultCategory] = useState<FaultCategory>('TOTAL_BLACKOUT');
  const [reportDesc, setReportDesc] = useState('');
  const [simVoltage, setSimVoltage] = useState<string>('219.4');
  const [simState, setSimState] = useState<PowerState>('ON');
  const [lastVerifyMessage, setLastVerifyMessage] = useState<string | null>(null);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const offlineQueuedCount = outageReports.filter((r) => r.syncStatus === 'QUEUED_OFFLINE').length;
  const activeFeedersCount = feeders.filter((f) => f.currentState === 'ON').length;
  const avgSbtCompliance =
    feeders.reduce((acc, f) => {
      const target = NERC_TARIFF_BANDS[f.bandCode].minDailyHours;
      return acc + Math.min(100, (f.rolling30dAvgDailyHours / target) * 100);
    }, 0) / feeders.length;

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDesc.trim()) return;
    onSubmitOutageReport({
      feederId: selectedFeeder.id,
      reportedState: reportState,
      faultCategory,
      description: reportDesc.trim(),
    });
    setReportDesc('');
  };

  const handleRunVerification = () => {
    if (chainVerification.valid) {
      setLastVerifyMessage(
        `Verified ${chainVerification.checkedCount} intervals on ${selectedFeeder.feederCode}. SHA-256 chain unbroken.`
      );
    } else {
      setLastVerifyMessage(
        `Tampering detected at sequence #${chainVerification.brokenAtSequence} on ${selectedFeeder.feederCode}.`
      );
    }
  };

  const handleExportEvidenceJson = () => {
    const bundle = {
      exported_at: new Date().toISOString(),
      standard: 'Section 84, Nigerian Evidence Act 2011 · NERC SBT Telemetry Registry',
      feeder: {
        feeder_code: selectedFeeder.feederCode,
        name: selectedFeeder.name,
        injection_substation: selectedFeeder.injectionSubstation,
        nerc_band: selectedFeeder.bandCode,
        committed_daily_hours: selectedBand.minDailyHours,
      },
      chain_verification: chainVerification,
      telemetry_logs: telemetryLogs[selectedFeeder.id] ?? [],
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFeeder.feederCode}-evidence-log.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const strokeForState = (state: PowerState) => {
    if (state === 'ON') return '#16a34a';
    if (state === 'LOW_VOLTAGE' || state === 'FLUCTUATING') return '#d97706';
    return '#dc2626';
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Monitored Awka Feeders</p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {activeFeedersCount} / {feeders.length} ON
            </p>
            <span className="text-xs text-slate-500">11kV &amp; 33kV</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Avg SBT Band Compliance</p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="text-2xl font-semibold text-red-700 font-mono tabular-nums">
              {avgSbtCompliance.toFixed(1)}%
            </p>
            <span className="text-xs text-slate-500">30-day rolling</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Selected Feeder Supply</p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {selectedFeeder.rolling30dAvgDailyHours.toFixed(2)}h/day
            </p>
            <span className="text-xs text-slate-500">
              Target {selectedBand.minDailyHours.toFixed(0)}h (Band {selectedFeeder.bandCode})
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Connectivity &amp; Sync Queue</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
              {offlineQueuedCount} queued offline
            </span>
            <button
              type="button"
              onClick={onToggleOffline}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                isOfflineMode
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isOfflineMode ? 'Offline 2G Mode' : 'Network Online'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Awka GIS Feeder Map + Selected Feeder Telemetry Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Cartographic Awka Grid Map + 24h Supply Profile */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Awka Capital Territory Live Feeder GIS Map
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                6.210°N, 7.072°E · Agu-Awka &amp; Awka Central Injection Substations
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" />
                ON
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block" />
                Low Voltage
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />
                OFF
              </span>
            </div>
          </div>

          <div className="my-4 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <svg
              viewBox="0 0 600 380"
              className="w-full h-auto block"
              role="img"
              aria-label="Topographic GIS map of Awka 11kV and 33kV distribution feeders"
            >
              <defs>
                <pattern id="awka-gis-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="0.6" />
                </pattern>
              </defs>
              <rect width="600" height="380" fill="#f1f5f9" />
              <rect width="600" height="380" fill="url(#awka-gis-grid)" />

              {/* District Zone Polygons */}
              <path
                d="M 55 45 L 220 40 L 240 160 L 70 175 Z"
                fill="#e2e8f0"
                fillOpacity="0.45"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text x="85" y="70" className="fill-slate-500 text-[10px] font-semibold">
                OKPUNO LAYOUT
              </text>

              <path
                d="M 335 35 L 545 45 L 555 170 L 355 180 Z"
                fill="#e2e8f0"
                fillOpacity="0.45"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text x="415" y="60" className="fill-slate-500 text-[10px] font-semibold">
                IFITE-AWKA / UNIZIK
              </text>

              <path
                d="M 235 160 L 365 155 L 365 240 L 235 245 Z"
                fill="#e2e8f0"
                fillOpacity="0.5"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text x="255" y="172" className="fill-slate-500 text-[9px] font-semibold">
                AROMA / SECRETARIAT
              </text>

              <path
                d="M 60 225 L 265 235 L 255 345 L 55 340 Z"
                fill="#e2e8f0"
                fillOpacity="0.45"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text x="82" y="330" className="fill-slate-500 text-[10px] font-semibold">
                ZIK&apos;S AVENUE / REGINA CAELI
              </text>

              <path
                d="M 285 255 L 520 250 L 510 355 L 285 350 Z"
                fill="#e2e8f0"
                fillOpacity="0.45"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text x="345" y="342" className="fill-slate-500 text-[10px] font-semibold">
                EKE AWKA COMMERCIAL PLAZAS
              </text>

              {/* Road Infrastructure */}
              <path
                d="M 15 245 Q 250 212 585 168"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M 15 245 Q 250 212 585 168"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeDasharray="8 6"
              />
              <text x="42" y="232" className="fill-slate-600 text-[9px] font-medium">
                Enugu–Onitsha Expy (A3)
              </text>

              <path
                d="M 290 215 L 365 295 L 445 315"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 290 215 L 185 270 L 110 295"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="5"
                strokeLinecap="round"
              />

              {/* Feeder Power Corridors */}
              {feeders.map((feeder) => {
                const isSelected = feeder.id === selectedFeeder.id;
                const color = strokeForState(feeder.currentState);
                return (
                  <g
                    key={feeder.id}
                    onClick={() => onSelectFeeder(feeder.id)}
                    className="cursor-pointer"
                  >
                    <path
                      d={feeder.corridorPath}
                      fill="none"
                      stroke={color}
                      strokeWidth={isSelected ? 5 : 3}
                      strokeDasharray={feeder.currentState === 'OFF' ? '6 5' : undefined}
                      opacity={isSelected ? 1 : 0.78}
                    />
                  </g>
                );
              })}

              {/* Central Agu-Awka Substation */}
              <g>
                <rect x="275" y="196" width="30" height="30" rx="5" fill="#0f172a" />
                <text
                  x="290"
                  y="214"
                  textAnchor="middle"
                  className="fill-white text-[8px] font-mono font-bold"
                >
                  33/11
                </text>
              </g>

              {/* Interactive Feeder Nodes */}
              {feeders.map((feeder) => {
                const isSelected = feeder.id === selectedFeeder.id;
                const color = strokeForState(feeder.currentState);
                return (
                  <g
                    key={`node-${feeder.id}`}
                    onClick={() => onSelectFeeder(feeder.id)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle
                        cx={feeder.mapX}
                        cy={feeder.mapY}
                        r={19}
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="2"
                      />
                    )}
                    <circle
                      cx={feeder.mapX}
                      cy={feeder.mapY}
                      r={12}
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth="3.5"
                    />
                    <text
                      x={feeder.mapX}
                      y={feeder.mapY + 3.5}
                      textAnchor="middle"
                      className="fill-slate-900 text-[9px] font-mono font-bold"
                    >
                      {feeder.bandCode}
                    </text>
                    <rect
                      x={feeder.mapX - 58}
                      y={feeder.mapY + 16}
                      width="116"
                      height="29"
                      rx="4"
                      fill="#ffffff"
                      stroke={isSelected ? '#0f172a' : '#cbd5e1'}
                      strokeWidth={isSelected ? '1.5' : '1'}
                    />
                    <text
                      x={feeder.mapX}
                      y={feeder.mapY + 28}
                      textAnchor="middle"
                      className="fill-slate-900 text-[10px] font-semibold"
                    >
                      {feeder.areaCluster}
                    </text>
                    <text
                      x={feeder.mapX}
                      y={feeder.mapY + 39}
                      textAnchor="middle"
                      className="fill-slate-500 text-[9px] font-mono"
                    >
                      {feeder.lastVoltageV.toFixed(0)}V · {feeder.rolling30dAvgDailyHours.toFixed(1)}h/d
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 24-Hour Feeder Supply & Voltage Quality Profile */}
          <div className="mb-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-900">
                24-Hour Supply &amp; Voltage Profile · {selectedFeeder.areaCluster}
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {hoveredHour !== null
                  ? `${hourlyProfile[hoveredHour].hourLabel} WAT — ${hourlyProfile[hoveredHour].state} (${hourlyProfile[hoveredHour].voltage.toFixed(1)}V)`
                  : 'Hover hour bar to inspect RMS voltage'}
              </span>
            </div>
            <div className="grid grid-cols-24 gap-1 items-end h-12 bg-slate-50 border border-slate-200 rounded p-2">
              {hourlyProfile.map((slot, idx) => {
                const bg =
                  slot.state === 'ON'
                    ? 'bg-emerald-600 h-full'
                    : slot.state === 'LOW_VOLTAGE'
                    ? 'bg-amber-500 h-2/3'
                    : 'bg-red-200 h-1/4';
                return (
                  <div
                    key={slot.hourLabel}
                    onMouseEnter={() => setHoveredHour(idx)}
                    onMouseLeave={() => setHoveredHour(null)}
                    className={`rounded-xs cursor-pointer transition-opacity ${bg} ${
                      hoveredHour === idx ? 'opacity-100 ring-1 ring-slate-900' : 'opacity-85'
                    }`}
                    title={`${slot.hourLabel}: ${slot.state} (${slot.voltage.toFixed(1)}V)`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>00:00 WAT</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00 WAT</span>
            </div>
          </div>

          {/* Quick Feeder Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Feeder</th>
                  <th className="py-2 px-3 font-medium">SBT Band</th>
                  <th className="py-2 px-3 font-medium">State</th>
                  <th className="py-2 px-3 font-medium text-right">Voltage</th>
                  <th className="py-2 pl-3 font-medium text-right">30d Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeders.map((feeder) => {
                  const isSelected = feeder.id === selectedFeeder.id;
                  return (
                    <tr
                      key={feeder.id}
                      onClick={() => onSelectFeeder(feeder.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 pr-3 font-medium text-slate-900">
                        {feeder.areaCluster}
                        <span className="block text-[11px] font-mono text-slate-500">
                          {feeder.feederCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        Band {feeder.bandCode} ({NERC_TARIFF_BANDS[feeder.bandCode].minDailyHours}h)
                      </td>
                      <td className="py-2.5 px-3">
                        <PowerStateLabel state={feeder.currentState} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                        {feeder.lastVoltageV.toFixed(1)} V
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-800">
                        {feeder.rolling30dAvgDailyHours.toFixed(2)} h/d
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Consensus & Offline Outage Reporting Controls */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* IoT Sensor Heartbeat Injector */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  IoT Node Heartbeat &amp; Consensus Engine
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedFeeder.name} · Sensor {selectedFeeder.deviceUid}
                </p>
              </div>
              <PowerStateLabel state={selectedFeeder.currentState} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Voltage L1</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {selectedFeeder.lastVoltageV.toFixed(1)} V
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Grid Freq</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {selectedFeeder.lastFrequencyHz.toFixed(2)} Hz
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Oct Supply</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {selectedFeeder.monthlySupplyHoursOct.toFixed(1)} h
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              <p className="text-xs font-medium text-slate-700">
                Simulate ESP32 + ZMPT101B Heartbeat (Appends SHA-256 Chain Block)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Measured State
                  </label>
                  <select
                    value={simState}
                    onChange={(e) => {
                      const next = e.target.value as PowerState;
                      setSimState(next);
                      if (next === 'OFF') setSimVoltage('0.0');
                      else if (next === 'LOW_VOLTAGE') setSimVoltage('154.2');
                      else setSimVoltage('221.4');
                    }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    <option value="ON">ON (Nominal 220V)</option>
                    <option value="LOW_VOLTAGE">LOW_VOLTAGE (&lt;175V)</option>
                    <option value="OFF">OFF (0V Outage)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    RMS Voltage (V)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="260"
                    value={simVoltage}
                    onChange={(e) => setSimVoltage(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onInjectTelemetry(selectedFeeder.id, simState, Number(simVoltage) || 0)
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ingest Heartbeat &amp; Sign Hash Chain</span>
              </button>
            </div>
          </div>

          {/* Crowdsourced Outage Report (Offline-First Queue) */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Crowdsourced Fault &amp; Outage Report
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  30% consensus weight · Persists in IndexedDB when offline
                </p>
              </div>
              {isOfflineMode ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 whitespace-nowrap">
                  <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Offline</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
                  <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Online</span>
                </span>
              )}
            </div>

            <form onSubmit={handleReportSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Observed Supply
                  </label>
                  <select
                    value={reportState}
                    onChange={(e) => setReportState(e.target.value as PowerState)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    <option value="OFF">Total Blackout (OFF)</option>
                    <option value="LOW_VOLTAGE">Low Voltage Brownout</option>
                    <option value="ON">Power Restored (ON)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Fault Category
                  </label>
                  <select
                    value={faultCategory}
                    onChange={(e) => setFaultCategory(e.target.value as FaultCategory)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    <option value="TOTAL_BLACKOUT">Total Blackout</option>
                    <option value="LOW_VOLTAGE_BROWNOUT">Low Voltage</option>
                    <option value="TRANSFORMER_SPARK_FAULT">Transformer Fault</option>
                    <option value="FALLEN_POLE_CABLE">Fallen Pole / Cable</option>
                    <option value="PHASE_OUTAGE">Single Phase Outage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Location / Landmark Note
                </label>
                <input
                  type="text"
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  placeholder={`e.g. Transformer breaker tripped near ${selectedFeeder.areaCluster} plaza`}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800 transition-colors whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isOfflineMode ? 'Queue Offline Report' : 'Submit Verified Report'}</span>
                </button>
                {offlineQueuedCount > 0 && (
                  <button
                    type="button"
                    onClick={onSyncOfflineQueue}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sync ({offlineQueuedCount})</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Cryptographic SHA-256 Hash-Chained Telemetry Ledger */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Immutable SHA-256 Hash-Chained Telemetry Log · {selectedFeeder.feederCode}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Admissible electronic evidence under Section 84, Nigerian Evidence Act 2011. Any edit breaks downstream hashes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {chainVerification.valid ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Chain Intact ({chainVerification.checkedCount} blocks)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                <span>Tamper Alert at Seq #{chainVerification.brokenAtSequence}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleRunVerification}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Verify Chain Integrity</span>
            </button>
            <button
              type="button"
              onClick={handleExportEvidenceJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Proof JSON</span>
            </button>
          </div>
        </div>

        {lastVerifyMessage && (
          <div
            className={`mt-3 rounded-md px-3 py-2 text-xs font-medium border ${
              chainVerification.valid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {lastVerifyMessage}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Seq</th>
                <th className="py-2 px-3 font-medium">Timestamp (UTC)</th>
                <th className="py-2 px-3 font-medium">Consensus</th>
                <th className="py-2 px-3 font-medium text-right">Voltage</th>
                <th className="py-2 px-3 font-medium text-right">Crowd Votes</th>
                <th className="py-2 px-3 font-medium">Prev Hash</th>
                <th className="py-2 px-3 font-medium">Chain Hash (SHA-256)</th>
                <th className="py-2 pl-3 font-medium text-right">Audit Test</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {feederLogs.map((entry) => (
                <tr
                  key={entry.sequenceNo}
                  className={entry.tampered ? 'bg-red-50/70' : 'hover:bg-slate-50'}
                >
                  <td className="py-2.5 pr-3 font-mono text-slate-900">#{entry.sequenceNo}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {entry.recordedAt.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="py-2.5 px-3">
                    <PowerStateLabel state={entry.consensusState} />
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                    {entry.voltageL1V.toFixed(1)} V
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {entry.crowdConfirmCount}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">
                    {entry.prevHash.slice(0, 12)}…
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-900">
                    {entry.chainHash.slice(0, 16)}…
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleTamperDemo(selectedFeeder.id, entry.sequenceNo)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 underline whitespace-nowrap"
                    >
                      {entry.tampered ? 'Restore Row' : 'Test Tamper'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Outage Reports */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">
            Recent Resident &amp; MSME Outage Reports
          </h4>
          <div className="divide-y divide-slate-100">
            {outageReports.slice(0, 6).map((rep) => (
              <div key={rep.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-900">{rep.feederName}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="text-slate-600">{rep.description}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                  <span>{rep.source}</span>
                  <span>·</span>
                  <span
                    className={
                      rep.syncStatus === 'QUEUED_OFFLINE' ? 'text-amber-700 font-semibold' : 'text-emerald-700'
                    }
                  >
                    {rep.syncStatus === 'QUEUED_OFFLINE' ? 'IndexedDB Queued' : 'Synced'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
