# TRUCKWITHEASE ENTERPRISE FLEET OS — API DOCUMENTATION
**System**: TRUCKWITHEASE Tactical Fleet Operating System  
**Architect**: Jeremiah Morris (Founder & Chief Architect)  
**Standard**: FMCSA 49 CFR Part 395/396 Certified | SAE J1939 CAN-Bus | Salesforce Transport Cloud REST v60.0 | Gemini Multimodal  
**Base URL**: `http://localhost:3000/api/v1`  
**WebSocket Stream**: `ws://localhost:3000/ws/telematics`

---

## TABLE OF CONTENTS
1. [Pillar 1: FMCSA HOS & Cryptographic DVIR Compliance Engine](#pillar-1-fmcsa-hos--cryptographic-dvir-compliance-engine)
   - [GET /compliance/hos/clocks/:driverId](#1-get-compliancehosclocksdriverid)
   - [POST /compliance/hos/logs](#2-post-compliancehoslogs)
   - [POST /compliance/dvir](#3-post-compliancedvir)
   - [GET /compliance/dvir/:reportId/verify](#4-get-compliancedvirreportidverify)
2. [Pillar 2: Real-Time J1939 CAN-Bus & MTBF Predictive Maintenance](#pillar-2-real-time-j1939-can-bus--mtbf-predictive-maintenance)
   - [POST /telematics/canbus/stream](#5-post-telematicscanbusstream)
   - [POST /telematics/predictive-maintenance](#6-post-telematicspredictive-maintenance)
   - [GET /telematics/vehicles/:vehicleId/live](#7-get-telematicsvehiclesvehicleidlive)
   - [WS /ws/telematics](#8-ws-wstelematics)
3. [Pillar 3: Low Bridge Detection Mesh & Clearance Profiles](#pillar-3-low-bridge-detection-mesh--clearance-profiles)
   - [GET /routing/clearance-profiles](#9-get-routingclearance-profiles)
   - [POST /routing/low-bridge-check](#10-post-routinglow-bridge-check)
4. [Pillar 4: Bidirectional Salesforce CRM & Transport Cloud v60.0 Sync](#pillar-4-bidirectional-salesforce-crm--transport-cloud-v600-sync)
   - [GET /salesforce/status](#11-get-salesforcestatus)
   - [POST /salesforce/sync](#12-post-salesforcesync)
   - [POST /salesforce/webhooks](#13-post-salesforcewebhooks)
5. [Pillar 5: Voice Command Dispatch & Gemini Multimodal Co-Pilot](#pillar-5-voice-command-dispatch--gemini-multimodal-co-pilot)
   - [POST /copilot/command](#14-post-copilotcommand)
   - [POST /copilot/vision](#15-post-copilotvision)

---

## PILLAR 1: FMCSA HOS & CRYPTOGRAPHIC DVIR COMPLIANCE ENGINE

### 1. `GET` `/compliance/hos/clocks/:driverId`

#### 1. Purpose
Retrieves real-time FMCSA 49 CFR Part 395 certified Hours-of-Service compliance clocks, duty limits, and violation status for an authenticated driver.

#### 2. Parameters & Request Body
* **Path Parameters**:
  * `driverId` (`string`, required) – Unique commercial driver identification token (e.g. `DRV-7701`).
* **Headers**:
  * `Content-Type: application/json`

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Content-Type**: `application/json`
* **Schema**:
```json
{
  "success": "boolean",
  "data": {
    "driverId": "string",
    "currentStatus": "OFF_DUTY | SLEEPER_BERTH | DRIVING | ON_DUTY_NOT_DRIVING",
    "statusStartTime": "string (ISO 8601)",
    "drivingSecondsRemaining": "integer",
    "shiftSecondsRemaining": "integer",
    "cycleSecondsRemaining": "integer",
    "breakSecondsRemaining": "integer",
    "isViolation": "boolean",
    "violations": ["string"],
    "lastUpdated": "string (ISO 8601)"
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X GET "http://localhost:3000/api/v1/compliance/hos/clocks/DRV-7701" \
  -H "Content-Type: application/json"
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "driverId": "DRV-7701",
    "currentStatus": "DRIVING",
    "statusStartTime": "2026-10-08T00:00:00.000Z",
    "drivingSecondsRemaining": 25200,
    "shiftSecondsRemaining": 36000,
    "cycleSecondsRemaining": 237600,
    "breakSecondsRemaining": 14400,
    "isViolation": false,
    "violations": [],
    "lastUpdated": "2026-10-08T00:12:42.000Z"
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_DRIVER_ID` | Missing or malformed `driverId` parameter. |
| `200 OK` (Safe Default) | N/A | If driver has no prior logs, initializes a fresh clean 11h/14h/70h cycle in `OFF_DUTY` status. |

---

### 2. `POST` `/compliance/hos/logs`

#### 1. Purpose
Records an authenticated driver duty status transition event with GPS and odometer telemetry to maintain FMCSA compliance.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `driverId` (`string`, required) – Commercial driver ID.
  * `status` (`string`, required) – One of `OFF_DUTY`, `SLEEPER_BERTH`, `DRIVING`, `ON_DUTY_NOT_DRIVING`.
  * `location` (`string`, optional) – City/State or GPS corridor text.
  * `odometer` (`number`, required) – Current vehicle total odometer reading in miles.
  * `engineHours` (`number`, required) – Total cumulative engine operating hours.
  * `notes` (`string`, optional) – Reason for status change or manual annotation.

#### 3. Response Shape & Status Codes
* **Status**: `201 Created`
* **Content-Type**: `application/json`
* **Schema**:
```json
{
  "success": "boolean",
  "data": {
    "event": {
      "id": "string",
      "driverId": "string",
      "status": "string",
      "timestamp": "string (ISO 8601)",
      "location": "string",
      "odometer": "number",
      "engineHours": "number",
      "notes": "string"
    },
    "updatedClocks": "object"
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/compliance/hos/logs" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "DRV-7701",
    "status": "ON_DUTY_NOT_DRIVING",
    "location": "Dallas Intermodal Terminal, TX",
    "odometer": 142880,
    "engineHours": 4212.7,
    "notes": "Shipper loading and paperwork endorsement"
  }'
```

##### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "event": {
      "id": "EVT-MUYS8P92",
      "driverId": "DRV-7701",
      "status": "ON_DUTY_NOT_DRIVING",
      "timestamp": "2026-10-08T00:12:43.120Z",
      "location": "Dallas Intermodal Terminal, TX",
      "odometer": 142880,
      "engineHours": 4212.7,
      "notes": "Shipper loading and paperwork endorsement"
    },
    "updatedClocks": {
      "driverId": "DRV-7701",
      "currentStatus": "ON_DUTY_NOT_DRIVING",
      "drivingSecondsRemaining": 25200,
      "shiftSecondsRemaining": 35900,
      "cycleSecondsRemaining": 237500,
      "breakSecondsRemaining": 14400,
      "isViolation": false,
      "violations": []
    }
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_STATUS_PAYLOAD` | Unknown duty status or missing driver ID. |
| `400 Bad Request` | `INVALID_TELEMETRY` | `odometer` or `engineHours` is not a valid number. |

---

### 3. `POST` `/compliance/dvir`

#### 1. Purpose
Submits a digital pre-trip or post-trip Driver Vehicle Inspection Report (DVIR) and computes a cryptographic SHA-256 seal for tamper-evident FMCSA Part 396 certification.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `vehicleId` (`string`, required) – Commercial tractor identification (e.g. `TRK-900`).
  * `trailerId` (`string`, optional) – Trailer ID (e.g. `TRL-440`).
  * `driverId` (`string`, required) – Driver license/ID token.
  * `driverName` (`string`, required) – Full name of inspecting driver.
  * `odometer` (`number`, required) – Odometer at inspection.
  * `inspectionType` (`string`, required) – `PRE_TRIP` or `POST_TRIP`.
  * `items` (`array`, required) – Array of inspection objects: `{ "category": "BRAKES"|"TIRES"|"STEERING"|..., "passed": boolean, "defectNotes": string }`.
  * `driverSignature` (`string`, required) – Digital signature certification text.
  * `mechanicSignature` (`string`, optional) – Required if defects were corrected.

#### 3. Response Shape & Status Codes
* **Status**: `201 Created`
* **Content-Type**: `application/json`
* **Schema**:
```json
{
  "success": true,
  "message": "string",
  "data": {
    "id": "string",
    "vehicleId": "string",
    "trailerId": "string",
    "driverId": "string",
    "driverName": "string",
    "odometer": "number",
    "inspectionType": "string",
    "timestamp": "string (ISO 8601)",
    "items": "array",
    "defectsCorrected": "boolean",
    "mechanicCertificationRequired": "boolean",
    "driverSignature": "string",
    "sha256Seal": "string (64-char hex)"
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/compliance/dvir" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "TRK-900",
    "trailerId": "TRL-440",
    "driverId": "DRV-7701",
    "driverName": "Jeremiah Morris",
    "odometer": 142880,
    "inspectionType": "PRE_TRIP",
    "items": [
      { "category": "BRAKES", "passed": true },
      { "category": "TIRES", "passed": true },
      { "category": "STEERING", "passed": true },
      { "category": "LIGHTING", "passed": true }
    ],
    "driverSignature": "Jeremiah Morris [Digital Verified]"
  }'
```

##### Response (`201 Created`)
```json
{
  "success": true,
  "message": "DVIR recorded with cryptographic SHA-256 tamper seal",
  "data": {
    "id": "DVIR-MUYS901A",
    "vehicleId": "TRK-900",
    "trailerId": "TRL-440",
    "driverId": "DRV-7701",
    "driverName": "Jeremiah Morris",
    "odometer": 142880,
    "inspectionType": "PRE_TRIP",
    "timestamp": "2026-10-08T00:12:44.200Z",
    "items": [
      { "category": "BRAKES", "passed": true },
      { "category": "TIRES", "passed": true },
      { "category": "STEERING", "passed": true },
      { "category": "LIGHTING", "passed": true }
    ],
    "defectsCorrected": true,
    "mechanicCertificationRequired": false,
    "driverSignature": "Jeremiah Morris [Digital Verified]",
    "sha256Seal": "8b51d07c2a796ea8a9fbb34237d5771804eb4ec1d15654378f8cb0a544be65f8"
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `MISSING_DVIR_FIELDS` | Required driver, vehicle, or signature fields are missing. |
| `400 Bad Request` | `EMPTY_INSPECTION_CHECKLIST` | Empty inspection item list. |

---

### 4. `GET` `/compliance/dvir/:reportId/verify`

#### 1. Purpose
Verifies the cryptographic SHA-256 seal of a historical DVIR report against canonical record data to prove absence of alteration or retroactive falsification.

#### 2. Parameters & Request Body
* **Path Parameters**:
  * `reportId` (`string`, required) – Identification of DVIR report.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Content-Type**: `application/json`
* **Schema**:
```json
{
  "success": true,
  "data": {
    "reportId": "string",
    "tamperFree": "boolean",
    "storedSeal": "string (64-char hex)",
    "calculatedSeal": "string (64-char hex)",
    "complianceStandard": "string"
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X GET "http://localhost:3000/api/v1/compliance/dvir/DVIR-9042/verify"
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "reportId": "DVIR-9042",
    "tamperFree": true,
    "storedSeal": "c7d99957b59a7993fa80c2cbfb018e7aa4b6747fd0e6fd4954246d66cdd293b8",
    "calculatedSeal": "c7d99957b59a7993fa80c2cbfb018e7aa4b6747fd0e6fd4954246d66cdd293b8",
    "complianceStandard": "FMCSA 49 CFR Part 396.11 Electronic Seal Certified"
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `404 Not Found` | `REPORT_NOT_FOUND` | Requested `reportId` does not exist in registry. |

---

## PILLAR 2: REAL-TIME J1939 CAN-BUS & MTBF PREDICTIVE MAINTENANCE

### 5. `POST` `/telematics/canbus/stream`

#### 1. Purpose
Ingests high-frequency J1939 CAN-Bus broadcast packets and forwards them to active WebSocket subscribers and predictive fault evaluators.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `vehicleId` (`string`, required) – Tractor ID.
  * `timestamp` (`string`, required) – ISO timestamp.
  * `engineRpm` (`number`, required) – Engine Speed (SPN 190).
  * `speedMph` (`number`, required) – Vehicle Ground Speed (SPN 84).
  * `coolantTempC` (`number`, required) – Coolant Temp (SPN 110).
  * `oilPressurePsi` (`number`, required) – Engine Oil Pressure (SPN 100).
  * `defLevelPercent` (`number`, required) – Diesel Exhaust Fluid Tank Level (SPN 1761).
  * `fuelRateGph` (`number`, required) – Fuel Rate (SPN 183).
  * `totalEngineHours` (`number`, required) – Total Engine Hours (SPN 247).
  * `odometerMiles` (`number`, required) – Total Vehicle Distance (SPN 917).
  * `activeDtcs` (`array`, optional) – Active SPN/FMI Diagnostic Trouble Codes.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "data": {
    "stored": true,
    "activeDtcsCount": 1,
    "predictiveAlerts": []
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/telematics/canbus/stream" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "TRK-900",
    "timestamp": "2026-10-08T00:15:00.000Z",
    "engineRpm": 1450,
    "speedMph": 64.1,
    "coolantTempC": 88.5,
    "oilPressurePsi": 45.1,
    "defLevelPercent": 76,
    "fuelRateGph": 7.1,
    "totalEngineHours": 4213.1,
    "odometerMiles": 142890,
    "activeDtcs": [
      { "spn": 3251, "fmi": 2, "description": "DPF Delta Pressure Erratic", "occurrenceCount": 3 }
    ]
  }'
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "stored": true,
    "activeDtcsCount": 1,
    "predictiveAlerts": [
      {
        "spn": 3251,
        "fmi": 2,
        "component": "Aftertreatment DPF Differential Pressure Sensor",
        "severity": "MODERATE",
        "historicalLedgerMtbfHours": 160,
        "estimatedRemainingSafeOperatingHours": 56,
        "recommendedAction": "Initiate parked DPF regeneration within next 200 miles or service exhaust pressure tubes.",
        "estimatedLaborMinutes": 60
      }
    ]
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_J1939_FRAME` | Missing `vehicleId`, `engineRpm`, or `speedMph`. |

---

### 6. `POST` `/telematics/predictive-maintenance`

#### 1. Purpose
Forecasts component breakdown windows by matching active SPN/FMI diagnostic trouble codes against the historical ledger MTBF database.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `dtcs` (`array`, required) – Array of objects containing:
    * `spn` (`integer`, required) – Suspect Parameter Number.
    * `fmi` (`integer`, required) – Failure Mode Identifier (0–31).

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "totalFaultCodesEvaluated": 1,
  "criticalFailuresDetected": 1,
  "data": [
    {
      "spn": 110,
      "fmi": 0,
      "component": "string",
      "severity": "INFO | MODERATE | CRITICAL | CATASTROPHIC_FAILURE_IMMINENT",
      "historicalLedgerMtbfHours": 48,
      "estimatedRemainingSafeOperatingHours": 2.5,
      "recommendedAction": "string",
      "estimatedLaborMinutes": 90
    }
  ]
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/telematics/predictive-maintenance" \
  -H "Content-Type: application/json" \
  -d '{
    "dtcs": [
      { "spn": 110, "fmi": 0 }
    ]
  }'
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "totalFaultCodesEvaluated": 1,
  "criticalFailuresDetected": 1,
  "data": [
    {
      "spn": 110,
      "fmi": 0,
      "component": "Engine Cooling System - Thermostat & Water Pump",
      "severity": "CRITICAL",
      "historicalLedgerMtbfHours": 48,
      "estimatedRemainingSafeOperatingHours": 7.2,
      "recommendedAction": "Immediate pull-over recommended. Inspect coolant reservoir and fan clutch solenoid.",
      "estimatedLaborMinutes": 90
    }
  ]
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_DTC_PAYLOAD` | `dtcs` is not an array. |

---

### 7. `GET` `/telematics/vehicles/:vehicleId/live`

#### 1. Purpose
Fetches the latest live J1939 CAN-Bus telemetry packet, operating vitals, and active DTCs for a specific vehicle.

#### 2. Parameters & Request Body
* **Path Parameters**:
  * `vehicleId` (`string`, required) – Tractor identifier (e.g. `TRK-900`).

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**: J1939 Telemetry Frame Object.

#### 4. Example Request & Response

##### Request
```bash
curl -X GET "http://localhost:3000/api/v1/telematics/vehicles/TRK-900/live"
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "vehicleId": "TRK-900",
    "timestamp": "2026-10-08T00:15:00.000Z",
    "engineRpm": 1450,
    "speedMph": 63.4,
    "coolantTempC": 89.2,
    "oilPressurePsi": 44.8,
    "defLevelPercent": 78,
    "fuelRateGph": 7.2,
    "totalEngineHours": 4212.5,
    "odometerMiles": 142875,
    "activeDtcs": [
      {
        "spn": 3251,
        "fmi": 2,
        "description": "DPF Differential Pressure Data Erratic",
        "occurrenceCount": 3
      }
    ]
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `404 Not Found` | `VEHICLE_NOT_FOUND` | Vehicle has not transmitted telematics packets to the OS. |

---

### 8. `WS` `/ws/telematics`

#### 1. Purpose
Establishes a bi-directional WebSocket connection for low-latency J1939 telematics broadcast streaming and heartbeat ping/pong.

#### 2. Handshake & Frame Protocol
* **Connect URI**: `ws://localhost:3000/ws/telematics`
* **Client Handshake**: Sends initial connection packet upon opening.
* **Ping / Pong**: Client sends `{ "action": "PING" }`, server returns `{ "action": "PONG", "timestamp": number }`.

#### 3. Streaming Event Format
```json
{
  "event": "TELEMETRY_PACKET",
  "packet": {
    "vehicleId": "TRK-900",
    "engineRpm": 1450,
    "speedMph": 63.4,
    "coolantTempC": 89.2,
    "oilPressurePsi": 44.8
  }
}
```

#### 4. Example Client Interaction
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/telematics');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('Received Telematics Frame:', msg);
};
```

#### 5. Errors & Edge Cases
* Automatically cleans up subscription listener upon socket disconnect to avoid memory leaks.

---

## PILLAR 3: LOW BRIDGE DETECTION MESH & CLEARANCE PROFILES

### 9. `GET` `/routing/clearance-profiles`

#### 1. Purpose
Lists all standard and permitted commercial vehicle height clearance profiles configured in the Fleet Operating System.

#### 2. Parameters & Request Body
* None.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": "13_6_STANDARD | 14_0_OVERSIZE | 14_6_SPECIAL | 15_0_HEAVY_HAUL",
      "name": "string",
      "heightInches": "number",
      "description": "string"
    }
  ]
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X GET "http://localhost:3000/api/v1/routing/clearance-profiles"
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": "13_6_STANDARD",
      "name": "Standard Dry Van / Reefer",
      "heightInches": 162,
      "description": "FMCSA standard commercial 53-ft dry van and refrigerated freight trailer profile."
    },
    {
      "id": "14_0_OVERSIZE",
      "name": "Oversize Flatbed / Stepdeck",
      "heightInches": 168,
      "description": "Machinery and containerized high-cube flatbed load clearance profile."
    }
  ]
}
```

#### 5. Errors & Edge Cases
* Read-only deterministic configuration endpoint.

---

### 10. `POST` `/routing/low-bridge-check`

#### 1. Purpose
Evaluates vehicle GPS coordinates against the low bridge mesh using the vehicle's height clearance profile to emit radar hazard alerts and evasive maneuvers.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `latitude` (`number`, required) – Vehicle latitude coordinate.
  * `longitude` (`number`, required) – Vehicle longitude coordinate.
  * `profileId` (`string`, optional) – Clearance profile (`13_6_STANDARD`, `14_0_OVERSIZE`, etc.). Defaults to `13_6_STANDARD`.
  * `searchRadiusMeters` (`number`, optional) – Scan radius in meters. Defaults to `30000`.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "data": {
    "profile": { "id": "string", "name": "string", "heightInches": 162 },
    "hazardsDetected": 1,
    "results": [
      {
        "obstacleId": "string",
        "bridgeName": "string",
        "distanceMeters": 1420,
        "bridgeClearanceInches": 160,
        "vehicleHeightInches": 162,
        "clearanceDeltaInches": -2,
        "hazardLevel": "IMMINENT_STRIKE | WARNING | ADVISORY | CLEAR",
        "recommendedEvasiveAction": "string"
      }
    ]
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/routing/low-bridge-check" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 32.7812,
    "longitude": -96.7915,
    "profileId": "13_6_STANDARD",
    "searchRadiusMeters": 20000
  }'
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "13_6_STANDARD",
      "name": "Standard Dry Van / Reefer",
      "heightInches": 162,
      "description": "FMCSA standard commercial 53-ft dry van and refrigerated freight trailer profile."
    },
    "hazardsDetected": 1,
    "results": [
      {
        "obstacleId": "BRG-TX-409",
        "bridgeName": "Commerce Street Rail Underpass (Commerce St & Cesar Chavez Blvd, TX)",
        "distanceMeters": 0,
        "bridgeClearanceInches": 160,
        "vehicleHeightInches": 162,
        "clearanceDeltaInches": -2,
        "hazardLevel": "IMMINENT_STRIKE",
        "recommendedEvasiveAction": "CRITICAL: Stop vehicle immediately or take emergency pull-off! Overhead structure is 2\" below vehicle height."
      }
    ]
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_COORDINATES` | Missing or non-numeric `latitude` or `longitude`. |

---

## PILLAR 4: BIDIRECTIONAL SALESFORCE CRM & TRANSPORT CLOUD v60.0 SYNC

### 11. `GET` `/salesforce/status`

#### 1. Purpose
Retrieves synchronization health, connected organization credentials, and active freight loads for Salesforce Transport Cloud REST v60.0.

#### 2. Parameters & Request Body
* None.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "data": {
    "lastSyncTimestamp": "string (ISO 8601)",
    "apiVersion": "v60.0",
    "organizationId": "string",
    "connected": true,
    "syncedAccountsCount": 2,
    "syncedLoadsCount": 3,
    "pendingOutboundMutationsCount": 0,
    "accounts": [],
    "loads": []
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X GET "http://localhost:3000/api/v1/salesforce/status"
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "lastSyncTimestamp": "2026-10-08T00:10:08.000Z",
    "apiVersion": "v60.0",
    "organizationId": "00D8Z000002XYzeUAG",
    "connected": true,
    "syncedAccountsCount": 2,
    "syncedLoadsCount": 3,
    "pendingOutboundMutationsCount": 0,
    "loads": [
      {
        "loadId": "LD-8892",
        "bolNumber": "BOL-2026-99120",
        "origin": "Dallas Intermodal Yard, TX",
        "destination": "Chicago Logistics Park, IL",
        "assignedDriverId": "DRV-7701",
        "assignedVehicleId": "TRK-900",
        "stage": "IN_TRANSIT",
        "rateUsd": 3450
      }
    ]
  }
}
```

---

### 12. `POST` `/salesforce/sync`

#### 1. Purpose
Synchronizes bulk loads, shipper accounts, and vehicle telemetry records with Salesforce Transport Cloud REST v60.0 schemas.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `organizationId` (`string`, required) – Salesforce 18-character Org ID.
  * `sourceSystem` (`string`, required) – Source identifier.
  * `records` (`object`, required):
    * `loads` (`array`, optional) – Transport loads to upsert.
    * `accounts` (`array`, optional) – Carrier / shipper accounts to upsert.
    * `telemetryEvents` (`array`, optional) – GPS positions.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "recordsProcessed": 1,
  "syncTimestamp": "string (ISO 8601)",
  "appliedLoads": 1
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/salesforce/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "00D8Z000002XYzeUAG",
    "sourceSystem": "TRUCKWITHEASE_FLEET_OS",
    "records": {
      "loads": [
        {
          "loadId": "LD-9920",
          "bolNumber": "BOL-2026-99999",
          "origin": "Houston Port Terminal, TX",
          "destination": "Memphis Rail Depot, TN",
          "stage": "DISPATCHED",
          "rateUsd": 3200
        }
      ]
    }
  }'
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "recordsProcessed": 1,
  "syncTimestamp": "2026-10-08T00:15:30.000Z",
  "appliedLoads": 1
}
```

---

### 13. `POST` `/salesforce/webhooks`

#### 1. Purpose
Ingests inbound Salesforce Change Data Capture (CDC) or Pub/Sub event bus webhooks for live dispatch adjustments and stage transitions.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `eventType` (`string`, required) – Salesforce platform event name (e.g. `TransportLoadUpdated__e`).
  * `payload` (`object`, required):
    * `loadId` (`string`, optional) – Target load ID.
    * `newStage` (`string`, optional) – `PLANNED` | `DISPATCHED` | `IN_TRANSIT` | `DELIVERED`.
    * `driverId` (`string`, optional) – Reassigned driver ID.
    * `vehicleId` (`string`, optional) – Reassigned vehicle ID.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "actionApplied": "string",
    "updatedRecord": {}
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/salesforce/webhooks" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "TransportLoadUpdated__e",
    "payload": {
      "loadId": "LD-8892",
      "newStage": "DELIVERED"
    }
  }'
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "actionApplied": "Salesforce CDC Event [TransportLoadUpdated__e]: Updated load LD-8892",
    "updatedRecord": {
      "loadId": "LD-8892",
      "stage": "DELIVERED"
    }
  }
}
```

---

## PILLAR 5: VOICE COMMAND DISPATCH & GEMINI MULTIMODAL CO-PILOT

### 14. `POST` `/copilot/command`

#### 1. Purpose
Parses hands-free driver speech transcripts using Gemini reasoning to execute cockpit actions (HOS duty switches, radar checks, parking safe havens) and return audio voice replies.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `transcript` (`string`, required) – Speech-to-text string spoken by driver.
  * `driverId` (`string`, optional) – Defaults to `DRV-7701`.
  * `vehicleId` (`string`, optional) – Defaults to `TRK-900`.
  * `ambientNoiseDb` (`number`, optional) – Cab sound level in decibels.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "data": {
    "commandId": "string",
    "recognizedIntent": "LOG_HOS_EVENT | TRIGGER_DVIR | ROUTE_HAZARD_INQUIRY | DISPATCH_ETA_UPDATE | PARKING_SAFE_HAVEN_REQUEST | UNKNOWN",
    "confidenceScore": 0.98,
    "extractedParameters": {},
    "coPilotVoiceReply": "string",
    "dispatchedActionTaken": true
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/copilot/command" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "DRV-7701",
    "vehicleId": "TRK-900",
    "transcript": "Take a 30 minute rest break"
  }'
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "commandId": "CMD-MUYS8QU1",
    "recognizedIntent": "LOG_HOS_EVENT",
    "confidenceScore": 0.98,
    "extractedParameters": {
      "targetStatus": "OFF_DUTY",
      "durationMinutes": 30
    },
    "coPilotVoiceReply": "Affirmative, Jeremiah. Logging duty status as OFF DUTY. Your 30-minute FMCSA rest break clock is now active. Rest well.",
    "dispatchedActionTaken": true
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `MISSING_TRANSCRIPT` | `transcript` string was omitted. |

---

### 15. `POST` `/copilot/vision`

#### 1. Purpose
Analyzes in-cab camera imagery, Bill of Lading (BOL) shipping papers, or pre-trip tire tread wear using Gemini multimodal vision models with cryptographic SHA-256 seal generation.

#### 2. Parameters & Request Body
* **Request Body** (`application/json`):
  * `vehicleId` (`string`, required) – Tractor ID.
  * `driverId` (`string`, required) – Driver ID.
  * `inspectionContext` (`string`, required) – One of: `BOL_SCAN`, `CARGO_DAMAGE_INSPECTION`, `PRE_TRIP_TIRE_SURVEY`.
  * `imageBase64` (`string`, required) – Base64 encoded JPEG/PNG image data string.
  * `promptNotes` (`string`, optional) – Contextual hints or driver annotations.

#### 3. Response Shape & Status Codes
* **Status**: `200 OK`
* **Schema**:
```json
{
  "success": true,
  "data": {
    "inspectionId": "string",
    "detectedIssues": ["string"],
    "legibilityConfidence": "number",
    "passedInspection": "boolean",
    "multimodalSummary": "string",
    "sha256Hash": "string (64-char hex)"
  }
}
```

#### 4. Example Request & Response

##### Request
```bash
curl -X POST "http://localhost:3000/api/v1/copilot/vision" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "TRK-900",
    "driverId": "DRV-7701",
    "inspectionContext": "BOL_SCAN",
    "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
  }'
```

##### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "inspectionId": "VIS-MUYS9K2L",
    "detectedIssues": [],
    "legibilityConfidence": 0.992,
    "passedInspection": true,
    "multimodalSummary": "Gemini OCR extraction complete: Bill of Lading #BOL-2026-99120 verified. Shipper signature confirmed. Freight count: 24 pallets (42,000 lbs).",
    "sha256Hash": "b3f07a21dd9382e70bcde9a203f7e50c4bb2e6840733c945be7293a1cf5529ab"
  }
}
```

#### 5. Errors & Edge Cases
| Status Code | Error Code | Description / Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_VISION_REQUEST` | Missing `imageBase64` or unknown `inspectionContext`. |
