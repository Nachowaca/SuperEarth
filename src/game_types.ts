/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LandmarkLocation {
  id: string;
  name: string;
  city: string;
  country: string;
  region?: string;
  flag: string;
  lat: number;
  lng: number;
  heading: number;
  tilt: number;
  range: number;
  description: string;
  collectibleCount?: number;
}

export interface CollectibleSphere {
  id: string;
  lat: number;
  lng: number;
  altitude?: number;
  title: string;
  collected: boolean;
  points: number;
}

export interface AerialRing {
  id: string;
  lat: number;
  lng: number;
  altitudeMeters: number;
  radiusMeters: number;
  passed: boolean;
  color: string;
  points: number;
  sequenceIndex: number;
}

export interface BuildingObstacle {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  heightMeters: number;
  type: 'skyscraper' | 'monument' | 'bridge' | 'building';
}

export const WORLD_LANDMARK_OBSTACLES: BuildingObstacle[] = [
  // Buenos Aires
  { id: 'ba-obelisco', name: 'Obelisco de Buenos Aires', lat: -34.6037, lng: -58.3816, radiusMeters: 14, heightMeters: 67.5, type: 'monument' },
  { id: 'ba-teatro-colon', name: 'Teatro Colón', lat: -34.6011, lng: -58.3831, radiusMeters: 38, heightMeters: 32, type: 'building' },
  { id: 'ba-casa-rosada', name: 'Casa Rosada', lat: -34.6081, lng: -58.3703, radiusMeters: 45, heightMeters: 28, type: 'building' },
  // Paris
  { id: 'paris-eiffel', name: 'Tour Eiffel', lat: 48.8584, lng: 2.2945, radiusMeters: 42, heightMeters: 330, type: 'monument' },
  { id: 'paris-triomphe', name: 'Arc de Triomphe', lat: 48.8738, lng: 2.2950, radiusMeters: 32, heightMeters: 50, type: 'monument' },
  // New York
  { id: 'nyc-empire', name: 'Empire State Building', lat: 40.7484, lng: -73.9857, radiusMeters: 35, heightMeters: 381, type: 'skyscraper' },
  { id: 'nyc-chrysler', name: 'Chrysler Building', lat: 40.7516, lng: -73.9755, radiusMeters: 30, heightMeters: 319, type: 'skyscraper' },
  { id: 'nyc-times-tower', name: 'One Times Square', lat: 40.7563, lng: -73.9863, radiusMeters: 28, heightMeters: 111, type: 'skyscraper' },
  // Tokyo
  { id: 'tokyo-tower', name: 'Tokyo Tower', lat: 35.6586, lng: 139.7454, radiusMeters: 35, heightMeters: 333, type: 'monument' },
  { id: 'tokyo-skytree', name: 'Tokyo Skytree', lat: 35.7100, lng: 139.8107, radiusMeters: 40, heightMeters: 634, type: 'skyscraper' },
  // Madrid
  { id: 'madrid-edificio-espana', name: 'Edificio España & Riu Plaza', lat: 40.4241, lng: -3.7122, radiusMeters: 36, heightMeters: 117, type: 'skyscraper' },
  { id: 'madrid-torre-madrid', name: 'Torre de Madrid', lat: 40.4239, lng: -3.7135, radiusMeters: 32, heightMeters: 142, type: 'skyscraper' },
  { id: 'madrid-metropolis', name: 'Edificio Metrópolis Gran Vía', lat: 40.4189, lng: -3.6976, radiusMeters: 25, heightMeters: 45, type: 'building' },
  // Roma
  { id: 'rome-colosseum', name: 'Colosseo', lat: 41.8902, lng: 12.4922, radiusMeters: 55, heightMeters: 48, type: 'monument' },
  // London
  { id: 'london-big-ben', name: 'Big Ben & Elizabeth Tower', lat: 51.5007, lng: -0.1246, radiusMeters: 22, heightMeters: 96, type: 'monument' },
  { id: 'london-shard', name: 'The Shard', lat: 51.5045, lng: -0.0865, radiusMeters: 38, heightMeters: 310, type: 'skyscraper' },
  // Rio
  { id: 'rio-cristo', name: 'Cristo Redentor', lat: -22.9519, lng: -43.2105, radiusMeters: 20, heightMeters: 38, type: 'monument' },
  // Mexico City
  { id: 'cdmx-bellas-artes-obs', name: 'Palacio de Bellas Artes', lat: 19.4352, lng: -99.1412, radiusMeters: 42, heightMeters: 53, type: 'monument' },
  { id: 'cdmx-torre-latino', name: 'Torre Latinoamericana', lat: 19.4339, lng: -99.1406, radiusMeters: 28, heightMeters: 182, type: 'skyscraper' },
  // Sydney
  { id: 'sydney-opera-obs', name: 'Sydney Opera House', lat: -33.8568, lng: 151.2153, radiusMeters: 52, heightMeters: 65, type: 'building' },
];

