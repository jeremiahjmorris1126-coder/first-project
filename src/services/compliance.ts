import crypto from 'node:crypto';
import {
  DutyStatus,
  HosDutyEvent,
  HosClocks,
  DvirReport,
  DvirItemCheck,
} from '../types/index.js';

class ComplianceService {
  private events: Map<string, HosDutyEvent[]> = new Map();
  private dvirRegistry: Map<string, DvirReport> = new Map();

  constructor() {
    // Seed initial demo driver data for cockpit testing
    this.seedDemoData();
  }

  private seedDemoData() {
    const demoDriverId = 'DRV-7701';
    const now = Date.now();
    const fourHoursAgo = new Date(now - 4 * 3600 * 1000).toISOString();
    const sixHoursAgo = new Date(now - 6 * 3600 * 1000).toISOString();

    this.events.set(demoDriverId, [
      {
        id: 'EVT-1001',
        driverId: demoDriverId,
        status: 'ON_DUTY_NOT_DRIVING',
        timestamp: sixHoursAgo,
        location: 'Dallas, TX - Yard 4',
        odometer: 142850,
        engineHours: 4210.5,
        notes: 'Pre-trip safety inspection complete',
      },
      {
        id: 'EVT-1002',
        driverId: demoDriverId,
        status: 'DRIVING',
        timestamp: fourHoursAgo,
        location: 'I-35N Mile Marker 120, TX',
        odometer: 142875,
        engineHours: 4212.5,
        notes: 'Dispatched outbound freight load #LD-8892',
      },
    ]);

    // Seed sample DVIR with cryptographic seal
    const dvirPayload = {
      id: 'DVIR-9042',
      vehicleId: 'TRK-900',
      trailerId: 'TRL-440',
      driverId: demoDriverId,
      driverName: 'Jeremiah Morris',
      odometer: 142850,
      inspectionType: 'PRE_TRIP' as const,
      timestamp: sixHoursAgo,
      items: [
        { category: 'BRAKES' as const, passed: true },
        { category: 'STEERING' as const, passed: true },
        { category: 'TIRES' as const, passed: true },
        { category: 'LIGHTING' as const, passed: true },
        { category: 'COUPLING' as const, passed: true },
        { category: 'SUSPENSION' as const, passed: true },
        { category: 'EXHAUST' as const, passed: true },
        { category: 'EMERGENCY_EQUIPMENT' as const, passed: true },
      ],
      defectsCorrected: true,
      mechanicCertificationRequired: false,
      driverSignature: 'Jeremiah Morris [Digital Verified]',
    };

    const seal = this.computeSha256Seal(dvirPayload);
    this.dvirRegistry.set(dvirPayload.id, { ...dvirPayload, sha256Seal: seal });
  }

  public recordDutyEvent(
    driverId: string,
    status: DutyStatus,
    location: string,
    odometer: number,
    engineHours: number,
    notes?: string
  ): HosDutyEvent {
    const event: HosDutyEvent = {
      id: `EVT-${Date.now().toString(36).toUpperCase()}`,
      driverId,
      status,
      timestamp: new Date().toISOString(),
      location,
      odometer,
      engineHours,
      notes,
    };

    const list = this.events.get(driverId) || [];
    list.push(event);
    this.events.set(driverId, list);
    return event;
  }

  public getClocks(driverId: string): HosClocks {
    const list = this.events.get(driverId) || [];
    const now = Date.now();

    if (list.length === 0) {
      return {
        driverId,
        currentStatus: 'OFF_DUTY',
        statusStartTime: new Date().toISOString(),
        drivingSecondsRemaining: 11 * 3600,
        shiftSecondsRemaining: 14 * 3600,
        cycleSecondsRemaining: 70 * 3600,
        breakSecondsRemaining: 8 * 3600,
        isViolation: false,
        violations: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const currentEvent = list[list.length - 1];
    const eventTime = new Date(currentEvent.timestamp).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - eventTime) / 1000));

    // Simple FMCSA 49 CFR Part 395 calculation
    let driveSecondsUsed = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const nextTime = i < list.length - 1 ? new Date(list[i + 1].timestamp).getTime() : now;
      const durationSec = Math.max(0, Math.floor((nextTime - new Date(e.timestamp).getTime()) / 1000));
      if (e.status === 'DRIVING') {
        driveSecondsUsed += durationSec;
      }
    }

    const drivingSecondsRemaining = Math.max(0, 11 * 3600 - driveSecondsUsed);
    const shiftSecondsRemaining = Math.max(0, 14 * 3600 - (driveSecondsUsed + (currentEvent.status === 'ON_DUTY_NOT_DRIVING' ? elapsedSeconds : 0)));
    const cycleSecondsRemaining = Math.max(0, 70 * 3600 - driveSecondsUsed);
    const breakSecondsRemaining = Math.max(0, 8 * 3600 - (driveSecondsUsed % (8 * 3600)));

    const violations: string[] = [];
    if (drivingSecondsRemaining === 0 && currentEvent.status === 'DRIVING') {
      violations.push('FMCSA 395.3(a)(3)(i): Exceeded 11-hour driving maximum');
    }
    if (shiftSecondsRemaining === 0 && (currentEvent.status === 'DRIVING' || currentEvent.status === 'ON_DUTY_NOT_DRIVING')) {
      violations.push('FMCSA 395.3(a)(2): Exceeded 14-hour on-duty shift window');
    }

    return {
      driverId,
      currentStatus: currentEvent.status,
      statusStartTime: currentEvent.timestamp,
      drivingSecondsRemaining,
      shiftSecondsRemaining,
      cycleSecondsRemaining,
      breakSecondsRemaining,
      isViolation: violations.length > 0,
      violations,
      lastUpdated: new Date().toISOString(),
    };
  }

  public computeSha256Seal(data: Record<string, unknown>): string {
    // Canonical deterministic JSON representation for cryptographic compliance
    const canonicalString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  public createDvir(
    vehicleId: string,
    driverId: string,
    driverName: string,
    odometer: number,
    inspectionType: 'PRE_TRIP' | 'POST_TRIP',
    items: DvirItemCheck[],
    driverSignature: string,
    trailerId?: string,
    mechanicSignature?: string
  ): DvirReport {
    const hasDefects = items.some((item) => !item.passed);
    const id = `DVIR-${Date.now().toString(36).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const unsignedPayload = {
      id,
      vehicleId,
      trailerId,
      driverId,
      driverName,
      odometer,
      inspectionType,
      timestamp,
      items,
      defectsCorrected: !hasDefects,
      mechanicCertificationRequired: hasDefects,
      mechanicSignature,
      driverSignature,
    };

    const sha256Seal = this.computeSha256Seal(unsignedPayload);

    const report: DvirReport = {
      ...unsignedPayload,
      sha256Seal,
    };

    this.dvirRegistry.set(id, report);
    return report;
  }

  public getDvir(id: string): DvirReport | undefined {
    return this.dvirRegistry.get(id);
  }

  public getAllDvirReports(): DvirReport[] {
    return Array.from(this.dvirRegistry.values()).reverse();
  }

  public verifyDvirSeal(id: string): { verified: boolean; storedSeal?: string; calculatedSeal?: string; error?: string } {
    const report = this.dvirRegistry.get(id);
    if (!report) {
      return { verified: false, error: 'DVIR record not found' };
    }

    const { sha256Seal, ...unsigned } = report;
    const recalculated = this.computeSha256Seal(unsigned);

    return {
      verified: sha256Seal === recalculated,
      storedSeal: sha256Seal,
      calculatedSeal: recalculated,
    };
  }
}

export const complianceService = new ComplianceService();
