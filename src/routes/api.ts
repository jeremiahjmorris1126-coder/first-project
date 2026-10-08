import { Router, Request, Response } from 'express';
import { complianceService } from '../services/compliance.js';
import { telematicsService } from '../services/telematics.js';
import { routingService } from '../services/routing.js';
import { salesforceService } from '../services/salesforce.js';
import { coPilotService } from '../services/copilot.js';
import {
  DutyStatus,
  DvirItemCheck,
  J1939TelemetryPacket,
  ClearanceProfileKey,
  SalesforceTransportSyncPayload,
  CoPilotVoiceCommandRequest,
  CoPilotVisionRequest,
} from '../types/index.js';

export const apiRouter = Router();

// ==========================================
// PILLAR 1: FMCSA 49 CFR PART 395/396 HOS & DVIR
// ==========================================

/**
 * GET /api/v1/compliance/hos/clocks/:driverId
 * Purpose: Retrieve real-time FMCSA Hours-of-Service compliance clocks, duty limits, and violation status for a driver.
 */
apiRouter.get('/compliance/hos/clocks/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  if (!driverId) {
    return res.status(400).json({ error: 'INVALID_DRIVER_ID', message: 'driverId path parameter is required' });
  }
  const clocks = complianceService.getClocks(driverId);
  return res.status(200).json({ success: true, data: clocks });
});

/**
 * POST /api/v1/compliance/hos/logs
 * Purpose: Record an authenticated driver duty status transition event under FMCSA 49 CFR Part 395.
 */
apiRouter.post('/compliance/hos/logs', (req: Request, res: Response) => {
  const { driverId, status, location, odometer, engineHours, notes } = req.body;

  const validStatuses: DutyStatus[] = ['OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING'];
  if (!driverId || !status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'INVALID_STATUS_PAYLOAD',
      message: 'driverId and valid status (OFF_DUTY, SLEEPER_BERTH, DRIVING, ON_DUTY_NOT_DRIVING) are required',
    });
  }

  if (typeof odometer !== 'number' || typeof engineHours !== 'number') {
    return res.status(400).json({
      error: 'INVALID_TELEMETRY',
      message: 'odometer and engineHours must be valid numeric values',
    });
  }

  const event = complianceService.recordDutyEvent(
    driverId,
    status,
    location || 'GPS In-Motion Auto-Capture',
    odometer,
    engineHours,
    notes
  );

  const updatedClocks = complianceService.getClocks(driverId);

  return res.status(201).json({
    success: true,
    data: {
      event,
      updatedClocks,
    },
  });
});

/**
 * GET /api/v1/compliance/dvir
 * Purpose: Retrieve historical digital Driver Vehicle Inspection Reports with cryptographic SHA-256 seals.
 */
apiRouter.get('/compliance/dvir', (_req: Request, res: Response) => {
  const reports = complianceService.getAllDvirReports();
  return res.status(200).json({ success: true, count: reports.length, data: reports });
});

/**
 * POST /api/v1/compliance/dvir
 * Purpose: Submit a pre-trip or post-trip DVIR checklist with cryptographic SHA-256 seal generation.
 */
apiRouter.post('/compliance/dvir', (req: Request, res: Response) => {
  const {
    vehicleId,
    trailerId,
    driverId,
    driverName,
    odometer,
    inspectionType,
    items,
    driverSignature,
    mechanicSignature,
  } = req.body;

  if (!vehicleId || !driverId || !driverName || !inspectionType || !driverSignature) {
    return res.status(400).json({
      error: 'MISSING_DVIR_FIELDS',
      message: 'vehicleId, driverId, driverName, inspectionType, and driverSignature are mandatory',
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'EMPTY_INSPECTION_CHECKLIST',
      message: 'Inspection items array must contain FMCSA Part 396 safety categories',
    });
  }

  const report = complianceService.createDvir(
    vehicleId,
    driverId,
    driverName,
    odometer || 0,
    inspectionType,
    items as DvirItemCheck[],
    driverSignature,
    trailerId,
    mechanicSignature
  );

  return res.status(201).json({
    success: true,
    message: 'DVIR recorded with cryptographic SHA-256 tamper seal',
    data: report,
  });
});

/**
 * GET /api/v1/compliance/dvir/:reportId/verify
 * Purpose: Cryptographically verify the SHA-256 seal of a DVIR report to validate integrity and absence of tampering.
 */
