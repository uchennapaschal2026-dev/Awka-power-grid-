import React, { useState } from 'react';
import { Phone, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { NERC_TARIFF_BANDS } from '../data/awkaSeed';
import { DisputePetition, Feeder, OutageReport, PaygTokenTransaction, SmeMeter } from '../types/awka';

interface UssdLabViewProps {
  feeders: Feeder[];
  petitions: DisputePetition[];
  meters: SmeMeter[];
  outageReports: OutageReport[];
  onSyncOfflineQueue: () => void;
  onVendFromUssd: (params: {
    meterDrn: string;
    amountNgn: number;
    channel: 'PAYSTACK_USSD';
  }) => PaygTokenTransaction;
}

type UssdScreenId =
  | 'MAIN'
  | 'AREA_CHECK'
  | 'CHECK_RESULT'
  | 'AREA_REPORT'
  | 'FAULT_TYPE'
  | 'REPORT_DONE'
  | 'BILL_AREA'
  | 'BILL_CLASS'
  | 'BILL_AMOUNT'
  | 'BILL_RESULT'
  | 'PAYG_METER'
  | 'PAYG_AMOUNT'
  | 'PAYG_RESULT'
  | 'DISPUTE_REF'
  | 'DISPUTE_RESULT';

export const UssdLabView: React.FC<UssdLabViewProps> = ({
  feeders,
  petitions,
  meters,
  outageReports,
  onSyncOfflineQueue,
  onVendFromUssd,
}) => {
  const [screen, setScreen] = useState<UssdScreenId>('MAIN');
  const [inputVal, setInputVal] = useState('');
  const [selectedAreaIdx, setSelectedAreaIdx] = useState<number>(0);
  const [billClass, setBillClass] = useState<'R2_RESIDENTIAL' | 'C1_COMMERCIAL'>('C1_COMMERCIAL');
  const [billAmount, setBillAmount] = useState<number>(45000);
  const [selectedMeterDrn, setSelectedMeterDrn] = useState<string>(meters[0].meterDrn);
  const [vendedResult, setVendedResult] = useState<PaygTokenTransaction | null>(null);
  const [disputeTicketInput, setDisputeTicketInput] = useState<string>('00419');

  const selectedFeeder = feeders[selectedAreaIdx] ?? feeders[0];
  const selectedBand = NERC_TARIFF_BANDS[selectedFeeder.bandCode];

  const renderScreenText = (): { text: string; isEnd: boolean } => {
    switch (screen) {
      case 'MAIN':
        return {
          isEnd: false,
          text: `Awka Power Hub\n1. Check Feeder Power\n2. Report Outage/Fault\n3. Check Fair Bill Cap\n4. Buy Solar PAYG Token\n5. Dispute Status`,
        };
      case 'AREA_CHECK':
      case 'AREA_REPORT':
      case 'BILL_AREA':
        return {
          isEnd: false,
          text: `Select Awka Area:\n1. Ifite-Awka\n2. Aroma\n3. Zik's Avenue\n4. Okpuno\n5. Eke Awka\n0. Back`,
        };
      case 'CHECK_RESULT': {
        const ratio = Math.min(
          100,
          Math.round((selectedFeeder.rolling30dAvgDailyHours / selectedBand.minDailyHours) * 100)
        );
        return {
          isEnd: true,
          text: `${selectedFeeder.areaCluster} (Band ${selectedFeeder.bandCode}): ${selectedFeeder.currentState}\nVolt: ${selectedFeeder.lastVoltageV.toFixed(0)}V | Avg: ${selectedFeeder.rolling30dAvgDailyHours.toFixed(1)}h/d\nBand Target: ${selectedBand.minDailyHours}h/d (${ratio}%)`,
        };
      }
      case 'FAULT_TYPE':
        return {
          isEnd: false,
          text: `Fault on ${selectedFeeder.areaCluster}:\n1. Total Blackout\n2. Low Voltage\n3. Transformer Spark\n4. Fallen Cable\n0. Back`,
        };
      case 'REPORT_DONE':
        return {
          isEnd: true,
          text: `Report logged for ${selectedFeeder.areaCluster}.\nRef: OUT-90421\nHelps verify EEDC hours. SMS alert sent on restore.`,
        };
      case 'BILL_CLASS':
        return {
          isEnd: false,
          text: `Customer Type:\n1. Residential (Home)\n2. Commercial (Shop/SME)\n0. Back`,
        };
      case 'BILL_AMOUNT':
        return {
          isEnd: false,
          text: `Enter EEDC bill amount in Naira for last month (e.g. 45000):`,
        };
      case 'BILL_RESULT': {
        const expected = selectedBand.minDailyHours * 31;
        const uptimeRatio = Math.min(1, selectedFeeder.monthlySupplyHoursOct / expected);
        const capKwh =
          (billClass === 'C1_COMMERCIAL'
            ? selectedBand.commercialCapKwhMo
            : selectedBand.residentialCapKwhMo) * uptimeRatio;
        const lawful = Math.round(capKwh * selectedBand.tariffNgnPerKwh * (1 + selectedBand.vatRate));
        const overcharge = Math.max(0, billAmount - lawful);
        return {
          isEnd: true,
          text: `Oct: ${selectedFeeder.monthlySupplyHoursOct.toFixed(1)}h (${Math.round(
            uptimeRatio * 100
          )}% Band ${selectedFeeder.bandCode})\nLawful NERC Cap: N${lawful.toLocaleString()}\nOvercharge: N${overcharge.toLocaleString()}`,
        };
      }
      case 'PAYG_METER':
        return {
          isEnd: false,
          text: `Enter 11-digit Solar Meter No. (e.g. ${meters[0].meterDrn}):`,
        };
      case 'PAYG_AMOUNT':
        return {
          isEnd: false,
          text: `Meter ${selectedMeterDrn}\nSelect Top-Up:\n1. N500 (2.8 kWh)\n2. N1,000 (5.6 kWh)\n3. N2,500 (13.9 kWh)\n0. Back`,
        };
      case 'PAYG_RESULT':
        return {
          isEnd: true,
          text: vendedResult
            ? `PAID N${vendedResult.amountNgn.toLocaleString()} (${vendedResult.kwhUnits.toFixed(
                2
              )} kWh)\nToken: ${vendedResult.token20Digit}\nSMS sent via ${vendedResult.smsProvider}`
            : 'Transaction completed. Token sent via SMS.',
        };
      case 'DISPUTE_REF':
        return {
          isEnd: false,
          text: `Enter Dispute Ref digits (e.g. 00419):`,
        };
      case 'DISPUTE_RESULT': {
        const match =
          petitions.find((p) => p.ticketReference.includes(disputeTicketInput)) ?? petitions[0];
        return {
          isEnd: true,
          text: `Ref: ${match.ticketReference}\nStatus: ${match.status}\nClaim: N${Math.round(
            match.audit.overchargeNgn
          ).toLocaleString()}\nDue: ${match.statutoryDueAt.slice(0, 10)}`,
        };
      }
    }
  };

  const currentScreen = renderScreenText();
  const charCount = currentScreen.text.length + (currentScreen.isEnd ? 4 : 4); // accounts for "CON " or "END "

  const handleUssdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputVal.trim();
    setInputVal('');

    if (screen === 'MAIN') {
      if (val === '1') setScreen('AREA_CHECK');
      else if (val === '2') setScreen('AREA_REPORT');
      else if (val === '3') setScreen('BILL_AREA');
      else if (val === '4') setScreen('PAYG_METER');
      else if (val === '5') setScreen('DISPUTE_REF');
      return;
    }

    if (val === '0') {
      setScreen('MAIN');
      return;
    }

    if (screen === 'AREA_CHECK') {
      const idx = Math.max(0, Math.min(feeders.length - 1, (parseInt(val, 10) || 1) - 1));
      setSelectedAreaIdx(idx);
      setScreen('CHECK_RESULT');
    } else if (screen === 'AREA_REPORT') {
      const idx = Math.max(0, Math.min(feeders.length - 1, (parseInt(val, 10) || 1) - 1));
      setSelectedAreaIdx(idx);
      setScreen('FAULT_TYPE');
    } else if (screen === 'FAULT_TYPE') {
      setScreen('REPORT_DONE');
    } else if (screen === 'BILL_AREA') {
      const idx = Math.max(0, Math.min(feeders.length - 1, (parseInt(val, 10) || 1) - 1));
      setSelectedAreaIdx(idx);
      setScreen('BILL_CLASS');
    } else if (screen === 'BILL_CLASS') {
      setBillClass(val === '1' ? 'R2_RESIDENTIAL' : 'C1_COMMERCIAL');
      setScreen('BILL_AMOUNT');
    } else if (screen === 'BILL_AMOUNT') {
      setBillAmount(Math.max(0, parseInt(val, 10) || 45000));
      setScreen('BILL_RESULT');
    } else if (screen === 'PAYG_METER') {
      const found = meters.find((m) => m.meterDrn === val);
      setSelectedMeterDrn(found ? found.meterDrn : meters[0].meterDrn);
      setScreen('PAYG_AMOUNT');
    } else if (screen === 'PAYG_AMOUNT') {
      const amt = val === '1' ? 500 : val === '2' ? 1000 : 2500;
      const tx = onVendFromUssd({
        meterDrn: selectedMeterDrn,
        amountNgn: amt,
        channel: 'PAYSTACK_USSD',
      });
      setVendedResult(tx);
      setScreen('PAYG_RESULT');
    } else if (screen === 'DISPUTE_REF') {
      setDisputeTicketInput(val || '00419');
      setScreen('DISPUTE_RESULT');
    }
  };

  const queuedReports = outageReports.filter((r) => r.syncStatus === 'QUEUED_OFFLINE');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Feature Phone USSD *347*842# Simulator */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              USSD Gateway Simulator (*347*842#)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Africa&apos;s Talking USSD FSM · Strictly constrained under 160 GSM-7 chars
            </p>
          </div>
          <Phone className="w-4 h-4 text-slate-500" aria-hidden="true" />
        </div>

        {/* Handset Screen */}
        <div className="mt-4 bg-slate-900 text-slate-100 rounded-lg p-4 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-2 border-b border-slate-800">
            <span>*347*842# ({currentScreen.isEnd ? 'END' : 'CON'})</span>
            <span className={charCount <= 160 ? 'text-emerald-400' : 'text-red-400'}>
              {charCount} / 160 chars
            </span>
          </div>

          <pre className="mt-3 text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-100 min-h-[135px]">
            {currentScreen.text}
          </pre>

          {!currentScreen.isEnd ? (
            <form onSubmit={handleUssdSubmit} className="mt-4 flex gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Enter option (e.g. 1)"
                className="flex-1 rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-mono text-white placeholder:text-slate-500"
                autoFocus
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 whitespace-nowrap"
              >
                <Send className="w-3 h-3" aria-hidden="true" />
                <span>Send</span>
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setScreen('MAIN')}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Dial *347*842# Again</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Offline-First IndexedDB Queue & Sync Inspector */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Offline-First PWA Queue (IndexedDB &amp; Background Sync)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              UUIDv7 client idempotency keys guarantee zero duplicate reports during 2G reconnect storms
            </p>
          </div>
          <button
            type="button"
            onClick={onSyncOfflineQueue}
            disabled={queuedReports.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Flush Sync Queue ({queuedReports.length})</span>
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Idempotency Key (UUIDv7)</th>
                <th className="py-2 px-3 font-medium">Feeder / Fault</th>
                <th className="py-2 px-3 font-medium">Occurred At</th>
                <th className="py-2 pl-3 font-medium text-right">Sync State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {outageReports.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-600">
                    {rep.clientIdempotencyKey.slice(0, 18)}…
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-slate-900 block">{rep.feederName}</span>
                    <span className="text-[11px] text-slate-500">{rep.faultCategory}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {rep.occurredAt.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono text-[11px] font-semibold">
                    <span
                      className={
                        rep.syncStatus === 'QUEUED_OFFLINE' ? 'text-amber-700' : 'text-emerald-700'
                      }
                    >
                      {rep.syncStatus === 'QUEUED_OFFLINE' ? 'IndexedDB Pending' : 'Synced'}
                    </span>
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
