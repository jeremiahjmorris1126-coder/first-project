import {
  ClearanceProfile,
  ClearanceProfileKey,
  LowBridgeObstacle,
  LowBridgeDetectionResult,
} from '../types/index.js';

export const CLEARANCE_PROFILES: ClearanceProfile[] = [
  {
    id: '13_6_STANDARD',
    name: 'Standard Dry Van / Reefer',
    heightInches: 162, // 13' 6"
    description: 'FMCSA standard commercial 53-ft dry van and refrigerated freight trailer profile.',
  },
  {
    id: '14_0_OVERSIZE',
    name: 'Oversize Flatbed / Stepdeck',
    heightInches: 168, // 14' 0"
    description: 'Machinery and containerized high-cube flatbed load clearance profile.',
  },
  {
    id: '14_6_SPECIAL',
    name: 'Permitted RGN Lowboy',
    heightInches: 174, // 14' 6"
    description: 'Heavy construction equipment / excavator haul requiring state routing clearance.',
  },
  {
    id: '15_0_HEAVY_HAUL',
    name: 'Superload Heavy Haul',
    heightInches: 180, // 15' 0"
    description: 'Extreme dimension escort-assisted industrial component clearance profile.',
  },
];

const LOW_BRIDGE_MESH: LowBridgeObstacle[] = [
  {
    id: 'BRG-NY-101',
    bridgeName: 'Park Avenue Low Railroad Trestle',
    highwayOrRoad: 'Park Ave & 138th St',
    latitude: 40.8122,
    longitude: -73.9304,
    clearanceInches: 154, // 12' 10"
    state: 'NY',
  },
  {
    id: 'BRG-MA-204',
    bridgeName: 'Storrow Drive Eastbound Overpass',
    highwayOrRoad: 'Soldiers Field Rd / Storrow Dr',
    latitude: 42.3614,
    longitude: -71.0712,
    clearanceInches: 126, // 10' 6"
    state: 'MA',
  },
  {
    id: 'BRG-IL-305',
    bridgeName: 'Kinzie Street Rail Viaduct',
    highwayOrRoad: 'Kinzie St & Desplaines St',
    latitude: 41.8893,
    longitude: -87.6438,
    clearanceInches: 158, // 13' 2"
    state: 'IL',
  },
  {
    id: 'BRG-TX-409',
    bridgeName: 'Commerce Street Rail Underpass',
    highwayOrRoad: 'Commerce St & Cesar Chavez Blvd',
    latitude: 32.7812,
    longitude: -96.7915,
    clearanceInches: 160, // 13' 4"
    state: 'TX',
  },
  {
    id: 'BRG-NC-502',
    bridgeName: 'Gregson Street Trestle (11-Foot-8)',
    highwayOrRoad: 'South Gregson St',
    latitude: 35.9991,
    longitude: -78.9101,
    clearanceInches: 148, // 12' 4"
    state: 'NC',
  },
  {
    id: 'BRG-VA-601',
    bridgeName: 'Downtown Expressway Underpass',
    highwayOrRoad: 'VA-195 Eastbound',
    latitude: 37.5407,
    longitude: -77.4360,
    clearanceInches: 161, // 13' 5"
    state: 'VA',
  },
];

class RoutingService {
  public getProfiles(): ClearanceProfile[] {
    return CLEARANCE_PROFILES;
  }

  public getObstacles(): LowBridgeObstacle[] {
    return LOW_BRIDGE_MESH;
  }

  /**
   * Calculate distance between two lat/lon points in meters using Haversine formula
   */
  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  public checkLowBridges(
    vehicleLat: number,
    vehicleLon: number,
    profileKey: ClearanceProfileKey = '13_6_STANDARD',
    searchRadiusMeters: number = 25000
  ): {
    profile: ClearanceProfile;
    hazardsDetected: number;
    results: LowBridgeDetectionResult[];
  } {
    const profile = CLEARANCE_PROFILES.find((p) => p.id === profileKey) || CLEARANCE_PROFILES[0];
    const results: LowBridgeDetectionResult[] = [];

    for (const bridge of LOW_BRIDGE_MESH) {
      const distanceMeters = this.calculateDistanceMeters(
        vehicleLat,
        vehicleLon,
        bridge.latitude,
        bridge.longitude
      );

      if (distanceMeters <= searchRadiusMeters) {
        const delta = bridge.clearanceInches - profile.heightInches;
        let hazardLevel: 'CLEAR' | 'ADVISORY' | 'WARNING' | 'IMMINENT_STRIKE' = 'CLEAR';
        let recommendation: string | undefined;

        if (delta < 0) {
          // Negative clearance delta = Bridge is lower than the truck!
          if (distanceMeters <= 800) {
            hazardLevel = 'IMMINENT_STRIKE';
            recommendation = `CRITICAL: Stop vehicle immediately or take emergency pull-off! Overhead structure is ${Math.abs(delta)}" below vehicle height.`;
          } else if (distanceMeters <= 3500) {
            hazardLevel = 'WARNING';
            recommendation = `WARNING: Impending low bridge ahead in ${(distanceMeters / 1609.34).toFixed(1)} miles. Reroute onto designated truck arterial route.`;
          } else {
            hazardLevel = 'ADVISORY';
            recommendation = `Notice: Route waypoint approaches a non-clearing overhead bridge (${Math.floor(bridge.clearanceInches / 12)}'${bridge.clearanceInches % 12}"). Plan bypass.`;
          }
        } else if (delta <= 4) {
          // Tight clearance (less than 4 inches of safety margin)
          hazardLevel = 'ADVISORY';
          recommendation = `Tight clearance advisory: Vehicle clears by only ${delta} inches. Slow to 15 MPH and verify suspension dump status.`;
        }

        results.push({
          obstacleId: bridge.id,
          bridgeName: `${bridge.bridgeName} (${bridge.highwayOrRoad}, ${bridge.state})`,
          distanceMeters,
          bridgeClearanceInches: bridge.clearanceInches,
          vehicleHeightInches: profile.heightInches,
          clearanceDeltaInches: delta,
          hazardLevel,
          recommendedEvasiveAction: recommendation,
        });
      }
    }

    // Sort by most severe hazard first, then distance
    const severityRank = {
      IMMINENT_STRIKE: 4,
      WARNING: 3,
      ADVISORY: 2,
      CLEAR: 1,
    };

    results.sort((a, b) => {
      const diff = severityRank[b.hazardLevel] - severityRank[a.hazardLevel];
      if (diff !== 0) return diff;
      return a.distanceMeters - b.distanceMeters;
    });

    const hazardsDetected = results.filter((r) => r.hazardLevel !== 'CLEAR').length;

    return {
      profile,
      hazardsDetected,
      results,
    };
  }
}

export const routingService = new RoutingService();
