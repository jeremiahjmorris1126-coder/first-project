import { SalesforceTransportSyncPayload } from '../types/index.js';

interface SalesforceSyncState {
  lastSyncTimestamp: string;
  apiVersion: string;
  organizationId: string;
  connected: boolean;
  syncedAccountsCount: number;
  syncedLoadsCount: number;
  pendingOutboundMutationsCount: number;
  accounts: Array<{ id: string; name: string; dotNumber?: string; status: string }>;
  loads: Array<{
    loadId: string;
    bolNumber: string;
    origin: string;
    destination: string;
    assignedDriverId?: string;
    assignedVehicleId?: string;
    stage: 'PLANNED' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
    rateUsd: number;
  }>;
}

class SalesforceService {
  private state: SalesforceSyncState = {
    lastSyncTimestamp: new Date().toISOString(),
    apiVersion: 'v60.0',
    organizationId: '00D8Z000002XYzeUAG',
    connected: true,
    syncedAccountsCount: 2,
    syncedLoadsCount: 3,
    pendingOutboundMutationsCount: 0,
    accounts: [
      { id: '0018Z00003ABC01', name: 'Titan Logistics Corp', dotNumber: '3819201', status: 'ACTIVE' },
      { id: '0018Z00003ABC02', name: 'Apex Distribution Group', dotNumber: '2981140', status: 'ACTIVE' },
    ],
    loads: [
      {
        loadId: 'LD-8892',
        bolNumber: 'BOL-2026-99120',
        origin: 'Dallas Intermodal Yard, TX',
        destination: 'Chicago Logistics Park, IL',
        assignedDriverId: 'DRV-7701',
        assignedVehicleId: 'TRK-900',
        stage: 'IN_TRANSIT',
        rateUsd: 3450.0,
      },
      {
        loadId: 'LD-8893',
        bolNumber: 'BOL-2026-99121',
        origin: 'Atlanta Cold Storage, GA',
        destination: 'Miami Freight Terminal, FL',
        assignedDriverId: 'DRV-5502',
        assignedVehicleId: 'TRK-410',
        stage: 'DISPATCHED',
        rateUsd: 2800.0,
      },
      {
        loadId: 'LD-8894',
        bolNumber: 'BOL-2026-99122',
        origin: 'Kansas City Rail Hub, MO',
        destination: 'Denver Distribution Center, CO',
        stage: 'PLANNED',
        rateUsd: 4100.0,
      },
    ],
  };

  public getStatus(): SalesforceSyncState {
    return { ...this.state };
  }

  public syncPayload(payload: SalesforceTransportSyncPayload): {
    success: boolean;
    recordsProcessed: number;
    syncTimestamp: string;
    appliedLoads: number;
  } {
    this.state.lastSyncTimestamp = new Date().toISOString();
    this.state.organizationId = payload.organizationId || this.state.organizationId;

    let appliedLoadsCount = 0;
    if (payload.records.loads && payload.records.loads.length > 0) {
      for (const incomingLoad of payload.records.loads) {
        const existingIdx = this.state.loads.findIndex((l) => l.loadId === incomingLoad.loadId);
        if (existingIdx >= 0) {
          this.state.loads[existingIdx] = { ...this.state.loads[existingIdx], ...incomingLoad };
        } else {
          this.state.loads.push(incomingLoad);
        }
        appliedLoadsCount++;
      }
    }

    if (payload.records.accounts && payload.records.accounts.length > 0) {
      for (const incomingAcc of payload.records.accounts) {
        const existingIdx = this.state.accounts.findIndex((a) => a.id === incomingAcc.id);
        if (existingIdx >= 0) {
          this.state.accounts[existingIdx] = { ...this.state.accounts[existingIdx], ...incomingAcc };
        } else {
          this.state.accounts.push(incomingAcc);
        }
      }
    }

    this.state.syncedAccountsCount = this.state.accounts.length;
    this.state.syncedLoadsCount = this.state.loads.length;

    const totalProcessed = (payload.records.loads?.length || 0) + (payload.records.accounts?.length || 0) + (payload.records.telemetryEvents?.length || 0);

    return {
      success: true,
      recordsProcessed: totalProcessed,
      syncTimestamp: this.state.lastSyncTimestamp,
      appliedLoads: appliedLoadsCount,
    };
  }

  public handleWebhook(event: {
    eventType: string;
    replayId?: number;
    payload: {
      loadId?: string;
      newStage?: 'PLANNED' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
      driverId?: string;
      vehicleId?: string;
      notes?: string;
    };
  }): {
    acknowledged: boolean;
    actionApplied: string;
    updatedRecord?: unknown;
  } {
    const { eventType, payload } = event;

    if (payload.loadId) {
      const load = this.state.loads.find((l) => l.loadId === payload.loadId);
      if (load) {
        if (payload.newStage) load.stage = payload.newStage;
        if (payload.driverId) load.assignedDriverId = payload.driverId;
        if (payload.vehicleId) load.assignedVehicleId = payload.vehicleId;

        return {
          acknowledged: true,
          actionApplied: `Salesforce CDC Event [${eventType}]: Updated load ${payload.loadId}`,
          updatedRecord: load,
        };
      }
    }

    return {
      acknowledged: true,
      actionApplied: `Salesforce CDC Event [${eventType}] processed without direct mutation`,
    };
  }
}

export const salesforceService = new SalesforceService();
