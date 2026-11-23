import React, { useMemo, useState } from 'react';
import { FileText, Printer, Scale, ShieldAlert, Upload } from 'lucide-react';
import { NERC_TARIFF_BANDS } from '../data/awkaSeed';
import {
  BillingAuditResult,
  CustomerClass,
  DisputePetition,
  Feeder,
  TelemetryLogEntry,
} from '../types/awka';
import { DisputeStatusLabel, formatNaira } from './StatusLabel';

interface BillingDisputeViewProps {
  feeders: Feeder[];
  telemetryLogs: Record<string, TelemetryLogEntry[]>;
  petitions: DisputePetition[];
  onCreatePetition: (audit: BillingAuditResult) => void;
  onEscalatePetition: (petitionId: string) => void;
}

const SAMPLE_BILLS = [
  {
    label: 'Ifite Cold Room (₦48,500)',
    feederId: 'feeder-ifite-01',
    customerClass: 'C1_COMMERCIAL' as CustomerClass,
    accountNo: '4210089412-01',
    name: 'Ngozi Okafor (Ifite Cold Room & Provisions)',
    address: 'Shop 14, Opposite UNIZIK Junction, Ifite-Awka',
    amount: '48500',
    kwh: '410',
  },
  {
    label: "Zik's Ave Cybercafé (₦62,400)",
    feederId: 'feeder-zik-03',
    customerClass: 'C1_COMMERCIAL' as CustomerClass,
    accountNo: '4210077219-01',
    name: 'Ifeanyi Okonkwo (ZikNet Print & Cyber Hub)',
    address: "118 Zik's Avenue, Opposite Regina Caeli, Awka",
    amount: '62400',
    kwh: '540',
  },
  {
    label: 'Okpuno 3-Bed Flat (₦26,800)',
    feederId: 'feeder-okpuno-04',
    customerClass: 'R2_RESIDENTIAL' as CustomerClass,
    accountNo: '4210044180-01',
    name: 'Chukwuemeka Nwosu',
    address: 'Plot 8, Agu-Okpuno Layout, Awka',
    amount: '26800',
    kwh: '320',
  },
];

