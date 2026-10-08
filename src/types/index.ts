/**
 * TRUCKWITHEASE ENTERPRISE FLEET OS - Core Domain Types
 * Architect: Jeremiah Morris
 */

export type DutyStatus = 'OFF_DUTY' | 'SLEEPER_BERTH' | 'DRIVING' | 'ON_DUTY_NOT_DRIVING';

export interface HosDutyEvent {
  id: string;
  driverId: string;
  status: DutyStatus;
  timestamp: string; // ISO 8601
  location: string;
  odometer: number;
  engineHours: number;
  notes?: string;
}

export interface HosClocks {
  driverId: string;
  currentStatus: DutyStatus;
  statusStartTime: string;
  drivingSecondsRemaining: number;     // 11-hour limit (39,600 sec)
  shiftSecondsRemaining: number;       // 14-hour window (50,400 sec)
  cycleSecondsRemaining: number;       // 70-hour 8-day cycle (252,000 sec)
  breakSecondsRemaining: number;       // 8-hour drive before mandatory 30-min break
  isViolation: boolean;
  violations: string[];
  lastUpdated: string;
}

export interface DvirItemCheck {
  category: 'BRAKES' | 'STEERING' | 'TIRES' | 'LIGHTING' | 'COUPLING' | 'SUSPENSION' | 'EXHAUST' | 'EMERGENCY_EQUIPMENT';
  passed: boolean;
  defectNotes?: string;
}

export interface DvirReport {
  id: string;
  vehicleId: string;
  trailerId?: string;
  driverId: string;
  driverName: string;
  odometer: number;
  inspectionType: 'PRE_TRIP' | 'POST_TRIP';
  timestamp: string;
  items: DvirItemCheck[];
  defectsCorrected: boolean;
  mechanicCertificationRequired: boolean;
  mechanicSignature?: string;
  driverSignature: string;
  sha256Seal: string;
}

export interface J1939TelemetryPacket {
  vehicleId: string;
  timestamp: string;
  engineRpm: number;
  speedMph: number;
  coolantTempC: number;
  oilPressurePsi: number;
  defLevelPercent: number;
  fuelRateGph: number;
  totalEngineHours: number;
  odometerMiles: number;
  activeDtcs: Array<{
    spn: number;
    fmi: number;
    description: string;
    occurrenceCount: number;
  }>;
}

export interface PredictiveMaintenanceAssessment {
  spn: number;
  fmi: number;
  component: string;
  severity: 'INFO' | 'MODERATE' | 'CRITICAL' | 'CATASTROPHIC_FAILURE_IMMINENT';
  historicalLedgerMtbfHours: number;
  estimatedRemainingSafeOperatingHours: number;
  recommendedAction: string;
  estimatedLaborMinutes: number;
}

export type ClearanceProfileKey = '13_6_STANDARD' | '14_0_OVERSIZE' | '14_6_SPECIAL' | '15_0_HEAVY_HAUL';

export interface ClearanceProfile {
  id: ClearanceProfileKey;
  name: string;
  heightInches: number; // e.g. 13'6" = 162 inches
  description: string;
}

export interface LowBridgeObstacle {
  id: string;
  bridgeName: string;
  highwayOrRoad: string;
  latitude: number;
  longitude: number;
  clearanceInches: number;
  state: string;
}

export interface LowBridgeDetectionResult {
  obstacleId: string;
  bridgeName: string;
  distanceMeters: number;
  bridgeClearanceInches: number;
  vehicleHeightInches: number;
  clearanceDeltaInches: number; // positive = clearance, negative = hazard
  hazardLevel: 'CLEAR' | 'ADVISORY' | 'WARNING' | 'IMMINENT_STRIKE';
  recommendedEvasiveAction?: string;
}

export interface SalesforceTransportSyncPayload {
  organizationId: string;
  sourceSystem: string;
  syncTimestamp: string;
  records: {
    accounts?: Array<{
      id: string;
      name: string;
      dotNumber?: string;
      status: string;
    }>;
    loads?: Array<{
      loadId: string;
      bolNumber: string;
      origin: string;
      destination: string;
      assignedDriverId?: string;
      assignedVehicleId?: string;
      stage: 'PLANNED' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
      rateUsd: number;
    }>;
    telemetryEvents?: Array<{
      vehicleId: string;
      lat: number;
      lon: number;
      speedMph: number;
      lastHeartbeat: string;
    }>;
  };
}

export interface CoPilotVoiceCommandRequest {
  driverId: string;
  vehicleId: string;
  transcript: string;
  ambientNoiseDb?: number;
}

export interface CoPilotCommandResult {
  commandId: string;
  recognizedIntent: 'LOG_HOS_EVENT' | 'TRIGGER_DVIR' | 'ROUTE_HAZARD_INQUIRY' | 'DISPATCH_ETA_UPDATE' | 'PARKING_SAFE_HAVEN_REQUEST' | 'UNKNOWN';
  confidenceScore: number;
  extractedParameters: Record<string, unknown>;
  coPilotVoiceReply: string;
  dispatchedActionTaken: boolean;
}

export interface CoPilotVisionRequest {
  vehicleId: string;
  driverId: string;
  inspectionContext: 'BOL_SCAN' | 'CARGO_DAMAGE_INSPECTION' | 'PRE_TRIP_TIRE_SURVEY';
  imageBase64: string;
  promptNotes?: string;
}

export interface CoPilotVisionResult {
  inspectionId: string;
  detectedIssues: string[];
  legibilityConfidence: number;
  passedInspection: boolean;
  multimodalSummary: string;
  sha256Hash: string;
}
