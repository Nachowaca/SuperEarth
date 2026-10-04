/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BuildingObstacle } from './game_types';

export interface FamousStreetTarget {
  name: string;
  lat: number;
  lng: number;
  description: string;
}

export interface CityMissionData {
  cityName: string;
  famousStreet: FamousStreetTarget;
  iconicLandmarks: { id: string; name: string; lat: number; lng: number }[];
}

export type MissionType = 'photo_landmarks' | 'timed_street_hunt' | 'ring_combo' | 'altitude_peak';

export interface CityMission {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  progress: number;
  maxProgress: number;
  xpReward: number;
  // Specific to timed street hunt
  timeLimitSeconds?: number;
  timeRemainingSeconds?: number;
  timerActive?: boolean;
  targetStreet?: FamousStreetTarget;
  radarDistanceMeters?: number;
  radarDirection?: string;
  // Specific to photo landmarks
  photographedIds?: string[];
}

export const FAMOUS_CITY_TARGETS: Record<string, CityMissionData> = {
  'buenos aires': {
    cityName: 'Buenos Aires',
    famousStreet: {
      name: 'Avenida 9 de Julio',
      lat: -34.6037,
      lng: -58.3816,
      description: 'La avenida más ancha del mundo, donde se alza el legendario Obelisco.',
    },
    iconicLandmarks: [
      { id: 'ba-obelisco', name: 'Obelisco de Buenos Aires', lat: -34.6037, lng: -58.3816 },
      { id: 'ba-teatro-colon', name: 'Teatro Colón', lat: -34.6011, lng: -58.3831 },
      { id: 'ba-casa-rosada', name: 'Casa Rosada', lat: -34.6081, lng: -58.3703 },
    ],
  },
  'madrid': {
    cityName: 'Madrid',
    famousStreet: {
      name: 'Gran Vía',
      lat: 40.4203,
      lng: -3.7058,
      description: 'La histórica avenida madrileña de los cines, teatros y rascacielos clásicos.',
    },
    iconicLandmarks: [
      { id: 'madrid-edificio-espana', name: 'Edificio España & Plaza de España', lat: 40.4241, lng: -3.7122 },
      { id: 'madrid-torre-madrid', name: 'Torre de Madrid', lat: 40.4239, lng: -3.7135 },
      { id: 'madrid-metropolis', name: 'Edificio Metrópolis', lat: 40.4189, lng: -3.6976 },
    ],
  },
  'paris': {
    cityName: 'París',
    famousStreet: {
      name: 'Avenue des Champs-Élysées',
      lat: 48.8698,
      lng: 2.3075,
      description: 'La célebre avenida parisina que conecta la Plaza de la Concordia con el Arco de Triunfo.',
    },
    iconicLandmarks: [
      { id: 'paris-eiffel', name: 'Torre Eiffel', lat: 48.8584, lng: 2.2945 },
      { id: 'paris-triomphe', name: 'Arco de Triunfo', lat: 48.8738, lng: 2.2950 },
      { id: 'paris-louvre', name: 'Museo del Louvre', lat: 48.8606, lng: 2.3376 },
    ],
  },
  'parís': {
    cityName: 'París',
    famousStreet: {
      name: 'Avenue des Champs-Élysées',
      lat: 48.8698,
      lng: 2.3075,
      description: 'La célebre avenida parisina que conecta la Plaza de la Concordia con el Arco de Triunfo.',
    },
    iconicLandmarks: [
      { id: 'paris-eiffel', name: 'Torre Eiffel', lat: 48.8584, lng: 2.2945 },
      { id: 'paris-triomphe', name: 'Arco de Triunfo', lat: 48.8738, lng: 2.2950 },
      { id: 'paris-louvre', name: 'Museo del Louvre', lat: 48.8606, lng: 2.3376 },
    ],
  },
  'new york': {
    cityName: 'New York',
    famousStreet: {
      name: 'Broadway & 42nd St',
      lat: 40.7580,
      lng: -73.9855,
      description: 'La arteria del teatro mundial y las luces de neón en Times Square.',
    },
    iconicLandmarks: [
      { id: 'nyc-empire', name: 'Empire State Building', lat: 40.7484, lng: -73.9857 },
      { id: 'nyc-chrysler', name: 'Chrysler Building', lat: 40.7516, lng: -73.9755 },
      { id: 'nyc-times-tower', name: 'One Times Square', lat: 40.7563, lng: -73.9863 },
    ],
  },
  'tokio': {
    cityName: 'Tokio',
    famousStreet: {
      name: 'Cruce de Shibuya',
      lat: 35.6595,
      lng: 139.7005,
      description: 'La icónica intersección peatonal más transitada del planeta.',
    },
    iconicLandmarks: [
      { id: 'tokyo-tower', name: 'Torre de Tokio', lat: 35.6586, lng: 139.7454 },
      { id: 'tokyo-skytree', name: 'Tokyo Skytree', lat: 35.7100, lng: 139.8107 },
      { id: 'tokyo-shibuya-center', name: 'Shibuya 109', lat: 35.6598, lng: 139.6998 },
    ],
  },
  'tokyo': {
    cityName: 'Tokio',
    famousStreet: {
      name: 'Cruce de Shibuya',
      lat: 35.6595,
      lng: 139.7005,
      description: 'La icónica intersección peatonal más transitada del planeta.',
    },
    iconicLandmarks: [
      { id: 'tokyo-tower', name: 'Torre de Tokio', lat: 35.6586, lng: 139.7454 },
      { id: 'tokyo-skytree', name: 'Tokyo Skytree', lat: 35.7100, lng: 139.8107 },
      { id: 'tokyo-shibuya-center', name: 'Shibuya 109', lat: 35.6598, lng: 139.6998 },
    ],
  },
  'roma': {
    cityName: 'Roma',
    famousStreet: {
      name: 'Via dei Fori Imperiali',
      lat: 41.8925,
      lng: 12.4883,
      description: 'La majestuosa vía que une el Coliseo con la Plaza Venecia entre ruinas romanas.',
    },
    iconicLandmarks: [
      { id: 'rome-colosseum', name: 'Coliseo Romano', lat: 41.8902, lng: 12.4922 },
      { id: 'rome-forum', name: 'Foro Romano', lat: 41.8918, lng: 12.4862 },
      { id: 'rome-altar', name: 'Monumento a Víctor Manuel II', lat: 41.8946, lng: 12.4828 },
    ],
  },
  'london': {
    cityName: 'Londres',
    famousStreet: {
      name: 'Piccadilly & Regent Street',
      lat: 51.5100,
      lng: -0.1347,
      description: 'El corazón del West End londinense entre fuentes y autobuses rojos.',
    },
    iconicLandmarks: [
      { id: 'london-big-ben', name: 'Big Ben & Parlamento', lat: 51.5007, lng: -0.1246 },
      { id: 'london-shard', name: 'The Shard', lat: 51.5045, lng: -0.0865 },
      { id: 'london-tower-bridge', name: 'Tower Bridge', lat: 51.5055, lng: -0.0754 },
    ],
  },
  'londres': {
    cityName: 'Londres',
    famousStreet: {
      name: 'Piccadilly & Regent Street',
      lat: 51.5100,
      lng: -0.1347,
      description: 'El corazón del West End londinense entre fuentes y autobuses rojos.',
    },
    iconicLandmarks: [
      { id: 'london-big-ben', name: 'Big Ben & Parlamento', lat: 51.5007, lng: -0.1246 },
      { id: 'london-shard', name: 'The Shard', lat: 51.5045, lng: -0.0865 },
      { id: 'london-tower-bridge', name: 'Tower Bridge', lat: 51.5055, lng: -0.0754 },
    ],
  },
  'ciudad de méxico': {
    cityName: 'Ciudad de México',
    famousStreet: {
      name: 'Paseo de la Reforma',
      lat: 19.4326,
      lng: -99.1540,
      description: 'La gran avenida arbolada con el Ángel de la Independencia y la Diana Cazadora.',
    },
    iconicLandmarks: [
      { id: 'cdmx-bellas-artes-obs', name: 'Palacio de Bellas Artes', lat: 19.4352, lng: -99.1412 },
      { id: 'cdmx-torre-latino', name: 'Torre Latinoamericana', lat: 19.4339, lng: -99.1406 },
      { id: 'cdmx-monumento-rev', name: 'Monumento a la Revolución', lat: 19.4362, lng: -99.1546 },
    ],
  },
  'cdmx': {
    cityName: 'Ciudad de México',
    famousStreet: {
      name: 'Paseo de la Reforma',
      lat: 19.4326,
      lng: -99.1540,
      description: 'La gran avenida arbolada con el Ángel de la Independencia y la Diana Cazadora.',
    },
    iconicLandmarks: [
      { id: 'cdmx-bellas-artes-obs', name: 'Palacio de Bellas Artes', lat: 19.4352, lng: -99.1412 },
      { id: 'cdmx-torre-latino', name: 'Torre Latinoamericana', lat: 19.4339, lng: -99.1406 },
      { id: 'cdmx-monumento-rev', name: 'Monumento a la Revolución', lat: 19.4362, lng: -99.1546 },
    ],
  },
  'sydney': {
    cityName: 'Sídney',
    famousStreet: {
      name: 'Circular Quay & George St',
      lat: -33.8610,
      lng: 151.2100,
      description: 'El paseo costero frente a la bahía entre ferries y rascacielos.',
    },
    iconicLandmarks: [
      { id: 'sydney-opera-obs', name: 'Sydney Opera House', lat: -33.8568, lng: 151.2153 },
      { id: 'sydney-bridge', name: 'Harbour Bridge', lat: -33.8523, lng: 151.2108 },
      { id: 'sydney-tower', name: 'Sydney Tower Eye', lat: -33.8704, lng: 151.2088 },
    ],
  },
  'sídney': {
    cityName: 'Sídney',
    famousStreet: {
      name: 'Circular Quay & George St',
      lat: -33.8610,
      lng: 151.2100,
      description: 'El paseo costero frente a la bahía entre ferries y rascacielos.',
    },
    iconicLandmarks: [
      { id: 'sydney-opera-obs', name: 'Sydney Opera House', lat: -33.8568, lng: 151.2153 },
      { id: 'sydney-bridge', name: 'Harbour Bridge', lat: -33.8523, lng: 151.2108 },
      { id: 'sydney-tower', name: 'Sydney Tower Eye', lat: -33.8704, lng: 151.2088 },
    ],
  },
  'río de janeiro': {
    cityName: 'Río de Janeiro',
    famousStreet: {
      name: 'Avenida Atlântica (Copacabana)',
      lat: -22.9711,
      lng: -43.1822,
      description: 'El ondulante mosaico portugués junto a las olas del Atlántico.',
    },
    iconicLandmarks: [
      { id: 'rio-cristo', name: 'Cristo Redentor', lat: -22.9519, lng: -43.2105 },
      { id: 'rio-sugarloaf-obs', name: 'Pan de Azúcar', lat: -22.9492, lng: -43.1545 },
      { id: 'rio-arcos', name: 'Arcos da Lapa', lat: -22.9130, lng: -43.1794 },
    ],
  },
  'rio de janeiro': {
    cityName: 'Río de Janeiro',
    famousStreet: {
      name: 'Avenida Atlântica (Copacabana)',
      lat: -22.9711,
      lng: -43.1822,
      description: 'El ondulante mosaico portugués junto a las olas del Atlántico.',
    },
    iconicLandmarks: [
      { id: 'rio-cristo', name: 'Cristo Redentor', lat: -22.9519, lng: -43.2105 },
      { id: 'rio-sugarloaf-obs', name: 'Pan de Azúcar', lat: -22.9492, lng: -43.1545 },
      { id: 'rio-arcos', name: 'Arcos da Lapa', lat: -22.9130, lng: -43.1794 },
    ],
  },
};