apiRouter.get('/compliance/dvir/:reportId/verify', (req: Request, res: Response) => {
  const { reportId } = req.params;
  const verification = complianceService.verifyDvirSeal(reportId);

  if (verification.error) {
    return res.status(404).json({ error: 'REPORT_NOT_FOUND', message: verification.error });
  }

  return res.status(200).json({
    success: true,
    data: {
      reportId,
      tamperFree: verification.verified,
      storedSeal: verification.storedSeal,
      calculatedSeal: verification.calculatedSeal,
      complianceStandard: 'FMCSA 49 CFR Part 396.11 Electronic Seal Certified',
    },
  });
});

// ==========================================
// PILLAR 2: REAL-TIME J1939 CAN-BUS & PREDICTIVE MAINTENANCE
// ==========================================

/**
 * POST /api/v1/telematics/canbus/stream
 * Purpose: Ingest high-frequency J1939 CAN-Bus telemetry frames and evaluate live SPN/FMI diagnostic trouble codes.
 */
apiRouter.post('/telematics/canbus/stream', (req: Request, res: Response) => {
  const packet: J1939TelemetryPacket = req.body;

  if (!packet.vehicleId || typeof packet.engineRpm !== 'number' || typeof packet.speedMph !== 'number') {
    return res.status(400).json({
      error: 'INVALID_J1939_FRAME',
      message: 'vehicleId, engineRpm, and speedMph are required in J1939 telemetry payload',
    });
  }

  const result = telematicsService.ingestTelemetry(packet);
  return res.status(200).json({ success: true, data: result });
});

/**
 * POST /api/v1/telematics/predictive-maintenance
 * Purpose: Forecast component breakdown windows by matching active SPN/FMI fault codes against historical ledger MTBF.
 */
apiRouter.post('/telematics/predictive-maintenance', (req: Request, res: Response) => {
  const { dtcs } = req.body;

  if (!Array.isArray(dtcs)) {
    return res.status(400).json({
      error: 'INVALID_DTC_PAYLOAD',
      message: 'dtcs must be an array of objects containing spn and fmi numbers',
    });
  }

  const assessments = telematicsService.forecastMaintenance(dtcs);
  return res.status(200).json({
    success: true,
    totalFaultCodesEvaluated: dtcs.length,
    criticalFailuresDetected: assessments.filter((a) => a.severity === 'CRITICAL' || a.severity === 'CATASTROPHIC_FAILURE_IMMINENT').length,
    data: assessments,
  });
});

/**
 * GET /api/v1/telematics/vehicles/:vehicleId/live
 * Purpose: Fetch the most recent live J1939 telemetry packet, engine metrics, and active diagnostic trouble codes for a vehicle.
 */
apiRouter.get('/telematics/vehicles/:vehicleId/live', (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  const telemetry = telematicsService.getLatestVehicleTelemetry(vehicleId);

  if (!telemetry) {
    return res.status(404).json({
      error: 'VEHICLE_NOT_FOUND',
      message: `No active telemetry stream found for vehicle ${vehicleId}`,
    });
  }

  return res.status(200).json({ success: true, data: telemetry });
});

/**
 * GET /api/v1/telematics/vehicles
 * Purpose: List all active fleet vehicles with their current J1939 CAN-bus operational status.
 */
apiRouter.get('/telematics/vehicles', (_req: Request, res: Response) => {
  const vehicles = telematicsService.getAllVehicles();
  return res.status(200).json({ success: true, count: vehicles.length, data: vehicles });
});

// ==========================================
// PILLAR 3: LOW BRIDGE DETECTION MESH
// ==========================================

/**
 * GET /api/v1/routing/clearance-profiles
 * Purpose: List standard and permitted commercial vehicle height clearance profiles configured in the Fleet OS.
 */
apiRouter.get('/routing/clearance-profiles', (_req: Request, res: Response) => {
  const profiles = routingService.getProfiles();
  return res.status(200).json({ success: true, count: profiles.length, data: profiles });
});

/**
 * GET /api/v1/routing/obstacles
 * Purpose: Query the low bridge obstacle mesh database containing known overhead physical structures and clearance limits.
 */
apiRouter.get('/routing/obstacles', (_req: Request, res: Response) => {
  const obstacles = routingService.getObstacles();
  return res.status(200).json({ success: true, count: obstacles.length, data: obstacles });
});