export const BillingDisputeView: React.FC<BillingDisputeViewProps> = ({
  feeders,
  telemetryLogs,
  petitions,
  onCreatePetition,
  onEscalatePetition,
}) => {
  const [feederId, setFeederId] = useState<string>(feeders[0].id);
  const [customerClass, setCustomerClass] = useState<CustomerClass>('C1_COMMERCIAL');
  const [eedcAccountNo, setEedcAccountNo] = useState<string>('4210089412-01');
  const [customerName, setCustomerName] = useState<string>(
    'Ngozi Okafor (Ifite Cold Room & Provisions)'
  );
  const [customerAddress, setCustomerAddress] = useState<string>(
    'Shop 14, Opposite UNIZIK Junction, Ifite-Awka'
  );
  const [billedAmountNgn, setBilledAmountNgn] = useState<string>('48500');
  const [billedKwh, setBilledKwh] = useState<string>('410');
  const [billFileName, setBillFileName] = useState<string>('eedc-oct-2026-4210089412.jpg');
  const [billPreviewUrl, setBillPreviewUrl] = useState<string | null>(null);
  const [activePetitionId, setActivePetitionId] = useState<string>(petitions[0]?.id ?? '');

  const selectedFeeder = feeders.find((f) => f.id === feederId) ?? feeders[0];
  const band = NERC_TARIFF_BANDS[selectedFeeder.bandCode];

  const liveAudit = useMemo<BillingAuditResult>(() => {
    const daysInCycle = 31;
    const expectedBandHours = band.minDailyHours * daysInCycle;
    const actualSupplyHours = selectedFeeder.monthlySupplyHoursOct;
    const uptimeRatio = Math.min(1, actualSupplyHours / expectedBandHours);
    const baseCapKwh =
      customerClass === 'C1_COMMERCIAL' ? band.commercialCapKwhMo : band.residentialCapKwhMo;
    const nercMaxCapKwh = Number((baseCapKwh * uptimeRatio).toFixed(2));
    const energyCharge = nercMaxCapKwh * band.tariffNgnPerKwh;
    const vatNgn = Number((energyCharge * band.vatRate).toFixed(2));
    const lawfulMaxBillNgn = Number((energyCharge + vatNgn).toFixed(2));
    const billedNum = Math.max(0, Number(billedAmountNgn) || 0);
    const overchargeNgn = Number((billedNum - lawfulMaxBillNgn).toFixed(2));
    const logs = telemetryLogs[selectedFeeder.id] ?? [];
    const closingHash =
      logs.length > 0 ? logs[logs.length - 1].chainHash : '00000000000000000000000000000000';

    return {
      id: `audit-${Date.now()}`,
      feederId: selectedFeeder.id,
      feederCode: selectedFeeder.feederCode,
      feederName: selectedFeeder.name,
      bandCode: selectedFeeder.bandCode,
      eedcAccountNo: eedcAccountNo.trim() || '4210089412-01',
      customerName: customerName.trim() || 'Awka Electricity Consumer',
      customerAddress: customerAddress.trim() || 'Awka, Anambra State',
      customerClass,
      billingPeriodStart: '2026-10-01',
      billingPeriodEnd: '2026-10-31',
      billedAmountNgn: billedNum,
      billedKwh: Number(billedKwh) || 0,
      actualSupplyHours,
      expectedBandHours,
      uptimeRatio: Number(uptimeRatio.toFixed(4)),
      nercMaxCapKwh,
      tariffNgnPerKwh: band.tariffNgnPerKwh,
      vatNgn,
      lawfulMaxBillNgn,
      overchargeNgn,
      isNercViolation: overchargeNgn > 100,
      evidenceClosingHash: closingHash,
      createdAt: new Date().toISOString(),
    };
  }, [
    selectedFeeder,
    band,
    customerClass,
    eedcAccountNo,
    customerName,
    customerAddress,
    billedAmountNgn,
    billedKwh,
    telemetryLogs,
  ]);

  const activePetition = petitions.find((p) => p.id === activePetitionId) ?? petitions[0];

  const handleLoadSample = (sample: (typeof SAMPLE_BILLS)[number]) => {
    setFeederId(sample.feederId);
    setCustomerClass(sample.customerClass);
    setEedcAccountNo(sample.accountNo);
    setCustomerName(sample.name);
    setCustomerAddress(sample.address);
    setBilledAmountNgn(sample.amount);
    setBilledKwh(sample.kwh);
  };

  const handleBillFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBillFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBillPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateBundle = (e: React.FormEvent) => {
    e.preventDefault();
    onCreatePetition(liveAudit);
  };

  return (
    <div className="space-y-6">
      {/* Audit Calculator + Legal Petition Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: NERC Billing Cap Audit Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 no-print">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              NERC Estimated Billing Cap Calculator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Audits EEDC monthly bills against verified feeder uptime &amp; NERC Order No. NERC/197/2020
            </p>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-medium text-slate-500 mb-1.5">
              Quick-Load Real Awka Customer Scenarios
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_BILLS.map((sample) => (
                <button
                  key={sample.accountNo}
                  type="button"
                  onClick={() => handleLoadSample(sample)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleGenerateBundle} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Designated 11kV/33kV Feeder
              </label>
              <select
                value={feederId}
                onChange={(e) => setFeederId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                {feeders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.areaCluster} — Band {f.bandCode} ({f.monthlySupplyHoursOct.toFixed(1)}h Oct)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer Class
                </label>
                <select
                  value={customerClass}
                  onChange={(e) => setCustomerClass(e.target.value as CustomerClass)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="C1_COMMERCIAL">C1 Commercial (MSME)</option>
                  <option value="R2_RESIDENTIAL">R2 Residential</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  EEDC Account No.
                </label>
                <input
                  type="text"
                  value={eedcAccountNo}
                  onChange={(e) => setEedcAccountNo(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer / Business Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Premises Address in Awka
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  EEDC Billed Amount (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={billedAmountNgn}
                  onChange={(e) => setBilledAmountNgn(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Billed Energy (kWh)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={billedKwh}
                  onChange={(e) => setBilledKwh(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>
            </div>

            {/* Bill Scan Attachment */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Attach EEDC Bill Scan (Exhibit B)
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-100">
                <span className="truncate font-mono text-[11px]">{billFileName}</span>
                <span className="inline-flex items-center gap-1 font-medium text-slate-800 shrink-0">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Upload</span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBillFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Live Audit Breakdown */}
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Actual Oct Feeder Supply</span>
                <span className="font-mono font-semibold text-slate-900">
                  {liveAudit.actualSupplyHours.toFixed(1)}h / {liveAudit.expectedBandHours.toFixed(0)}h (
                  {(liveAudit.uptimeRatio * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pro-Rata NERC Cap Energy</span>
                <span className="font-mono font-semibold text-slate-900">
                  {liveAudit.nercMaxCapKwh.toFixed(2)} kWh @ ₦{liveAudit.tariffNgnPerKwh}/kWh
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lawful Max Bill (incl. 7.5% VAT)</span>
                <span className="font-mono font-semibold text-emerald-700">
                  {formatNaira(liveAudit.lawfulMaxBillNgn)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100 text-sm">
                <span className="font-semibold text-slate-900">Unlawful Overcharge</span>
                <span
                  className={`font-mono font-bold ${
                    liveAudit.isNercViolation ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {liveAudit.overchargeNgn > 0
                    ? formatNaira(liveAudit.overchargeNgn)
                    : '₦0.00 (Compliant)'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Generate Formal Dispute Bundle &amp; Ticket</span>
            </button>
          </form>
        </div>

        {/* Right: Formal Legal Petition & Exhibit A Preview (Printable PDF) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 print-only-petition">
          {activePetition ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 no-print">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Formal Petition Bundle · {activePetition.ticketReference}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Addressed to EEDC Customer Care, NERC Awka Forum Office &amp; FCCPC
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print / Export Formal PDF</span>
                </button>
              </div>

              {/* Legal Document Body */}
              <div className="mt-5 space-y-4 text-xs leading-relaxed text-slate-800">
                <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Awka Power Supply Transparency &amp; Fair Billing Registry
                    </p>
                    <p className="font-bold text-sm text-slate-900 mt-0.5">
                      FORMAL BILLING DISPUTE PETITION &amp; DEMAND FOR CREDIT ADJUSTMENT
                    </p>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-700 shrink-0">
                    <p>Ref: {activePetition.ticketReference}</p>
                    <p>Filed: {activePetition.submittedAt.slice(0, 10)}</p>
                    <p>EEDC Acct: {activePetition.audit.eedcAccountNo}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] bg-slate-50 border border-slate-200 rounded p-3">
                  <div>
                    <p className="font-semibold text-slate-900">Respondents &amp; Regulatory Copy</p>
                    <p className="text-slate-600 mt-0.5">
                      1. Head of Customer Care, EEDC (Awka District)
                      <br />
                      2. NERC Forum Office, Awka, Anambra State
                      <br />
                      3. FCCPC South-East Zonal Enforcement Office
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Complainant &amp; Feeder Metadata</p>
                    <p className="text-slate-600 mt-0.5">
                      {activePetition.audit.customerName}
                      <br />
                      {activePetition.audit.customerAddress}
                      <br />
                      Feeder: {activePetition.audit.feederCode} (Band {activePetition.audit.bandCode})
                    </p>
                  </div>
                </div>

                <p>
                  <strong>1. Statutory Grounds of Complaint:</strong> For the billing cycle{' '}
                  <span className="font-mono">
                    {activePetition.audit.billingPeriodStart} to {activePetition.audit.billingPeriodEnd}
                  </span>
                  , Enugu Electricity Distribution Company (EEDC) served an estimated bill of{' '}
                  <strong className="font-mono">{formatNaira(activePetition.audit.billedAmountNgn)}</strong>.
                  Under <strong>NERC Order No. NERC/197/2020 (Capping of Estimated Bills)</strong> and the
                  Service-Based Tariff (SBT) Customer Protection Regulations 2023, an unmetered consumer cannot be
                  billed in excess of the monthly energy cap proportional to verified feeder availability.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
                  <p className="font-semibold text-slate-900 mb-2">
                    2. Verified Overcharge Schedule (Exhibit A Summary)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Actual Supply</span>
                      <span className="font-semibold text-slate-900">
                        {activePetition.audit.actualSupplyHours.toFixed(1)}h /{' '}
                        {activePetition.audit.expectedBandHours.toFixed(0)}h
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">NERC Max Cap</span>
                      <span className="font-semibold text-slate-900">
                        {activePetition.audit.nercMaxCapKwh.toFixed(2)} kWh
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Lawful Cap Bill</span>
                      <span className="font-semibold text-emerald-700">
                        {formatNaira(activePetition.audit.lawfulMaxBillNgn)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Claimed Refund</span>
                      <span className="font-semibold text-red-700">
                        {formatNaira(activePetition.audit.overchargeNgn)}
                      </span>
                    </div>
                  </div>
                </div>

                <p>
                  <strong>3. Prayer for Relief:</strong> Complainant demands (a) immediate credit adjustment of{' '}
                  <strong className="font-mono">{formatNaira(activePetition.audit.overchargeNgn)}</strong>{' '}
                  within 15 business days, (b) suspension of any disconnection notice pending resolution per NERC
                  CPR 2023, and (c) review of feeder band classification if actual daily average remains below{' '}
                  {NERC_TARIFF_BANDS[activePetition.audit.bandCode].minDailyHours}h/day.
                </p>

                {billPreviewUrl && (
                  <div className="border border-slate-200 rounded-md p-3">
                    <p className="font-semibold text-slate-900 mb-2">
                      Exhibit B: Attached EEDC Monthly Bill Scan ({billFileName})
                    </p>
                    <img
                      src={billPreviewUrl}
                      alt="Uploaded EEDC monthly bill scan"
                      className="max-h-40 rounded border border-slate-200 object-contain"
                    />
                  </div>
                )}

                <div className="border border-slate-200 rounded-md p-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">
                      Exhibit A: Section 84 Evidence Act 2011 Cryptographic Certificate
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Continuous 5-minute IoT sensor telemetry fused with geo-verified resident consensus. Closing
                      SHA-256 hash:
                    </p>
                    <p className="font-mono text-[11px] text-slate-900 break-all">
                      {activePetition.audit.evidenceClosingHash}
                    </p>
                  </div>
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    className="shrink-0 border border-slate-300 p-1 bg-white"
                    aria-label="Exhibit A cryptographic verification QR code"
                  >
                    <rect x="2" y="2" width="6" height="6" fill="#0f172a" />
                    <rect x="16" y="2" width="6" height="6" fill="#0f172a" />
                    <rect x="2" y="16" width="6" height="6" fill="#0f172a" />
                    <rect x="10" y="4" width="2" height="2" fill="#0f172a" />
                    <rect x="10" y="10" width="4" height="4" fill="#0f172a" />
                    <rect x="16" y="12" width="2" height="4" fill="#0f172a" />
                    <rect x="10" y="18" width="4" height="2" fill="#0f172a" />
                    <rect x="18" y="18" width="4" height="4" fill="#0f172a" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select or generate a dispute petition to preview Exhibit A.</p>
          )}
        </div>
      </div>

      {/* Dispute Resolution Tracker Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              NERC &amp; EEDC Dispute Resolution Tracker
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks 15-business-day statutory EEDC response windows and automatic NERC Forum escalation dockets
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600">{petitions.length} active cases</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Ticket Ref</th>
                <th className="py-2 px-3 font-medium">Complainant / Feeder</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium text-right">Billed</th>
                <th className="py-2 px-3 font-medium text-right">Claimed Refund</th>
                <th className="py-2 px-3 font-medium">Statutory Due</th>
                <th className="py-2 pl-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {petitions.map((pet) => (
                <tr
                  key={pet.id}
                  onClick={() => setActivePetitionId(pet.id)}
                  className={`cursor-pointer transition-colors ${
                    activePetition?.id === pet.id ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3 pr-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {pet.ticketReference}
                    <span className="block text-[11px] font-normal text-slate-500">
                      {pet.nercDocketNo ?? pet.eedcTicketNo}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-900 block">{pet.audit.customerName}</span>
                    <span className="text-[11px] text-slate-500">{pet.audit.feederName}</span>
                  </td>
                  <td className="py-3 px-3">
                    <DisputeStatusLabel status={pet.status} />
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {formatNaira(pet.audit.billedAmountNgn)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-red-700">
                    {formatNaira(pet.audit.overchargeNgn)}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {pet.statutoryDueAt.slice(0, 10)}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {pet.status === 'SUBMITTED_TO_EEDC' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEscalatePetition(pet.id);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 whitespace-nowrap"
                      >
                        <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                        <span>Escalate to NERC</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePetitionId(pet.id);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 underline whitespace-nowrap"
                      >
                        <Scale className="w-3 h-3" aria-hidden="true" />
                        <span>Inspect Exhibit A</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
