export type PowerState = 'ON' | 'OFF' | 'LOW_VOLTAGE' | 'FLUCTUATING';

export type BandCode = 'A' | 'B' | 'C' | 'D' | 'E';

export type CustomerClass = 'R2_RESIDENTIAL' | 'C1_COMMERCIAL';

export type FaultCategory =
  | 'TOTAL_BLACKOUT'
  | 'LOW_VOLTAGE_BROWNOUT'
  | 'TRANSFORMER_SPARK_FAULT'
  | 'FALLEN_POLE_CABLE'
  | 'PHASE_OUTAGE';

export type DisputeStatus =
  | 'AUDIT_COMPLETED'
  | 'SUBMITTED_TO_EEDC'
  | 'ESCALATED_TO_NERC'
  | 'ESCALATED_TO_FCCPC'
  | 'RESOLVED_ADJUSTED';

export interface NercTariffBand {
  bandCode: BandCode;
  bandName: string;
  minDailyHours: number;
  maxDailyHours: number;
  tariffNgnPerKwh: number;
  residentialCapKwhMo: number;
  commercialCapKwhMo: number;
  vatRate: number;
  nercOrderRef: string;
}

export interface Feeder {
  id: string;
  feederCode: string;
  name: string;
  voltageLevelKv: number;
  injectionSubstation: string;
  areaCluster: string;
  bandCode: BandCode;
  currentState: PowerState;
  lastVoltageV: number;
  lastFrequencyHz: number;
  lastTelemetryAt: string;
  rolling30dAvgDailyHours: number;
  monthlySupplyHoursOct: number;
  deviceUid: string;
  mapX: number;
  mapY: number;
  corridorPath: string;
}

export interface TelemetryLogEntry {
  feederId: string;
  sequenceNo: number;
  recordedAt: string;
  consensusState: PowerState;
  rawDeviceState: PowerState;
  voltageL1V: number;
  frequencyHz: number;
  intervalSeconds: number;
  supplyCreditedSec: number;
  consensusConfidence: number;
  crowdConfirmCount: number;
  prevHash: string;
  payloadHash: string;
  chainHash: string;
  signingKeyId: string;
  tampered?: boolean;
}

export interface OutageReport {
  id: string;
  clientIdempotencyKey: string;
  feederId: string;
  feederName: string;
  source: 'PWA' | 'USSD' | 'FIELD_AGENT';
  reportedState: PowerState;
  faultCategory: FaultCategory;
  description: string;
  distanceToFeederM: number;
  validationWeight: number;
  occurredAt: string;
  syncStatus: 'QUEUED_OFFLINE' | 'SYNCED';
}

export interface BillingAuditResult {
  id: string;
  feederId: string;
  feederCode: string;
  feederName: string;
  bandCode: BandCode;
  eedcAccountNo: string;
  customerName: string;
  customerAddress: string;
  customerClass: CustomerClass;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  billedAmountNgn: number;
  billedKwh: number;
  actualSupplyHours: number;
  expectedBandHours: number;
  uptimeRatio: number;
  nercMaxCapKwh: number;
  tariffNgnPerKwh: number;
  vatNgn: number;
  lawfulMaxBillNgn: number;
  overchargeNgn: number;
  isNercViolation: boolean;
  evidenceClosingHash: string;
  createdAt: string;
}

export interface DisputePetition {
  id: string;
  ticketReference: string;
  audit: BillingAuditResult;
  status: DisputeStatus;
  eedcTicketNo: string;
  nercDocketNo?: string;
  submittedAt: string;
  statutoryDueAt: string;
  adjustedRefundNgn: number;
  targetRecipients: string[];
}

export interface SolarCluster {
  id: string;
  clusterCode: string;
  name: string;
  areaLocation: string;
  operatorName: string;
  installedPvKwp: number;
  batteryCapacityKwh: number;
  batterySocPct: number;
  tariffNgnPerKwh: number;
  activeSmes: number;
  dailyPvYieldKwh: number;
  stsSupplyGroupCode: string;
}

export interface SmeMeter {
  id: string;
  meterDrn: string;
  clusterId: string;
  clusterName: string;
  ownerName: string;
  businessName: string;
  shopUnitLabel: string;
  phoneE164: string;
  maxLoadLimitW: number;
  currentLoadW: number;
  baselineGenFuelNgnDay: number;
  cumulativeSolarSpendNgn: number;
  activeDaysCount: number;
  cumulativeKwhVended: number;
  relayState: 'CONNECTED' | 'TRIPPED_OVERLOAD';
}

export interface PaygTokenTransaction {
  id: string;
  idempotencyKey: string;
  gatewayReference: string;
  meterDrn: string;
  businessName: string;
  phoneE164: string;
  channel: 'PAYSTACK_USSD' | 'MONNIFY_TRANSFER' | 'PAYSTACK_CARD';
  amountNgn: number;
  kwhUnits: number;
  token20Digit: string;
  tokenTid: number;
  smsProvider: 'AFRICAS_TALKING' | 'TERMII';
  smsStatus: 'DELIVERED' | 'SENT_FAILOVER';
  vendedAt: string;
}
