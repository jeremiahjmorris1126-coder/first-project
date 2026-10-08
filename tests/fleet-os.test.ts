import { describe, it, expect } from 'vitest';
import { complianceService } from '../src/services/compliance.js';
import { telematicsService } from '../src/services/telematics.js';
import { routingService, CLEARANCE_PROFILES } from '../src/services/routing.js';
import { salesforceService } from '../src/services/salesforce.js';
import { coPilotService } from '../src/services/copilot.js';

describe('PILLAR 1: FMCSA 49 CFR Part 395/396 HOS & DVIR Cryptographic Seal', () => {
  it('should calculate HOS clocks for a driver and track duty status', () => {
    const driverId = 'TEST-DRV-1';
    complianceService.recordDutyEvent(driverId, 'ON_DUTY_NOT_DRIVING', 'Yard A', 1000, 50, 'Shift start');
    const clocks = complianceService.getClocks(driverId);

    expect(clocks.driverId).toBe(driverId);
    expect(clocks.currentStatus).toBe('ON_DUTY_NOT_DRIVING');
    expect(clocks.drivingSecondsRemaining).toBe(11 * 3600);
    expect(clocks.isViolation).toBe(false);
  });

  it('should generate and cryptographically verify SHA-256 seal for DVIR inspection', () => {
    const report = complianceService.createDvir(
      'TRK-999',
      'DRV-TEST',
      'Jeremiah Morris',
      120500,
      'PRE_TRIP',
      [
        { category: 'BRAKES', passed: true },
        { category: 'TIRES', passed: true },
        { category: 'STEERING', passed: true },
      ],
      'Jeremiah Morris [Digital Signature]'
    );

    expect(report.sha256Seal).toBeDefined();
    expect(report.sha256Seal).toHaveLength(64); // Valid SHA-256 hex string

    const verification = complianceService.verifyDvirSeal(report.id);
    expect(verification.verified).toBe(true);
    expect(verification.storedSeal).toBe(report.sha256Seal);
    expect(verification.calculatedSeal).toBe(report.sha256Seal);
  });
});

describe('PILLAR 2: J1939 CAN-Bus Telemetry & MTBF Predictive Maintenance', () => {
  it('should ingest J1939 telemetry packet and store latest metrics', () => {
    const packet = {
      vehicleId: 'TRK-TEST-1',
      timestamp: new Date().toISOString(),
      engineRpm: 1520,
      speedMph: 65.2,
      coolantTempC: 91.5,
      oilPressurePsi: 46.2,
      defLevelPercent: 82,
      fuelRateGph: 7.5,
      totalEngineHours: 3500.2,
      odometerMiles: 110400,
      activeDtcs: [],
    };

    const res = telematicsService.ingestTelemetry(packet);
    expect(res.stored).toBe(true);

    const stored = telematicsService.getLatestVehicleTelemetry('TRK-TEST-1');
    expect(stored).toBeDefined();
    expect(stored?.engineRpm).toBe(1520);
  });

  it('should forecast predictive failure windows based on SPN/FMI and MTBF historical ledger', () => {
    const dtcs = [
      { spn: 110, fmi: 0 }, // Engine Coolant Overheating
      { spn: 3251, fmi: 2 }, // DPF Differential Pressure
    ];

    const forecasts = telematicsService.forecastMaintenance(dtcs);
    expect(forecasts).toHaveLength(2);

    const coolantForecast = forecasts.find((f) => f.spn === 110);
    expect(coolantForecast).toBeDefined();
    expect(coolantForecast?.severity).toBe('CRITICAL');
    expect(coolantForecast?.historicalLedgerMtbfHours).toBe(48);
    expect(coolantForecast?.estimatedRemainingSafeOperatingHours).toBeLessThan(10);
  });
});

