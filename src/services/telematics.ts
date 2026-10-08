import {
  J1939TelemetryPacket,
  PredictiveMaintenanceAssessment,
} from '../types/index.js';

interface MtbfLedgerEntry {
  spn: number;
  fmi: number;
  component: string;
  historicalLedgerMtbfHours: number;
  defaultSeverity: 'INFO' | 'MODERATE' | 'CRITICAL' | 'CATASTROPHIC_FAILURE_IMMINENT';
  recommendedAction: string;
  estimatedLaborMinutes: number;
  failureRateMultiplier: number;
}

const MTBF_LEDGER: MtbfLedgerEntry[] = [
  {
    spn: 110,
    fmi: 0,
    component: 'Engine Cooling System - Thermostat & Water Pump',
    historicalLedgerMtbfHours: 48,
    defaultSeverity: 'CRITICAL',
    recommendedAction: 'Immediate pull-over recommended. Inspect coolant reservoir and fan clutch solenoid.',
    estimatedLaborMinutes: 90,
    failureRateMultiplier: 0.15,
  },
  {
    spn: 100,
    fmi: 1,
    component: 'Lubrication System - Oil Pump & Pressure Relief Valve',
    historicalLedgerMtbfHours: 24,
    defaultSeverity: 'CATASTROPHIC_FAILURE_IMMINENT',
    recommendedAction: 'Shut down engine immediately. Verify oil sump level and sensor harness continuity.',
    estimatedLaborMinutes: 180,
    failureRateMultiplier: 0.05,
  },
  {
    spn: 3251,
    fmi: 2,
    component: 'Aftertreatment DPF Differential Pressure Sensor',
    historicalLedgerMtbfHours: 160,
    defaultSeverity: 'MODERATE',
    recommendedAction: 'Initiate parked DPF regeneration within next 200 miles or service exhaust pressure tubes.',
    estimatedLaborMinutes: 60,
    failureRateMultiplier: 0.35,
  },
  {
    spn: 1761,
    fmi: 1,
    component: 'DEF Dosing System - Urea Tank Quality/Level',
    historicalLedgerMtbfHours: 72,
    defaultSeverity: 'MODERATE',
    recommendedAction: 'Refill DEF tank with API-certified DEF fluid within 45 operating miles to avoid 5 MPH derate.',
    estimatedLaborMinutes: 15,
    failureRateMultiplier: 0.2,
  },
  {
    spn: 629,
    fmi: 12,
    component: 'ECM Electronic Control Module - Internal Microcontroller',
    historicalLedgerMtbfHours: 250,
    defaultSeverity: 'CRITICAL',
    recommendedAction: 'Flash ECM calibration firmware or swap auxiliary vehicle gateway module.',
    estimatedLaborMinutes: 120,
    failureRateMultiplier: 0.4,
  },
  {
    spn: 84,
    fmi: 2,
    component: 'Wheel Speed Sensor - Drive Axle 1 Right',
    historicalLedgerMtbfHours: 320,
    defaultSeverity: 'INFO',
    recommendedAction: 'Clean ABS tone ring and verify air gap spacing during upcoming routine PM service.',
    estimatedLaborMinutes: 45,
    failureRateMultiplier: 0.6,
  },
];

class TelematicsService {
  private latestTelemetry: Map<string, J1939TelemetryPacket> = new Map();
  private wsClients: Set<(packet: J1939TelemetryPacket) => void> = new Set();

  constructor() {
    this.seedDemoTelemetry();
  }

  private seedDemoTelemetry() {
    const demoPacket: J1939TelemetryPacket = {
      vehicleId: 'TRK-900',
      timestamp: new Date().toISOString(),
      engineRpm: 1450,
      speedMph: 63.4,
      coolantTempC: 89.2,
      oilPressurePsi: 44.8,
      defLevelPercent: 78,
      fuelRateGph: 7.2,
      totalEngineHours: 4212.5,
      odometerMiles: 142875,
      activeDtcs: [
        {
          spn: 3251,
          fmi: 2,
          description: 'DPF Differential Pressure Data Erratic',
          occurrenceCount: 3,
        },
      ],
    };
    this.latestTelemetry.set(demoPacket.vehicleId, demoPacket);
  }

  public registerBroadcaster(callback: (packet: J1939TelemetryPacket) => void): () => void {
    this.wsClients.add(callback);
    return () => this.wsClients.delete(callback);
  }

  public ingestTelemetry(packet: J1939TelemetryPacket): {
    stored: boolean;
    activeDtcsCount: number;
    predictiveAlerts: PredictiveMaintenanceAssessment[];
  } {
    this.latestTelemetry.set(packet.vehicleId, packet);

    // Broadcast to live WebSocket clients
    this.wsClients.forEach((cb) => {
      try {
        cb(packet);
      } catch {
        // ignore client push error
      }
    });

    const predictiveAlerts = this.forecastMaintenance(packet.activeDtcs);

    return {
      stored: true,
      activeDtcsCount: packet.activeDtcs?.length || 0,
      predictiveAlerts,
    };
  }

  public getLatestVehicleTelemetry(vehicleId: string): J1939TelemetryPacket | undefined {
    return this.latestTelemetry.get(vehicleId);
  }

  public getAllVehicles(): J1939TelemetryPacket[] {
    return Array.from(this.latestTelemetry.values());
  }

  public forecastMaintenance(
    dtcs: Array<{ spn: number; fmi: number }>
  ): PredictiveMaintenanceAssessment[] {
    if (!dtcs || dtcs.length === 0) {
      return [];
    }

    const assessments: PredictiveMaintenanceAssessment[] = [];

    for (const dtc of dtcs) {
      const match = MTBF_LEDGER.find((m) => m.spn === dtc.spn && m.fmi === dtc.fmi);
      if (match) {
        const remainingHours = Math.round(match.historicalLedgerMtbfHours * match.failureRateMultiplier * 10) / 10;
        assessments.push({
          spn: match.spn,
          fmi: match.fmi,
          component: match.component,
          severity: match.defaultSeverity,
          historicalLedgerMtbfHours: match.historicalLedgerMtbfHours,
          estimatedRemainingSafeOperatingHours: remainingHours,
          recommendedAction: match.recommendedAction,
          estimatedLaborMinutes: match.estimatedLaborMinutes,
        });
      } else {
        // Generic assessment for unrecognized SPN/FMI
        assessments.push({
          spn: dtc.spn,
          fmi: dtc.fmi,
          component: `SAE J1939 Subsystem (SPN ${dtc.spn} / FMI ${dtc.fmi})`,
          severity: 'MODERATE',
          historicalLedgerMtbfHours: 100,
          estimatedRemainingSafeOperatingHours: 24.0,
          recommendedAction: 'Connect OEM diagnostic adapter (Cummins INSITE / Detroit Diagnostic Link) for guided troubleshooting.',
          estimatedLaborMinutes: 60,
        });
      }
    }

    return assessments;
  }
}

export const telematicsService = new TelematicsService();