export interface CapturedPhoto {
  id: string;
  locationName: string;
  lat: number;
  lng: number;
  heading: number;
  timestamp: string;
  thumbnailDataUrl?: string;
  speedKmh: number;
}

export interface PassportStamp {
  destinationId: string;
  cityName: string;
  country: string;
  flag: string;
  unlockedAt: string;
  souvenirIcon: string;
}

export type AvatarMode = 'tourist' | 'car' | 'trekker';
export type CameraMode = 'first_person' | 'third_person';
export type ZoomPreset = 'close' | 'medium' | 'sky';
export type SpeedPreset = 'walk' | 'bike' | 'car' | 'turbo';

export const SPEED_VALUES: Record<SpeedPreset, { speedMs: number; label: string; icon: string }> = {
  walk: { speedMs: 5.5, label: 'Glide (20 km/h)', icon: '🕊️' },
  bike: { speedMs: 16.5, label: 'Fly (60 km/h)', icon: '🦸' },
  car: { speedMs: 45.0, label: 'Supersonic (162 km/h)', icon: '⚡' },
  turbo: { speedMs: 105.0, label: 'Hypersonic (378 km/h)', icon: '🚀' },
};

export const WORLD_DESTINATIONS: LandmarkLocation[] = [
  {
    id: 'buenos-aires-obelisco',
    name: 'Obelisco & Av. 9 de Julio',
    city: 'Buenos Aires',
    country: 'Argentina',
    region: 'América del Sur',
    flag: '🇦🇷',
    lat: -34.6037,
    lng: -58.3816,
    heading: 195,
    tilt: 58,
    range: 220,
    description: 'La avenida más ancha del mundo coronada por el icónico Obelisco porteño.',
    collectibleCount: 6,
  },
  {
    id: 'madrid-gran-via',
    name: 'Gran Vía & Plaza de España',
    city: 'Madrid',
    country: 'España',
    region: 'Europa',
    flag: '🇪🇸',
    lat: 40.4203,
    lng: -3.7058,
    heading: 110,
    tilt: 58,
    range: 220,
    description: 'La emblemática arteria madrileña repleta de arquitectura clásica y teatros.',
    collectibleCount: 6,
  },
  {
    id: 'cdmx-bellas-artes',
    name: 'Palacio de Bellas Artes & Zócalo',
    city: 'Ciudad de México',
    country: 'México',
    region: 'Norteamérica',
    flag: '🇲🇽',
    lat: 19.4352,
    lng: -99.1412,
    heading: 90,
    tilt: 58,
    range: 220,
    description: 'El corazón cultural de México con su mármol blanco de Carrara y la Alameda Central.',
    collectibleCount: 6,
  },
  {
    id: 'bogota-monserrate',
    name: 'Plaza de Bolívar & Monserrate',
    city: 'Bogotá',
    country: 'Colombia',
    region: 'América del Sur',
    flag: '🇨🇴',
    lat: 4.5981,
    lng: -74.0758,
    heading: 80,
    tilt: 58,
    range: 220,
    description: 'La histórica Plaza Mayor rodeada de palacios coloniales al pie de la cordillera.',
    collectibleCount: 6,
  },
  {
    id: 'santiago-costanera',
    name: 'Gran Torre & Cordillera de Los Andes',
    city: 'Santiago',
    country: 'Chile',
    region: 'América del Sur',
    flag: '🇨🇱',
    lat: -33.4173,
    lng: -70.6067,
    heading: 65,
    tilt: 58,
    range: 220,
    description: 'El rascacielos más alto de Sudamérica con la imponente cordillera nevada de fondo.',
    collectibleCount: 6,
  },
  {
    id: 'lima-costa-verde',
    name: 'Miraflores & Costa Verde',
    city: 'Lima',
    country: 'Perú',
    region: 'América del Sur',
    flag: '🇵🇪',
    lat: -12.1221,
    lng: -77.0345,
    heading: 240,
    tilt: 58,
    range: 220,
    description: 'Los acantilados sobre el Océano Pacífico en el malecón de Miraflores.',
    collectibleCount: 6,
  },
  {
    id: 'rio-christ',
    name: 'Cristo Redentor & Bahía de Guanabara',
    city: 'Río de Janeiro',
    country: 'Brasil',
    region: 'América del Sur',
    flag: '🇧🇷',
    lat: -22.9519,
    lng: -43.2105,
    heading: 60,
    tilt: 58,
    range: 220,
    description: 'La maravilla moderna mirando sobre Río, las playas de Copacabana y el Pan de Azúcar.',
    collectibleCount: 6,
  },
  {
    id: 'nyc-times-square',
    name: 'Times Square & Broadway',
    city: 'New York',
    country: 'United States',
    region: 'Norteamérica',
    flag: '🇺🇸',
    lat: 40.7580,
    lng: -73.9855,
    heading: 200,
    tilt: 58,
    range: 220,
    description: 'The Crossroads of the World, gigantescas pantallas luminosas y rascacielos.',
    collectibleCount: 6,
  },
  {
    id: 'paris-eiffel',
    name: 'Torre Eiffel & Campo de Marte',
    city: 'París',
    country: 'Francia',
    region: 'Europa',
    flag: '🇫🇷',
    lat: 48.8584,
    lng: 2.2945,
    heading: 140,
    tilt: 58,
    range: 220,
    description: 'La dama de hierro francesa elevándose sobre las arboledas del río Sena.',
    collectibleCount: 6,
  },
  {
    id: 'barcelona-sagrada-familia',
    name: 'Basílica de la Sagrada Família',
    city: 'Barcelona',
    country: 'España',
    region: 'Europa',
    flag: '🇪🇸',
    lat: 41.4036,
    lng: 2.1744,
    heading: 155,
    tilt: 58,
    range: 220,
    description: 'La obra maestra modernista de Antoni Gaudí y su trazado urbano del Eixample.',
    collectibleCount: 6,
  },
  {
    id: 'rome-colosseum',
    name: 'Coliseo & Foro Romano',
    city: 'Roma',
    country: 'Italia',
    region: 'Europa',
    flag: '🇮🇹',
    lat: 41.8902,
    lng: 12.4922,
    heading: 45,
    tilt: 58,
    range: 220,
    description: 'El anfiteatro de los gladiadores y los templos del Imperio Romano.',
    collectibleCount: 6,
  },
  {
    id: 'london-tower-bridge',
    name: 'Tower Bridge & Big Ben',
    city: 'Londres',
    country: 'Reino Unido',
    region: 'Europa',
    flag: '🇬🇧',
    lat: 51.5055,
    lng: -0.0754,
    heading: 10,
    tilt: 58,
    range: 220,
    description: 'El puente levadizo victoriano cruzando el río Támesis y el Parlamento.',
    collectibleCount: 6,
  },
  {
    id: 'tokyo-shibuya',
    name: 'Cruce de Shibuya & Shinjuku',
    city: 'Tokio',
    country: 'Japón',
    region: 'Asia',
    flag: '🇯🇵',
    lat: 35.6595,
    lng: 139.7005,
    heading: 340,
    tilt: 58,
    range: 220,
    description: 'El cruce peatonal más concurrido del mundo bajo las luces de neón niponas.',
    collectibleCount: 7,
  },
  {
    id: 'seoul-namsan',
    name: 'Torre N de Seúl & Gangnam',
    city: 'Seúl',
    country: 'Corea del Sur',
    region: 'Asia',
    flag: '🇰🇷',
    lat: 37.5512,
    lng: 126.9882,
    heading: 190,
    tilt: 58,
    range: 220,
    description: 'La metrópolis tecnológica que combina templos Joseon y rascacielos futuristas.',
    collectibleCount: 6,
  },
  {
    id: 'dubai-burj',
    name: 'Burj Khalifa & Dubai Mall',
    city: 'Dubái',
    country: 'Emiratos Árabes',
    region: 'Asia',
    flag: '🇦🇪',
    lat: 25.1972,
    lng: 55.2744,
    heading: 230,
    tilt: 58,
    range: 220,
    description: 'El edificio más alto del planeta alzándose sobre fuentes danzantes y la marina.',
    collectibleCount: 6,
  },
  {
    id: 'sydney-opera',
    name: 'Ópera de Sídney & Bahía',
    city: 'Sídney',
    country: 'Australia',
    region: 'Oceanía',
    flag: '🇦🇺',
    lat: -33.8568,
    lng: 151.2153,
    heading: 180,
    tilt: 58,
    range: 220,
    description: 'Las icónicas cubiertas con forma de velas blancas en la bahía de Sídney.',
    collectibleCount: 5,
  },
  {
    id: 'cairo-pyramids',
    name: 'Pirámides de Giza & Esfinge',
    city: 'El Cairo',
    country: 'Egipto',
    region: 'África',
    flag: '🇪🇬',
    lat: 29.9792,
    lng: 31.1342,
    heading: 220,
    tilt: 58,
    range: 220,
    description: 'Las milenarias tumbas de los faraones en las arenas doradas del desierto.',
    collectibleCount: 6,
  },
];