describe('PILLAR 3: Low Bridge Detection Mesh & Clearance Profiles', () => {
  it('should return standard clearance profiles including 13ft 6in and 14ft 0in', () => {
    const profiles = routingService.getProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(4);
    const standard = profiles.find((p) => p.id === '13_6_STANDARD');
    expect(standard?.heightInches).toBe(162);
  });

  it('should detect low bridge hazards when vehicle height exceeds obstacle clearance', () => {
    // Dallas test coordinate near Commerce Street Rail Underpass (160 inches)
    const check = routingService.checkLowBridges(32.7812, -96.7915, '13_6_STANDARD', 10000);
    expect(check.results.length).toBeGreaterThan(0);

    const commerceBridge = check.results.find((r) => r.obstacleId === 'BRG-TX-409');
    expect(commerceBridge).toBeDefined();
    // 160" clearance - 162" truck height = -2" collision delta!
    expect(commerceBridge?.clearanceDeltaInches).toBe(-2);
    expect(['WARNING', 'IMMINENT_STRIKE', 'ADVISORY']).toContain(commerceBridge?.hazardLevel);
  });
});

describe('PILLAR 4: Salesforce Transport Cloud REST v60.0 Sync', () => {
  it('should synchronize loads and accounts into the fleet state', () => {
    const syncRes = salesforceService.syncPayload({
      organizationId: '00D8Z000002XYzeUAG',
      sourceSystem: 'SALESFORCE_TRANSPORT_CLOUD_v60',
      syncTimestamp: new Date().toISOString(),
      records: {
        loads: [
          {
            loadId: 'LD-9999',
            bolNumber: 'BOL-9999',
            origin: 'Phoenix, AZ',
            destination: 'Los Angeles, CA',
            stage: 'DISPATCHED',
            rateUsd: 2950,
          },
        ],
      },
    });

    expect(syncRes.success).toBe(true);
    expect(syncRes.appliedLoads).toBe(1);

    const status = salesforceService.getStatus();
    const load = status.loads.find((l) => l.loadId === 'LD-9999');
    expect(load).toBeDefined();
    expect(load?.destination).toBe('Los Angeles, CA');
  });

  it('should process inbound Salesforce CDC webhook events', () => {
    const webhookRes = salesforceService.handleWebhook({
      eventType: 'TransportLoadUpdated__e',
      payload: {
        loadId: 'LD-9999',
        newStage: 'IN_TRANSIT',
        driverId: 'DRV-7701',
      },
    });

    expect(webhookRes.acknowledged).toBe(true);
    const status = salesforceService.getStatus();
    const load = status.loads.find((l) => l.loadId === 'LD-9999');
    expect(load?.stage).toBe('IN_TRANSIT');
    expect(load?.assignedDriverId).toBe('DRV-7701');
  });
});

describe('PILLAR 5: Gemini Multimodal In-Cab Co-Pilot', () => {
  it('should parse voice transcript and dispatch HOS rest break intent', () => {
    const res = coPilotService.processVoiceCommand({
      driverId: 'DRV-7701',
      vehicleId: 'TRK-900',
      transcript: 'Take a 30 minute rest break right now',
    });

    expect(res.recognizedIntent).toBe('LOG_HOS_EVENT');
    expect(res.confidenceScore).toBeGreaterThan(0.9);
    expect(res.dispatchedActionTaken).toBe(true);
    expect(res.coPilotVoiceReply).toContain('rest break clock is now active');
  });

  it('should parse low bridge inquiry voice command', () => {
    const res = coPilotService.processVoiceCommand({
      driverId: 'DRV-7701',
      vehicleId: 'TRK-900',
      transcript: 'Are there any low bridges on this route?',
    });

    expect(res.recognizedIntent).toBe('ROUTE_HAZARD_INQUIRY');
    expect(res.dispatchedActionTaken).toBe(true);
  });

  it('should process multimodal vision inspection with SHA-256 seal', () => {
    const vision = coPilotService.processMultimodalVision({
      vehicleId: 'TRK-900',
      driverId: 'DRV-7701',
      inspectionContext: 'BOL_SCAN',
      imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
    });

    expect(vision.inspectionId).toBeDefined();
    expect(vision.passedInspection).toBe(true);
    expect(vision.sha256Hash).toHaveLength(64);
    expect(vision.legibilityConfidence).toBeGreaterThan(0.95);
  });
});