/**
 * Milestone Missions Manager: Generates specific flight objectives
 * without any search engine requirement, relying purely on manual 3D flight.
 */
export class MissionSystem {
  public currentMissions: CityMission[] = [];
  public activeCityData?: CityMissionData;
  public onMissionCompleted?: (mission: CityMission) => void;
  public onMissionProgress?: (mission: CityMission) => void;

  public initializeForCity(cityName: string, cityLat: number, cityLng: number, obstacles: BuildingObstacle[] = []) {
    const key = (cityName || '').toLowerCase().trim();
    let data = FAMOUS_CITY_TARGETS[key];

    if (!data) {
      // Find matching key
      for (const [k, v] of Object.entries(FAMOUS_CITY_TARGETS)) {
        if (key.includes(k) || k.includes(key)) {
          data = v;
          break;
        }
      }
    }

    if (!data) {
      // Procedural generation for any other city in the world!
      const landmarkItems = obstacles.slice(0, 3).map((o, idx) => ({
        id: o.id,
        name: o.name || `Punto Turístico #${idx + 1}`,
        lat: o.lat,
        lng: o.lng,
      }));

      // Default street target 180m from center
      data = {
        cityName: cityName,
        famousStreet: {
          name: `Avenida Central de ${cityName}`,
          lat: cityLat + 0.0016,
          lng: cityLng + 0.0018,
          description: `El eje principal urbano de ${cityName}. ¡Vuela y localízalo por radar!`,
        },
        iconicLandmarks: landmarkItems.length > 0 ? landmarkItems : [
          { id: `landmark-${cityName}-1`, name: `Monumento Central de ${cityName}`, lat: cityLat + 0.0008, lng: cityLng - 0.0008 },
          { id: `landmark-${cityName}-2`, name: `Plaza Mayor de ${cityName}`, lat: cityLat - 0.0009, lng: cityLng + 0.0009 },
          { id: `landmark-${cityName}-3`, name: `Catedral / Palacio de ${cityName}`, lat: cityLat + 0.0014, lng: cityLng - 0.0012 },
        ],
      };
    }

    this.activeCityData = data;
    this.currentMissions = [
      {
        id: `photo-3-landmarks-${Date.now()}`,
        type: 'photo_landmarks',
        title: 'Fotografiar 3 edificios icónicos',
        description: `Vuela cerca de los monumentos de ${cityName} y pulsa 📸 Foto (a menos de 180m).`,
        icon: '📸',
        completed: false,
        progress: 0,
        maxProgress: 3,
        xpReward: 300,
        photographedIds: [],
      },
      {
        id: `timed-hunt-street-${Date.now()}`,
        type: 'timed_street_hunt',
        title: `Encontrar "${data.famousStreet.name}" en menos de 1 min`,
        description: `¡Sin buscador! Guíate solo volando con el radar de proximidad.`,
        icon: '⏱️',
        completed: false,
        progress: 0,
        maxProgress: 1,
        xpReward: 350,
        timeLimitSeconds: 60,
        timeRemainingSeconds: 60,
        timerActive: true,
        targetStreet: data.famousStreet,
        radarDistanceMeters: 500,
        radarDirection: 'Norte',
      },
      {
        id: `aerial-combo-rings-${Date.now()}`,
        type: 'ring_combo',
        title: 'Combo Supersónico: 4 Anillos',
        description: 'Atraviesa 4 anillos consecutivos sin perder el combo de velocidad.',
        icon: '⭕',
        completed: false,
        progress: 0,
        maxProgress: 4,
        xpReward: 200,
      },
      {
        id: `altitude-peak-${Date.now()}`,
        type: 'altitude_peak',
        title: 'Vuelo a Gran Altura: 250m',
        description: 'Asciende por encima de los rascacielos y domina la ciudad desde el cielo.',
        icon: '⛰️',
        completed: false,
        progress: 0,
        maxProgress: 250,
        xpReward: 150,
      },
    ];
  }