/**
 * POST /api/v1/routing/low-bridge-check
 * Purpose: Scan route or vehicle coordinates against the low bridge mesh using the vehicle's height clearance profile to emit radar hazard alerts.
 */
apiRouter.post('/routing/low-bridge-check', (req: Request, res: Response) => {
  const { latitude, longitude, profileId, searchRadiusMeters } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({
      error: 'INVALID_COORDINATES',
      message: 'latitude and longitude must be valid floating point coordinates',
    });
  }

  const assessment = routingService.checkLowBridges(
    latitude,
    longitude,
    (profileId as ClearanceProfileKey) || '13_6_STANDARD',
    searchRadiusMeters || 30000
  );

  return res.status(200).json({ success: true, data: assessment });
});

// ==========================================
// PILLAR 4: SALESFORCE TRANSPORT CLOUD REST v60.0 SYNC
// ==========================================

/**
 * GET /api/v1/salesforce/status
 * Purpose: Retrieve synchronization health, connected organization credentials, and pending mutation status for Salesforce Transport Cloud v60.0.
 */
apiRouter.get('/salesforce/status', (_req: Request, res: Response) => {
  const status = salesforceService.getStatus();
  return res.status(200).json({ success: true, data: status });
});

/**
 * POST /api/v1/salesforce/sync
 * Purpose: Execute bidirectional synchronization of transport loads, accounts, and telemetry events with Salesforce Transport Cloud REST v60.0.
 */
apiRouter.post('/salesforce/sync', (req: Request, res: Response) => {
  const payload: SalesforceTransportSyncPayload = req.body;

  if (!payload || !payload.records) {
    return res.status(400).json({
      error: 'INVALID_SYNC_PAYLOAD',
      message: 'Payload must contain a valid records object with loads, accounts, or telemetryEvents',
    });
  }

  const result = salesforceService.syncPayload(payload);
  return res.status(200).json({ success: true, data: result });
});

/**
 * POST /api/v1/salesforce/webhooks
 * Purpose: Ingest inbound Salesforce Change Data Capture (CDC) or Pub/Sub event bus webhooks for live dispatch adjustments.
 */
apiRouter.post('/salesforce/webhooks', (req: Request, res: Response) => {
  const { eventType, payload } = req.body;

  if (!eventType || !payload) {
    return res.status(400).json({
      error: 'INVALID_WEBHOOK_PAYLOAD',
      message: 'eventType and payload objects are required',
    });
  }

  const result = salesforceService.handleWebhook({ eventType, payload });
  return res.status(200).json({ success: true, data: result });
});

// ==========================================
// PILLAR 5: VOICE COMMAND DISPATCH & GEMINI CO-PILOT
// ==========================================

/**
 * POST /api/v1/copilot/command
 * Purpose: Parse hands-free driver speech transcripts using natural language reasoning to execute cockpit actions and dispatch responses.
 */
apiRouter.post('/copilot/command', (req: Request, res: Response) => {
  const request: CoPilotVoiceCommandRequest = req.body;

  if (!request.transcript || typeof request.transcript !== 'string') {
    return res.status(400).json({
      error: 'MISSING_TRANSCRIPT',
      message: 'transcript string is required for co-pilot voice command processing',
    });
  }

  const result = coPilotService.processVoiceCommand({
    driverId: request.driverId || 'DRV-7701',
    vehicleId: request.vehicleId || 'TRK-900',
    transcript: request.transcript,
    ambientNoiseDb: request.ambientNoiseDb,
  });

  return res.status(200).json({ success: true, data: result });
});

/**
 * POST /api/v1/copilot/vision
 * Purpose: Analyze in-cab camera imagery, BOL documents, or tire wear photos using Gemini multimodal vision models with cryptographic ledger hashing.
 */
apiRouter.post('/copilot/vision', (req: Request, res: Response) => {
  const request: CoPilotVisionRequest = req.body;

  if (!request.imageBase64 || !request.inspectionContext) {
    return res.status(400).json({
      error: 'INVALID_VISION_REQUEST',
      message: 'imageBase64 and inspectionContext (BOL_SCAN, CARGO_DAMAGE_INSPECTION, PRE_TRIP_TIRE_SURVEY) are required',
    });
  }

  const result = coPilotService.processMultimodalVision(request);
  return res.status(200).json({ success: true, data: result });
});
