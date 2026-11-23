import React, { useState } from 'react';
import {
  BatteryCharging,
  CheckCircle2,
  Coins,
  Cpu,
  MessageSquare,
  Power,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import { PaygTokenTransaction, SmeMeter, SolarCluster } from '../types/awka';
import { formatNaira } from './StatusLabel';

interface SolarPaygViewProps {
  clusters: SolarCluster[];
  meters: SmeMeter[];
  transactions: PaygTokenTransaction[];
  onVendToken: (params: {
    meterDrn: string;
    amountNgn: number;
    channel: 'PAYSTACK_USSD' | 'MONNIFY_TRANSFER' | 'PAYSTACK_CARD';
  }) => PaygTokenTransaction;
  onToggleRelay: (meterId: string) => void;
}

export const SolarPaygView: React.FC<SolarPaygViewProps> = ({
  clusters,
  meters,
  transactions,
  onVendToken,
  onToggleRelay,
}) => {
  const [selectedMeterDrn, setSelectedMeterDrn] = useState<string>(meters[0].meterDrn);
  const [amountNgn, setAmountNgn] = useState<string>('2500');
  const [channel, setChannel] = useState<'PAYSTACK_USSD' | 'MONNIFY_TRANSFER' | 'PAYSTACK_CARD'>(
    'MONNIFY_TRANSFER'
  );
  const [latestVendedTx, setLatestVendedTx] = useState<PaygTokenTransaction | null>(null);

  const selectedMeter = meters.find((m) => m.meterDrn === selectedMeterDrn) ?? meters[0];
  const meterCluster = clusters.find((c) => c.id === selectedMeter.clusterId) ?? clusters[0];
  const estimatedKwh = Math.max(0, (Number(amountNgn) || 0) / meterCluster.tariffNgnPerKwh);

  const totalFuelSavingsNgn = meters.reduce((acc, m) => {
    const genSpend = m.baselineGenFuelNgnDay * m.activeDaysCount;
    return acc + Math.max(0, genSpend - m.cumulativeSolarSpendNgn);
  }, 0);

  const totalActiveSmes = clusters.reduce((acc, c) => acc + c.activeSmes, 0);
  const maxGenDaily = Math.max(...meters.map((m) => m.baselineGenFuelNgnDay), 1);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Math.max(100, Number(amountNgn) || 0);
    const tx = onVendToken({
      meterDrn: selectedMeter.meterDrn,
      amountNgn: numericAmount,
      channel,
    });
    setLatestVendedTx(tx);
  };

  return (
    <div className="space-y-6">
      {/* Top Cluster Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Connected Awka MSMEs</p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {totalActiveSmes} Shops
            </p>
            <span className="text-xs text-slate-500">3 commercial hubs</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">30-Day SME Fuel Savings</p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="text-2xl font-semibold text-emerald-700 font-mono tabular-nums">
              {formatNaira(totalFuelSavingsNgn)}
            </p>
            <span className="text-xs text-slate-500">vs petrol/diesel gen</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">Cluster PV Yield Today</p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
              {clusters.reduce((a, c) => a + c.dailyPvYieldKwh, 0).toFixed(1)} kWh
            </p>
            <span className="text-xs text-slate-500">109.5 kWp total</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500">STS Vending Standard</p>
          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="text-lg font-semibold text-slate-900 font-mono">IEC 62055-41</p>
            <span className="text-xs text-slate-500">STS6 · Base 2014</span>
          </div>
        </div>
      </div>

      {/* Main Split: Solar Hubs, Fuel Savings Chart & Load Monitors + PAYG Checkout Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Solar Micro-Grid Hubs, Fuel Savings Chart & SME Load Relay Table */}
        <div className="lg:col-span-7 space-y-6">
          {/* Commercial Hubs */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Commercial Solar Mini-Grid Clusters
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Eke Awka Commercial Plazas &amp; Ifite Tech Hubs · Live battery SoC &amp; PV generation
                </p>
              </div>
              <Sun className="w-4 h-4 text-amber-600" aria-hidden="true" />
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {clusters.map((cluster) => (
                <div key={cluster.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{cluster.name}</p>
                    <p className="text-xs text-slate-500">
                      {cluster.clusterCode} · SGC {cluster.stsSupplyGroupCode} · {cluster.activeSmes} SMEs
                    </p>
                  </div>
                  <div className="flex items-center gap-5 font-mono text-xs">
                    <div className="text-right">
                      <span className="text-slate-500 block text-[11px]">Battery SoC</span>
                      <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                        <BatteryCharging className="w-3.5 h-3.5" aria-hidden="true" />
                        {cluster.batterySocPct}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block text-[11px]">Tariff</span>
                      <span className="font-semibold text-slate-900">
                        ₦{cluster.tariffNgnPerKwh.toFixed(0)}/kWh
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Generator Fuel vs Solar PAYG Expenditure Comparison */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Daily Energy Cost: Petrol/Diesel Generator vs. Solar PAYG
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Observed daily fuel savings across pilot Eke Awka &amp; Ifite MSMEs
                </p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" />
                  Gen Fuel Baseline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  Solar PAYG Avg
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {meters.map((meter) => {
                const solarDailyAvg = meter.cumulativeSolarSpendNgn / meter.activeDaysCount;
                const genPct = Math.round((meter.baselineGenFuelNgnDay / maxGenDaily) * 100);
                const solarPct = Math.round((solarDailyAvg / maxGenDaily) * 100);
                const savingsPct = Math.round(
                  ((meter.baselineGenFuelNgnDay - solarDailyAvg) / meter.baselineGenFuelNgnDay) * 100
                );

                return (
                  <div key={`chart-${meter.id}`} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-900">{meter.businessName}</span>
                      <span className="font-mono text-[11px] font-semibold text-emerald-700">
                        -{savingsPct}% daily cost (Saves ₦
                        {Math.round(meter.baselineGenFuelNgnDay - solarDailyAvg).toLocaleString()}/day)
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 h-2.5 rounded overflow-hidden">
                          <div className="bg-slate-400 h-full" style={{ width: `${genPct}%` }} />
                        </div>
                        <span className="w-20 text-right font-mono text-[11px] text-slate-600">
                          ₦{meter.baselineGenFuelNgnDay.toLocaleString()}/d
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 h-2.5 rounded overflow-hidden">
                          <div className="bg-emerald-600 h-full" style={{ width: `${solarPct}%` }} />
                        </div>
                        <span className="w-20 text-right font-mono text-[11px] text-emerald-700 font-semibold">
                          ₦{Math.round(solarDailyAvg).toLocaleString()}/d
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SME Meters & Overload Relay Monitor */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  SME Smart Meters, Load Relays &amp; 30-Day Net Savings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time wattage enforcement &amp; cumulative Naira savings vs. generator expenditure
                </p>
              </div>
              <Cpu className="w-4 h-4 text-slate-500" aria-hidden="true" />
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">SME / Meter DRN</th>
                    <th className="py-2 px-3 font-medium">Load / Limit</th>
                    <th className="py-2 px-3 font-medium">Relay</th>
                    <th className="py-2 px-3 font-medium text-right">30d Net Savings</th>
                    <th className="py-2 pl-3 font-medium text-right">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {meters.map((meter) => {
                    const genBaseline = meter.baselineGenFuelNgnDay * meter.activeDaysCount;
                    const netSavings = genBaseline - meter.cumulativeSolarSpendNgn;
                    const isTripped = meter.relayState === 'TRIPPED_OVERLOAD';
                    return (
                      <tr key={meter.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3">
                          <span className="font-medium text-slate-900 block">
                            {meter.businessName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {meter.meterDrn} · {meter.shopUnitLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {meter.currentLoadW}W / {meter.maxLoadLimitW}W
                        </td>
                        <td className="py-2.5 px-3">
                          {isTripped ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
                              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Tripped Overload</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Connected</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                          {formatNaira(netSavings)}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <button
                            type="button"
                            onClick={() => onToggleRelay(meter.id)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                          >
                            <Power className="w-3 h-3" aria-hidden="true" />
                            <span>{isTripped ? 'Reset Relay' : 'Test Overload'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Paystack / Monnify PAYG Checkout & STS 20-Digit Token Vending */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">
              Solar PAYG Checkout &amp; STS Token Vending
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Paystack/Monnify HMAC-SHA512 webhook -&gt; IEC 62055-41 20-digit token -&gt; SMS
            </p>
          </div>

          <form onSubmit={handleCheckoutSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select SME Smart Meter
              </label>
              <select
                value={selectedMeterDrn}
                onChange={(e) => setSelectedMeterDrn(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                {meters.map((m) => (
                  <option key={m.id} value={m.meterDrn}>
                    {m.meterDrn} — {m.businessName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Purchase Amount (₦)
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={amountNgn}
                  onChange={(e) => setAmountNgn(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) =>
                    setChannel(
                      e.target.value as 'PAYSTACK_USSD' | 'MONNIFY_TRANSFER' | 'PAYSTACK_CARD'
                    )
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="MONNIFY_TRANSFER">Monnify NUBAN Transfer</option>
                  <option value="PAYSTACK_USSD">Paystack USSD (*737# / *901#)</option>
                  <option value="PAYSTACK_CARD">Paystack Debit Card</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[500, 1000, 2500, 5000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountNgn(String(preset))}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                    Number(amountNgn) === preset
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ₦{preset.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Realistic Nigerian Gateway Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Cluster Tariff</span>
                <span className="font-mono text-slate-900">
                  ₦{meterCluster.tariffNgnPerKwh.toFixed(2)} / kWh
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Energy Credited</span>
                <span className="font-mono font-semibold text-slate-900">
                  {estimatedKwh.toFixed(3)} kWh
                </span>
              </div>
              {channel === 'MONNIFY_TRANSFER' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Dedicated NUBAN</span>
                  <span className="font-mono text-slate-800">
                    Moniepoint 8091234567
                  </span>
                </div>
              )}
              {channel === 'PAYSTACK_USSD' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank USSD String</span>
                  <span className="font-mono text-slate-800">
                    *737*000*{Number(amountNgn) || 0}#
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">SMS Recipient</span>
                <span className="font-mono text-slate-700">{selectedMeter.phoneE164}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Verify Webhook &amp; Vend 20-Digit STS Token</span>
            </button>
          </form>

          {latestVendedTx && (
            <div className="mt-4 border border-emerald-200 bg-emerald-50 rounded-md p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-900 inline-flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>STS Token Vended &amp; Dispatched</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-800">
                  TID #{latestVendedTx.tokenTid}
                </span>
              </div>
              <p className="text-lg font-mono font-bold tracking-wider text-slate-900 bg-white border border-emerald-200 rounded px-3 py-2 text-center">
                {latestVendedTx.token20Digit}
              </p>
              <p className="text-[11px] text-emerald-900">
                Enter the 20 digits on the SME meter CIU keypad and press <strong># / Enter</strong>.
              </p>
              <p className="text-[11px] text-emerald-800 font-mono">
                {latestVendedTx.kwhUnits.toFixed(3)} kWh · Ref {latestVendedTx.gatewayReference} ·{' '}
                {latestVendedTx.smsProvider}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* STS Vending & SMS Delivery Audit Log */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Idempotent PAYG Ledger &amp; STS Token SMS Delivery Log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Africa&apos;s Talking primary dispatch with Termii DND-bypass failover for MTN/Airtel subscribers
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">{transactions.length} transactions</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Gateway Ref</th>
                <th className="py-2 px-3 font-medium">SME / Meter</th>
                <th className="py-2 px-3 font-medium">Channel</th>
                <th className="py-2 px-3 font-medium text-right">Amount</th>
                <th className="py-2 px-3 font-medium text-right">kWh</th>
                <th className="py-2 px-3 font-medium">20-Digit STS Token</th>
                <th className="py-2 pl-3 font-medium">SMS Route</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-mono text-slate-800 whitespace-nowrap">
                    {tx.gatewayReference}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-slate-900 block">{tx.businessName}</span>
                    <span className="font-mono text-[11px] text-slate-500">{tx.meterDrn}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{tx.channel}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                    {formatNaira(tx.amountNgn)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                    {tx.kwhUnits.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {tx.token20Digit}
                  </td>
                  <td className="py-2.5 pl-3 font-mono text-[11px]">
                    <span
                      className={
                        tx.smsStatus === 'SENT_FAILOVER'
                          ? 'text-amber-700 font-semibold'
                          : 'text-emerald-700 font-semibold'
                      }
                    >
                      {tx.smsProvider} ({tx.smsStatus === 'SENT_FAILOVER' ? 'DND Failover' : 'Delivered'})
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
