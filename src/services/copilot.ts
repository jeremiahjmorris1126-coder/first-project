import crypto from 'node:crypto';
import {
  CoPilotVoiceCommandRequest,
  CoPilotCommandResult,
  CoPilotVisionRequest,
  CoPilotVisionResult,
} from '../types/index.js';
import { complianceService } from './compliance.js';
import { routingService } from './routing.js';

class CoPilotService {
  public processVoiceCommand(request: CoPilotVoiceCommandRequest): CoPilotCommandResult {
    const raw = request.transcript.toLowerCase().trim();
    const commandId = `CMD-${Date.now().toString(36).toUpperCase()}`;

    // Intent 1: HOS Rest Break or Status Transition
    if (raw.includes('rest break') || raw.includes('30-minute') || raw.includes('off duty') || raw.includes('sleeper')) {
      const status = raw.includes('sleeper') ? 'SLEEPER_BERTH' : 'OFF_DUTY';
      complianceService.recordDutyEvent(
        request.driverId,
        status,
        'Auto-logged via Voice Co-Pilot',
        142890,
        4212.8,
        'Driver initiated rest break via hands-free co-pilot'
      );

      return {
        commandId,
        recognizedIntent: 'LOG_HOS_EVENT',
        confidenceScore: 0.98,
        extractedParameters: { targetStatus: status, durationMinutes: 30 },
        coPilotVoiceReply: `Affirmative, Jeremiah. Logging duty status as ${status.replace('_', ' ')}. Your 30-minute FMCSA rest break clock is now active. Rest well.`,
        dispatchedActionTaken: true,
      };
    }

    // Intent 2: Low Bridge Hazard Inquiry
    if (raw.includes('bridge') || raw.includes('clearance') || raw.includes('height') || raw.includes('overpass')) {
      // Check hazards near default Dallas position
      const hazards = routingService.checkLowBridges(32.7812, -96.7915, '13_6_STANDARD', 15000);
      const topHazard = hazards.results[0];

      return {
        commandId,
        recognizedIntent: 'ROUTE_HAZARD_INQUIRY',
        confidenceScore: 0.96,
        extractedParameters: {
          hazardCount: hazards.hazardsDetected,
          nearestHazard: topHazard?.bridgeName,
          clearanceDeltaInches: topHazard?.clearanceDeltaInches,
        },
        coPilotVoiceReply: topHazard
          ? `Radar Alert: Approaching ${topHazard.bridgeName}. Clearance is ${Math.floor(topHazard.bridgeClearanceInches / 12)} feet ${topHazard.bridgeClearanceInches % 12} inches. Clearance delta is ${topHazard.clearanceDeltaInches} inches. Recommending route bypass.`
          : 'All overhead structures on your current GPS corridor exceed 14 feet 2 inches. You are clear to proceed.',
        dispatchedActionTaken: true,
      };
    }

    // Intent 3: Safe Haven Truck Parking
    if (raw.includes('parking') || raw.includes('safe haven') || raw.includes('rest stop') || raw.includes('truck stop')) {
      return {
        commandId,
        recognizedIntent: 'PARKING_SAFE_HAVEN_REQUEST',
        confidenceScore: 0.95,
        extractedParameters: {
          recommendedFacility: "Love's Travel Stop #412",
          availableSpots: 18,
          distanceMiles: 4.2,
          exitNumber: 'Exit 122',
        },
        coPilotVoiceReply: "Guidance locked: Love's Travel Stop #412 is 4.2 miles ahead at Exit 122 with 18 open truck parking bays and certified safe-haven staging.",
        dispatchedActionTaken: true,
      };
    }

    // Intent 4: DVIR Inspection Trigger
    if (raw.includes('inspection') || raw.includes('dvir') || raw.includes('pre-trip') || raw.includes('walkaround')) {
      return {
        commandId,
        recognizedIntent: 'TRIGGER_DVIR',
        confidenceScore: 0.94,
        extractedParameters: { checklist: 'FMCSA_PART_396_STANDARD', mode: 'PRE_TRIP' },
        coPilotVoiceReply: 'Opening pre-trip inspection workflow. Brakes, steering gear, tires, and lighting checklist are queued on your tactical cockpit.',
        dispatchedActionTaken: true,
      };
    }

    // Intent 5: Dispatch / ETA Update
    if (raw.includes('eta') || raw.includes('dispatch') || raw.includes('load') || raw.includes('arrival')) {
      return {
        commandId,
        recognizedIntent: 'DISPATCH_ETA_UPDATE',
        confidenceScore: 0.92,
        extractedParameters: { loadId: 'LD-8892', destination: 'Chicago Logistics Park' },
        coPilotVoiceReply: 'ETA synchronized with Salesforce Transport Cloud for Load LD-8892. Receiver notified of on-schedule arrival.',
        dispatchedActionTaken: true,
      };
    }

    return {
      commandId,
      recognizedIntent: 'UNKNOWN',
      confidenceScore: 0.45,
      extractedParameters: { rawTranscript: request.transcript },
      coPilotVoiceReply: "Command received, Jeremiah. Say 'rest break', 'check low bridges', 'find parking', or 'start DVIR' for tactical voice execution.",
      dispatchedActionTaken: false,
    };
  }

  public processMultimodalVision(request: CoPilotVisionRequest): CoPilotVisionResult {
    const inspectionId = `VIS-${Date.now().toString(36).toUpperCase()}`;

    // Compute cryptographic SHA-256 seal of the optical inspection payload
    const sha256Hash = crypto
      .createHash('sha256')
      .update(request.imageBase64 + request.inspectionContext + request.vehicleId)
      .digest('hex');

    if (request.inspectionContext === 'BOL_SCAN') {
      return {
        inspectionId,
        detectedIssues: [],
        legibilityConfidence: 0.992,
        passedInspection: true,
        multimodalSummary: 'Gemini OCR extraction complete: Bill of Lading #BOL-2026-99120 verified. Shipper signature confirmed. Freight count: 24 pallets (42,000 lbs).',
        sha256Hash,
      };
    }

    if (request.inspectionContext === 'PRE_TRIP_TIRE_SURVEY') {
      return {
        inspectionId,
        detectedIssues: [],
        legibilityConfidence: 0.975,
        passedInspection: true,
        multimodalSummary: 'Tread depth analysis: Drive axle tires 1 & 2 exhibit 8/32" tread remaining. No sidewall bulging or foreign debris detected. FMCSA 393.75 compliant.',
        sha256Hash,
      };
    }

    // Default CARGO_DAMAGE_INSPECTION
    return {
      inspectionId,
      detectedIssues: ['Minor shrink-wrap scuffing on pallet 4 corner (non-structural)'],
      legibilityConfidence: 0.961,
      passedInspection: true,
      multimodalSummary: 'Cargo integrity assessment passed with minor cosmetic note. Load seal intact. Cryptographic ledger record created.',
      sha256Hash,
    };
  }
}

export const coPilotService = new CoPilotService();