  /**
   * Called every frame in updatePhysics
   */
  public update(playerLat: number, playerLng: number, playerAltitude: number, deltaTime: number, currentCombo: number) {
    for (const mission of this.currentMissions) {
      if (mission.completed) continue;

      // 1. Timed Street Hunt
      if (mission.type === 'timed_street_hunt' && mission.targetStreet) {
        if (mission.timerActive && mission.timeRemainingSeconds !== undefined) {
          mission.timeRemainingSeconds = Math.max(0, mission.timeRemainingSeconds - deltaTime);
          if (mission.timeRemainingSeconds <= 0) {
            mission.timerActive = false;
          }
        }

        const dLat = (playerLat - mission.targetStreet.lat) * 111139;
        const dLng = (playerLng - mission.targetStreet.lng) * 111139 * Math.cos((playerLat * Math.PI) / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        mission.radarDistanceMeters = Math.round(dist);

        // Direction calculation
        const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
        const directions = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'];
        const dirIndex = Math.round(((angle + 360) % 360) / 45) % 8;
        mission.radarDirection = directions[dirIndex];

        // Did player reach target street (within 65 meters)?
        if (dist <= 65 && mission.timerActive) {
          mission.completed = true;
          mission.progress = 1;
          mission.timerActive = false;
          this.onMissionCompleted?.(mission);
        }
      }

      // 2. Ring Combo
      if (mission.type === 'ring_combo') {
        if (currentCombo > mission.progress) {
          mission.progress = Math.min(mission.maxProgress, currentCombo);
          if (mission.progress >= mission.maxProgress) {
            mission.completed = true;
            this.onMissionCompleted?.(mission);
          }
        }
      }

      // 3. Altitude Peak
      if (mission.type === 'altitude_peak') {
        if (playerAltitude > mission.progress) {
          mission.progress = Math.min(mission.maxProgress, Math.round(playerAltitude));
          if (mission.progress >= mission.maxProgress) {
            mission.completed = true;
            this.onMissionCompleted?.(mission);
          }
        }
      }
    }
  }

  /**
   * Called when player snaps a photo
   */
  public onPhotoSnapped(playerLat: number, playerLng: number): { completedCount: number; newlyPhotographedName?: string } {
    const photoMission = this.currentMissions.find((m) => m.type === 'photo_landmarks' && !m.completed);
    if (!photoMission || !this.activeCityData) return { completedCount: 0 };

    let newlyPhotographedName: string | undefined;

    for (const landmark of this.activeCityData.iconicLandmarks) {
      if (photoMission.photographedIds?.includes(landmark.id)) continue;

      const dLat = (playerLat - landmark.lat) * 111139;
      const dLng = (playerLng - landmark.lng) * 111139 * Math.cos((playerLat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      // Within 220m of landmark counts as photographing it
      if (dist <= 220) {
        photoMission.photographedIds = [...(photoMission.photographedIds || []), landmark.id];
        photoMission.progress = photoMission.photographedIds.length;
        newlyPhotographedName = landmark.name;

        if (photoMission.progress >= photoMission.maxProgress) {
          photoMission.completed = true;
          this.onMissionCompleted?.(photoMission);
        } else {
          this.onMissionProgress?.(photoMission);
        }
        break;
      }
    }

    return { completedCount: photoMission.progress, newlyPhotographedName };
  }

  public restartTimedStreetHunt() {
    const hunt = this.currentMissions.find((m) => m.type === 'timed_street_hunt');
    if (hunt) {
      hunt.timeRemainingSeconds = 60;
      hunt.timerActive = true;
      hunt.completed = false;
      hunt.progress = 0;
    }
  }

  public getCompletedCount(): number {
    return this.currentMissions.filter((m) => m.completed).length;
  }
}
