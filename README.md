# TRUCKWITHEASE ENTERPRISE FLEET OS
**Tactical Fleet Operating System — Mission-Critical Logistics Cockpit**  
*Exceeding Samsara, Motive (KeepTruckin), and Geotab*  
**Founder & Chief Architect**: Jeremiah Morris  

---

## ⚡ Operational Pillars

1. **FMCSA 49 CFR Part 395/396 Certified Hours-of-Service (HOS) & Digital DVIR**:
   - 11-hour driving / 14-hour duty / 70-hour 8-day cycle clocks with real-time status transitions.
   - Digital Driver Vehicle Inspection Report (DVIR) with canonical **cryptographic SHA-256 seal** tamper-evident verification.
2. **Real-Time J1939 CAN-Bus Telemetry Streamer & Predictive Maintenance**:
   - High-frequency CAN-bus engine data broadcast (RPM, Speed, Coolant Temp, Oil Pressure, DEF, Fuel Rate).
   - SPN/FMI Diagnostic Trouble Code forecasting matching historical ledger MTBF (Mean Time Between Failures).
   - Low-latency bi-directional WebSocket telemetry stream on `/ws/telematics`.
3. **Low Bridge Detection Mesh & Clearance Profiles**:
   - Dynamic vehicle clearance profiles (`13'6"` Standard, `14'0"` Oversize, `14'6"` RGN Lowboy, `15'0"` Heavy Haul).
   - Real-time GPS obstacle proximity detection with clearance delta and visual radar warnings.
4. **Bidirectional Salesforce CRM & Transport Cloud REST v60.0 Sync**:
   - Automatic sync for carrier accounts, freight loads, opportunities, and live telemetry webhooks.
   - Ingests Salesforce Change Data Capture (CDC) platform events for instant dispatch updates.
5. **Voice Command Dispatch & Gemini Multimodal In-Cab Co-Pilot**:
   - Hands-free driver voice assistant executing cockpit actions (HOS rest breaks, bridge radar queries, safe haven parking).
   - Gemini multimodal camera vision for Bill of Lading (BOL) verification, cargo integrity, and tire tread analysis with cryptographic hashing.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- TypeScript 5.8+

### Install & Start Dev Server
```bash
# Install dependencies
npm install

# Start Express engine & Vite SPA (Binds to Port 3000)
npm run dev

# Or directly with tsx
npx tsx server.ts
```

### Running Test Suite
```bash
# Execute Vitest test suite for all 5 pillars
npm test
```

### Build Production Assets
```bash
npm run build
```

---

## 📖 API Documentation
Full copy-paste friendly API documentation with purpose, parameters, response shape, curl examples, and edge cases is available in [`docs/API_DOCUMENTATION.md`](file:///home/runner/work/first-project/first-project/docs/API_DOCUMENTATION.md).
