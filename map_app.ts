/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Source: Google Maps Platform Code Assist
 *
 * This file defines the main `gdm-map-app` LitElement component.
 * Features:
 * - Real 3D Collision Physics:
 *   - Detects collisions with 3D buildings, urban skyscrapers, monuments, and ground.
 *   - Proximity radar alert warning when dangerously close to structures.
 *   - Dynamic collision response: bounce-back, sparks & comic particle burst,
 *     screen shake, metallic impact audio, and score penalty.
 *   - Ground landing physics: hard skid impact at high speed vs smooth hero touchdown when landing gently.
 * - Interactive 3D Aerial Rings & Stunt Flight Circuit:
 *   - Rings floating at realistic altitudes throughout the city streets.
 *   - 3D proximity detection with speed boost surge, combo multipliers, sound, and shockwaves!
 * - Acrobatic Flight Maneuvers:
 *   - 360° Barrel Roll (giro de barril acrobático con tecla R o botón en pantalla).
 *   - Supersonic Turbo Boost with Mach shockwave rings and wind trails.
 * - Real 3D Altitude Tracking:
 *   - True vertical elevation in Google Photorealistic 3D Maps (`center = {lat, lng, altitude}`).
 *   - Climb and dive controls (`🔼 Subir` / `🔽 Bajar`).
 * - Always starts in Sky View (220m).
 * - Interactive 3D World Globe & Orbital Flight: fly to ANY city on Earth.
 * - Sleek, low-profile, responsive HUD.
 */

import {Loader} from '@googlemaps/js-api-loader';
import hljs from 'highlight.js';
import {html, LitElement, PropertyValueMap} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import {Marked} from 'marked';
import {markedHighlight} from 'marked-highlight';

import {sound} from './src/audio';
import {CharacterRenderer} from './src/character_renderer';
import {Hero3D} from './src/hero3d';

// 3D hero (src/hero3d.ts + public/models/hero.glb) is parked; flip to true to bring it back.
const USE_3D_HERO = false;

// Intro screen with the Play button; set to true to bring it back.
const SHOW_INTRO = false;
import {
  WeatherCondition,
  WeatherParticleSystem,
  WEATHER_METADATA,
  getWeatherForCity,
} from './src/weather_system';
import {
  DayNightSystem,
  DayNightState,
} from './src/day_night_system';
import {
  MissionSystem,
  CityMission,
} from './src/mission_system';
import {
  AerialRing,
  AvatarMode,
  BuildingObstacle,
  CameraMode,
  CapturedPhoto,
  CollectibleSphere,
  LandmarkLocation,
  PassportStamp,
  SpeedPreset,
  WORLD_DESTINATIONS,
  WORLD_LANDMARK_OBSTACLES,
  ZoomPreset,
} from './src/game_types';
import {MapParams} from './mcp_maps_server';

/** Markdown formatting function with syntax highlighting */
export const marked = new Marked(
  markedHighlight({
    async: true,
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, {language}).value;
    },
  }),
);

export enum ChatState {
  IDLE,
  GENERATING,
  THINKING,
  EXECUTING,
}

// Google Maps API Key configured via environment variables
const USER_PROVIDED_GOOGLE_MAPS_API_KEY: string =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (process.env as any)?.VITE_GOOGLE_MAPS_API_KEY ||
  'AIzaSyAbPTU5J7TkNHpvHRmQUEWTF9EVUzv8FIk';

// Helper to extract country flag emoji from 2-letter country code
function countryCodeToFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

@customElement('gdm-map-app')
export class MapApp extends LitElement {
  @query('#mapContainer') mapContainerElement?: HTMLElement;
  @query('#weatherCanvas') weatherCanvas?: HTMLCanvasElement;
  @query('#characterCanvas') characterCanvas?: HTMLCanvasElement;
  @query('#hero3dCanvas') hero3dCanvas?: HTMLCanvasElement;
  @query('#worldMapSearchInput') worldMapSearchInputElement?: HTMLInputElement;

  // --- Coordinates, 3D Altitude & Camera ---
  @state() playerLat: number = -34.6037; // Buenos Aires Obelisk default
  @state() playerLng: number = -58.3816;
  @state() playerAltitude: number = 42; // Real altitude in meters above ground level
  @state() playerHeading: number = 195;
  @state() playerTilt: number = 55; // Sky View tilt
  @state() playerRange: number = 320; // Starts in SKY VIEW alejado 100m a escala (320m)!
  @state() currentSpeedKmh: number = 0;
  @state() totalDistanceMeters: number = 0;
  @state() currentScore: number = 0;
  @state() currentStreetName: string = 'Obelisco & Av. 9 de Julio';
  @state() currentCity: string = 'Buenos Aires';
  @state() currentCountry: string = 'Argentina';
  @state() currentFlag: string = '🇦🇷';

  // --- Dynamic Weather & Atmosphere ---
  @state() currentWeather: WeatherCondition = 'clear';

  // --- 3D Collision & Gameplay State ---
  @state() collisionsEnabled: boolean = true;
  @state() proximityWarning: string = '';
  @state() isScreenShaking: boolean = false;
  @state() isClimbing: boolean = false;
  @state() isDiving: boolean = false;
  @state() isTurboActive: boolean = false;
  @state() aerialRings: AerialRing[] = [];
  @state() ringsPassedCount: number = 0;
  @state() ringCombo: number = 0;

  // --- Camera & View State ---
  @state() cameraMode: CameraMode = 'third_person';
  @state() zoomPreset: ZoomPreset = 'sky'; // Default ALWAYS sky view
  @state() avatarMode: AvatarMode = 'tourist';
  @state() speedPreset: SpeedPreset = 'bike';
  @state() isMuted: boolean = false;
  @state() showThemePicker: boolean = false;
  @state() showIntro: boolean = SHOW_INTRO;
  @state() introLeaving: boolean = false;
  private introSavedRange: number = 320;
  @state() uiTheme: string = (() => {
    try { return localStorage.getItem('ee3d-theme') || 'midnight'; } catch { return 'midnight'; }
  })();

  // --- Joystick & Drive Button States ---
  @state() isJoystickActive: boolean = false;
  @state() joystickKnobX: number = 0;
  @state() joystickKnobY: number = 0;
  @state() isAccelerating: boolean = false;
  @state() isBraking: boolean = false;

  // --- Modals & Panels ---
  @state() showWorldMapModal: boolean = false;
  @state() showPassportModal: boolean = false;
  @state() selectedRegion: string = 'Todos';
  @state() worldSearchQuery: string = '';
  @state() photoFlashActive: boolean = false;
  @state() toastMessage: string = '';
  @state() toastSubtext: string = '';
  @state() isOrbitalView: boolean = false;
  @state() isAscendingToSpace: boolean = false;
  @state() selectedOrbitalTarget: {
    lat: number;
    lng: number;
    name: string;
    country?: string;
    flag?: string;
  } | null = null;
  @state() orbitalSearchQuery: string = '';
  @state() orbitalCategory: string = 'todos';
  @state() showEarthExplorerDrawer: boolean = false;

  // --- Day-Night & Time Shift System ---
  public dayNightSystem: DayNightSystem = new DayNightSystem();
  @state() dayNightState?: DayNightState;
  @state() showTimeShiftModal: boolean = false;

  // --- Milestone Mission System ---
  public missionSystem: MissionSystem = new MissionSystem();
  @state() showMissionsModal: boolean = false;

  // --- Right-Side Slide-out Drawer for Centralized HUD ---
  @state() showSideDrawer: boolean = false;
  @state() activeDrawerTab: string = 'todos';

  // --- Vuela a donde quieras (Search Bar below Recorrido Metros) ---
  @state() vuelaSearchQuery: string = '';
  @state() showVuelaDropdown: boolean = false;

  // --- Photos & Collectibles ---
  @state() passportStamps: PassportStamp[] = [
    {
      destinationId: 'buenos-aires-obelisco',
      cityName: 'Buenos Aires',
      country: 'Argentina',
      flag: '🇦🇷',
      unlockedAt: 'Inicio del Viaje',
      souvenirIcon: '🌟',
    },
  ];
  @state() capturedPhotos: CapturedPhoto[] = [];
  @state() collectibles: CollectibleSphere[] = [];

  // MCP AI chat states for index.tsx
  @state() chatState: ChatState = ChatState.IDLE;
  @state() inputMessage: string = '';
  @state() messages: HTMLElement[] = [];
  public sendMessageHandler?: (input: string, role: string) => Promise<void>;

  // Internal Input & Physics tracking
  private keysPressed: Record<string, boolean> = {};
  private characterRenderer?: CharacterRenderer;
  private hero3d?: Hero3D;
  private weatherSystem?: WeatherParticleSystem;
  private animationFrameId?: number;
  private lastFrameTime: number = 0;
  private geocodeThrottleTimer?: any;
  private lastGeocodedLat: number = 0;
  private lastGeocodedLng: number = 0;
  private autoCaptureDistance: number = 0;
  private collisionCooldown: number = 0;
  private ringComboTimer: number = 0;

  // Google Maps services & 3D Elements
  private map?: any;
  private playerMarker?: any;
  private collectibleMarkers: any[] = [];
  private ringMarkers: any[] = [];
  private currentCityObstacles: BuildingObstacle[] = [];
  private Map3DElement?: any;
  private Marker3DElement?: any;

  @state() mapInitialized = false;
  @state() mapError = '';

  createRenderRoot() {
    return this;
  }

  protected firstUpdated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>,
  ): void {
    this.initControls();
    this.loadMap();

    // Initialize Day-Night cycle and Milestone Missions
    this.dayNightState = this.dayNightSystem.update(this.playerLat, this.playerLng);
    this.missionSystem.initializeForCity(this.currentCity, this.playerLat, this.playerLng, this.currentCityObstacles);
    this.missionSystem.onMissionCompleted = (mission: CityMission) => {
      sound.playCosmicChime();
      this.currentScore += mission.xpReward;
      this.showToast('🏆 ¡Hito de Misión Completado!', `${mission.title} (+${mission.xpReward} XP)`);
      this.requestUpdate();
    };
    this.missionSystem.onMissionProgress = (mission: CityMission) => {
      sound.playCollectChime();
      this.requestUpdate();
    };
  }

  private boundKeyDown?: (e: KeyboardEvent) => void;
  private boundKeyUp?: (e: KeyboardEvent) => void;
  private boundWheel?: (e: WheelEvent) => void;
  private boundResize?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    document.documentElement.dataset.theme = this.uiTheme;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
    if (this.boundWheel) window.removeEventListener('wheel', this.boundWheel);
    if (this.boundResize) window.removeEventListener('resize', this.boundResize);
  }

  /**
   * Initializes keyboard and mouse wheel listeners
   */
  private initControls() {
    this.boundKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (this.showIntro) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.startGameFromIntro();
        }
        return;
      }

      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (key === ' ' || e.code === 'Space') {
        if (this.isOrbitalView) {
          if (this.selectedOrbitalTarget) {
            this.descendToCoordinates(
              this.selectedOrbitalTarget.lat,
              this.selectedOrbitalTarget.lng,
              this.selectedOrbitalTarget.name,
              this.selectedOrbitalTarget.country,
              this.selectedOrbitalTarget.flag,
            );
          } else {
            this.flyFromOrbitToCity(this.playerLat, this.playerLng, this.currentCity, this.currentCountry, this.currentFlag, 195);
          }
        } else {
          this.launchToSpace();
        }
      } else if (key === 'r') {
        this.triggerStuntRoll();
      } else if (key === 't') {
        this.toggleCollisions();
      } else if (key === 'shift') {
        this.triggerTurboBoost();
      } else if (key === 'c' && !e.ctrlKey) {
        this.snapStreetViewPhoto();
      } else if (key === 'v') {
        this.toggleCameraMode();
      } else if (key === 'm') {
        this.showSideDrawer = !this.showSideDrawer;
      } else if (key === 'u') {
        this.toggleAudio();
      } else if (key === 'p') {
        this.showSideDrawer = true;
        this.activeDrawerTab = 'pasaporte';
      } else if (key === 'k') {
        this.showSideDrawer = true;
        this.activeDrawerTab = 'misiones';
      } else if (key === 'j') {
        this.showSideDrawer = true;
        this.activeDrawerTab = 'tiempo';
      } else if (e.key === 'Escape') {
        this.showSideDrawer = false;
        this.showTimeShiftModal = false;
        this.showMissionsModal = false;
        this.showVuelaDropdown = false;
        this.showWorldMapModal = false;
        this.showPassportModal = false;
        this.showThemePicker = false;
      } else if (key === 'g') {
        if (this.isOrbitalView) {
          this.flyFromOrbitToCity(this.playerLat, this.playerLng, this.currentCity, this.currentCountry, this.currentFlag, 195);
        } else {
          this.launchToSpace();
        }
      }
    };
    window.addEventListener('keydown', this.boundKeyDown);

    this.boundKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      this.keysPressed[key] = false;
      if (key === 'shift') {
        this.isTurboActive = false;
      }
    };
    window.addEventListener('keyup', this.boundKeyUp);

    // Mouse Wheel Zoom
    this.boundWheel = (e: WheelEvent) => {
      if (this.showIntro || this.showWorldMapModal || this.showPassportModal) {
        return;
      }
      this.zoomCamera(e.deltaY * 0.08);
    };
    window.addEventListener('wheel', this.boundWheel, {passive: true});

    // Window resize
    this.boundResize = () => {
      if (this.characterCanvas && this.characterRenderer) {
        this.characterRenderer.resize(
          this.characterCanvas.clientWidth,
          this.characterCanvas.clientHeight,
        );
        this.hero3d?.resize(this.characterCanvas.clientWidth, this.characterCanvas.clientHeight);
      }
      if (this.weatherSystem) {
        this.weatherSystem.resize();
      }
    };
    window.addEventListener('resize', this.boundResize);
  }

  /**
   * Virtual Joystick Pointer Event Handlers
   */
  private handleJoystickPointerDown(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    this.isJoystickActive = true;
    this.updateJoystickPosition(e, target);
  }

  private handleJoystickPointerMove(e: PointerEvent) {
    if (!this.isJoystickActive) return;
    const target = e.currentTarget as HTMLElement;
    this.updateJoystickPosition(e, target);
  }

  private handleJoystickPointerUp(e: PointerEvent) {
    this.isJoystickActive = false;
    this.joystickKnobX = 0;
    this.joystickKnobY = 0;
    try {
      const target = e.currentTarget as HTMLElement;
      target.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  private updateJoystickPosition(e: PointerEvent, container: HTMLElement) {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const maxRadius = rect.width / 2 - 10;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);

    this.joystickKnobX = Math.cos(angle) * clampedDist;
    this.joystickKnobY = Math.sin(angle) * clampedDist;
  }

  /**
   * Acrobatic 360° Barrel Roll (giro en espiral)
   */
  public triggerStuntRoll() {
    if (!this.characterRenderer) return;
    this.characterRenderer.triggerBarrelRoll();
    sound.playStuntSpin();
    this.currentScore += 50;
    this.showToast('🌀 ¡Acrobacia: Giro de Barril 360°!', '+50 XP de Maniobra Aérea');
  }

  /**
   * Supersonic Turbo Boost (Mach Dash)
   */
  public triggerTurboBoost() {
    this.isTurboActive = true;
    sound.playTurboBoost();
    if (this.characterRenderer) {
      this.characterRenderer.triggerShockwave('#38bdf8', 180);
    }
    this.currentSpeedKmh = Math.min(280, this.currentSpeedKmh + 55);
    this.showToast('⚡ ¡Turbo Supersónico Mach!', 'Velocidad máxima aumentada a 280 KM/H');
  }

  /**
   * Toggle 3D Collision Physics ON/OFF
   */
  public toggleCollisions() {
    this.collisionsEnabled = !this.collisionsEnabled;
    this.proximityWarning = '';
    this.showToast(
      this.collisionsEnabled ? '🛡️ Colisiones: ACTIVADAS' : '🕊️ Modo Vuelo Libre (Sin Colisiones)',
      this.collisionsEnabled
        ? 'Ten cuidado al volar cerca de edificios y suelo'
        : 'Atraviesa estructuras libremente para explorar',
    );
  }

  /**
   * Screen Shake effect on impact
   */
  public triggerScreenShake() {
    this.isScreenShaking = true;
    setTimeout(() => {
      this.isScreenShaking = false;
    }, 420);
  }

  /**
   * Sets Camera Mode: 1ª Persona (Nivel calle) vs 3ª Persona (Héroe volando)
   */
  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    if (mode === 'first_person') {
      this.playerTilt = 82;
      this.playerRange = 8;
      this.showToast('👁️ 1ª Persona', 'Vista subjetiva a nivel de calle');
    } else {
      this.applyZoomPreset(this.zoomPreset);
      this.showToast('🦸 3ª Persona', 'Héroe volando con capa');
    }
    this.updateMapCamera();
  }

  public toggleCameraMode() {
    this.setCameraMode(this.cameraMode === 'first_person' ? 'third_person' : 'first_person');
  }

  /**
   * Sets Zoom Level: Cerca (14m) | Medio (40m) | Cielo (220m)
   */
  public setZoomPreset(preset: ZoomPreset) {
    this.zoomPreset = preset;
    if (this.cameraMode === 'first_person') {
      this.cameraMode = 'third_person';
    }
    this.applyZoomPreset(preset);
    this.updateMapCamera();
  }

  private applyZoomPreset(preset: ZoomPreset) {
    if (preset === 'close') {
      this.playerRange = 14;
      this.playerTilt = 68;
      this.showToast('🔍 Zoom Cerca', 'Detalles y brazos en primer plano');
    } else if (preset === 'medium') {
      this.playerRange = 40;
      this.playerTilt = 65;
      this.showToast('🌐 Zoom Medio', 'Vuelo a velocidad crucero');
    } else if (preset === 'sky') {
      this.playerRange = 320; // Sky View alejado 100 metros a escala (de 220m a 320m)
      this.playerTilt = 55;
      this.showToast('🛰️ Vista del Cielo', 'Perspectiva aérea alejada a 320m a escala');
    }
  }

  public zoomIn() {
    this.zoomCamera(-16);
  }

  public zoomOut() {
    this.zoomCamera(16);
  }

  public zoomCamera(deltaMeters: number) {
    this.playerRange = Math.max(10, Math.min(380, this.playerRange + deltaMeters));
    if (this.playerRange <= 22) {
      this.zoomPreset = 'close';
    } else if (this.playerRange >= 150) {
      this.zoomPreset = 'sky';
    } else {
      this.zoomPreset = 'medium';
    }
    this.updateMapCamera();
  }

  /**
   * Altitude Surge / Boost (Subir al cielo rápidamente)
   */
  public triggerJump() {
    if (this.characterRenderer) {
      this.characterRenderer.triggerJump();
      sound.playTeleportWhoosh();
      this.playerAltitude = Math.min(450, this.playerAltitude + 25);
      this.showToast('🚀 Impulso de Altitud!', `Ascendiendo a ${Math.round(this.playerAltitude)}m`);
    }
  }

  /**
   * Launch autonomously into Outer Space to reveal the entire 3D Earth (Google Earth Mode)
   */
  public launchToSpace() {
    if (this.isAscendingToSpace) return;
    this.isAscendingToSpace = true;
    this.showWorldMapModal = false;
    this.showEarthExplorerDrawer = false;
    this.selectedOrbitalTarget = null;
    sound.playTeleportWhoosh();

    // Trigger visual rocket boost & sonic shockwave
    if (this.characterRenderer) {
      this.characterRenderer.triggerShockwave('#38bdf8', 280);
    }

    this.showToast('🚀 ¡Ascendiendo al Espacio Exterior!', 'Subiendo a la órbita terrestre... ¡Contempla toda la Tierra en 3D!');

    // Smoothly fly camera to 12,500 km deep space (Google Earth planetary view)
    if (this.map) {
      this.map.flyCameraTo({
        endCamera: {
          center: {lat: this.playerLat, lng: this.playerLng, altitude: 0},
          heading: this.playerHeading,
          tilt: 0, // Direct planetary sphere view
          range: 12500000, // 12,500 km — full planet Earth globe
        },
        durationMillis: 2800,
      });
    }

    setTimeout(() => {
      this.isOrbitalView = true;
      this.isAscendingToSpace = false;
      this.requestUpdate();
    }, 2400);
  }

  /**
   * Open World Globe View (Lifting into Orbit to choose any city)
   */
  public openWorldGlobeView() {
    this.launchToSpace();
  }

  /**
   * Handle Click on the 3D Earth Globe
   */
  public async handleGlobeClick(lat: number, lng: number) {
    if (!this.isOrbitalView) return;
    sound.playCollectChime();

    // Set immediate target
    this.selectedOrbitalTarget = {
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      name: `Coordenadas: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
      country: 'Planeta Tierra',
      flag: '📍',
    };
    this.requestUpdate();

    // Look for nearby landmark in curated destinations (< 120km)
    let foundNearby = false;
    for (const d of WORLD_DESTINATIONS) {
      const dLat = (lat - d.lat) * 111139;
      const dLng = (lng - d.lng) * 111139 * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist < 120000) {
        this.selectedOrbitalTarget = {
          lat: d.lat,
          lng: d.lng,
          name: `${d.city} (${d.name})`,
          country: d.country,
          flag: d.flag,
        };
        foundNearby = true;
        break;
      }
    }

    if (!foundNearby) {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=8`,
          { headers: { 'Accept-Language': 'es,en' } },
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.address) {
            const addr = data.address;
            const city = addr.city || addr.town || addr.municipality || addr.state || addr.county || data.name || 'Región';
            const country = addr.country || 'Planeta Tierra';
            const countryCode = addr.country_code ? addr.country_code.toUpperCase() : '';
            const flag = countryCodeToFlagEmoji(countryCode);
            this.selectedOrbitalTarget = {
              lat: Number(lat.toFixed(4)),
              lng: Number(lng.toFixed(4)),
              name: `${city}, ${country}`,
              country: country,
              flag: flag,
            };
            this.requestUpdate();
          }
        }
      } catch (err) {
        // Fallback name is already displayed
      }
    }
    this.requestUpdate();
  }

  /**
   * Descend directly into specified coordinates on Earth
   */
  public descendToCoordinates(
    lat: number,
    lng: number,
    city?: string,
    country?: string,
    flag?: string,
  ) {
    const finalCity = city || this.selectedOrbitalTarget?.name || `Sector ${lat.toFixed(1)}, ${lng.toFixed(1)}`;
    const finalCountry = country || this.selectedOrbitalTarget?.country || 'Tierra';
    const finalFlag = flag || this.selectedOrbitalTarget?.flag || '🌍';

    this.selectedOrbitalTarget = null;
    this.showEarthExplorerDrawer = false;
    this.showWorldMapModal = false;
    this.isOrbitalView = false;
    this.isAscendingToSpace = false;

    this.flyFromOrbitToCity(lat, lng, finalCity, finalCountry, finalFlag, 195);
  }

  /**
   * Teleport to a random wonder / city on Earth
   */
  public teleportToRandomDestination() {
    const randomIndex = Math.floor(Math.random() * WORLD_DESTINATIONS.length);
    const dest = WORLD_DESTINATIONS[randomIndex];
    this.showToast('🎲 Destino Sorpresa Planetario', `Viajando a: ${dest.flag} ${dest.city} (${dest.country})`);

    if (this.map && this.isOrbitalView) {
      this.map.flyCameraTo({
        endCamera: {
          center: { lat: dest.lat, lng: dest.lng, altitude: 0 },
          heading: dest.heading,
          tilt: 0,
          range: 8000000,
        },
        durationMillis: 1600,
      });
      setTimeout(() => {
        this.flyFromOrbitToCity(dest.lat, dest.lng, dest.city, dest.country, dest.flag, dest.heading);
      }, 1400);
    } else {
      this.flyFromOrbitToCity(dest.lat, dest.lng, dest.city, dest.country, dest.flag, dest.heading);
    }
  }

  /**
   * Spin Earth Globe
   */
  public spinGlobe(direction: 'east' | 'west') {
    if (!this.map || !this.isOrbitalView) return;
    const delta = direction === 'east' ? 45 : -45;
    const newLng = (this.playerLng + delta + 540) % 360 - 180;
    this.playerLng = newLng;
    this.map.flyCameraTo({
      endCamera: {
        center: { lat: this.playerLat, lng: newLng, altitude: 0 },
        heading: 0,
        tilt: 0,
        range: 12500000,
      },
      durationMillis: 1200,
    });
  }

  /**
   * Reset Globe North
   */
  public resetNorth() {
    if (!this.map) return;
    this.playerHeading = 0;
    if (this.isOrbitalView) {
      this.map.flyCameraTo({
        endCamera: {
          center: { lat: this.playerLat, lng: this.playerLng, altitude: 0 },
          heading: 0,
          tilt: 0,
          range: 12500000,
        },
        durationMillis: 1000,
      });
    } else {
      this.updateMapCamera(true);
    }
  }

  /**
   * Zoom Earth Globe
   */
  public zoomGlobe(delta: number) {
    if (!this.map) return;
    if (this.isOrbitalView) {
      const currentRange = this.map.range || 12500000;
      const newRange = Math.max(1500000, Math.min(25000000, currentRange * delta));
      this.map.range = newRange;
    } else {
      if (delta < 1) this.zoomIn();
      else this.zoomOut();
    }
  }

  /**
   * Fly down from World Orbit into ANY selected city
   */
  public flyFromOrbitToCity(
    lat: number,
    lng: number,
    city: string,
    country: string,
    flag: string,
    heading: number = 195,
  ) {
    this.showWorldMapModal = false;
    this.showEarthExplorerDrawer = false;
    this.isOrbitalView = false;
    this.isAscendingToSpace = false;
    this.selectedOrbitalTarget = null;

    sound.playTeleportWhoosh();

    this.playerLat = lat;
    this.playerLng = lng;
    this.playerAltitude = 50; // Fly above street level
    this.playerHeading = heading;
    this.playerTilt = 55;
    this.playerRange = 320; // Always start in SKY VIEW alejado 100m a escala!
    this.zoomPreset = 'sky';
    this.currentCity = city;
    this.currentCountry = country;
    this.currentFlag = flag;
    this.currentStreetName = `${city}, ${country}`;
    this.currentSpeedKmh = 0;
    this.ringCombo = 0;

    // Apply dynamic characteristic weather for selected city
    const cityWeather = getWeatherForCity(city);
    this.setWeather(cityWeather, false);

    // Check & Add passport stamp
    const destId = `city-${city.toLowerCase().replace(/\s+/g, '-')}`;
    const alreadyStamped = this.passportStamps.some((s) => s.destinationId === destId);
    if (!alreadyStamped) {
      this.passportStamps = [
        ...this.passportStamps,
        {
          destinationId: destId,
          cityName: city,
          country: country,
          flag: flag,
          unlockedAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
          souvenirIcon: '🌟',
        },
      ];
      this.currentScore += 150;
    }

    // Epic Transcontinental Re-entry Flight into Sky View
    if (this.map) {
      this.map.flyCameraTo({
        endCamera: {
          center: {lat: lat, lng: lng, altitude: this.playerAltitude},
          heading: heading,
          tilt: 55,
          range: 320, // Sky View alejado 100m a escala!
        },
        durationMillis: 3400,
      });
    }

    if (this.playerMarker) {
      this.playerMarker.position = {lat: lat, lng: lng, altitude: this.playerAltitude};
    }

    this.spawnLocalCollectibles();
    this.spawnCityRingsAndObstacles(lat, lng);

    // Update Day-Night Solar simulation and Milestone Missions for new city
    this.dayNightState = this.dayNightSystem.update(lat, lng);
    this.missionSystem.initializeForCity(city, lat, lng, this.currentCityObstacles);

    const weatherMeta = WEATHER_METADATA[cityWeather];
    this.showToast(`🚀 ¡Descenso aéreo a ${city}!`, `${flag} ${city} • ${weatherMeta.icon} ${weatherMeta.name} • Cielo a 320m`);
  }

  /**
   * Search and fly to ANY city on Earth
   */
  public async searchAndTeleport(query: string) {
    if (!query || !query.trim()) return;

    this.showWorldMapModal = false;
    this.showEarthExplorerDrawer = false;
    this.selectedOrbitalTarget = null;

    const cleanQuery = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Search in local curated World Destinations & Landmarks
    const localMatch = WORLD_DESTINATIONS.find((d) => {
      const cityNorm = d.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nameNorm = d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const countryNorm = d.country.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return cityNorm.includes(cleanQuery) || nameNorm.includes(cleanQuery) || countryNorm.includes(cleanQuery) || cleanQuery.includes(cityNorm);
    });

    if (localMatch) {
      this.flyFromOrbitToCity(
        localMatch.lat,
        localMatch.lng,
        localMatch.city,
        localMatch.country,
        localMatch.flag,
        localMatch.heading,
      );
      return;
    }

    // 2. Fallback to free, reliable OpenStreetMap Nominatim geocoder (No Google Cloud billing required!)
    try {
      this.showToast('🔍 Buscando destino en la Tierra...', `Localizando "${query}" en el mapa global`);
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=1`,
        {
          headers: {
            'Accept-Language': 'es,en',
          },
        },
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          const item = data[0];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const addr = item.address || {};
          const city = addr.city || addr.town || addr.municipality || addr.state || item.name || query;
          const country = addr.country || 'Planeta Tierra';
          const countryCode = addr.country_code ? addr.country_code.toUpperCase() : '';
          const flag = countryCodeToFlagEmoji(countryCode);
          this.flyFromOrbitToCity(lat, lng, city, country, flag, 195);
          return;
        }
      }
    } catch (err) {
      console.warn('Geocoding fallback search error:', err);
    }

    this.showToast('⚠️ No Encontrado', `No se encontró "${query}". Intenta con otra ciudad.`);
  }

  /**
   * Loads the Google Maps JavaScript API with Maps3D library
   */
  async loadMap() {
    const isApiKeyPlaceholder =
      !USER_PROVIDED_GOOGLE_MAPS_API_KEY ||
      USER_PROVIDED_GOOGLE_MAPS_API_KEY === 'YOUR_ACTUAL_GOOGLE_MAPS_API_KEY_REPLACE_ME';

    if (isApiKeyPlaceholder) {
      this.mapError =
        'Google Maps API Key is required. Please configure a valid key in setup.';
      this.requestUpdate();
      return;
    }

    // Google calls this when the key is rejected (no billing, wrong referrer, API not enabled...)
    (window as any).gm_authFailure = () => {
      this.mapError =
        'Google rechazó la API Key de Maps. Revisa en Google Cloud: facturación activada, "Maps JavaScript API" y "Map Tiles API" habilitadas, y que la key permita http://localhost:3000. Ponla en .env.local como VITE_GOOGLE_MAPS_API_KEY.';
      this.requestUpdate();
    };

    const loader = new Loader({
      apiKey: USER_PROVIDED_GOOGLE_MAPS_API_KEY,
      version: 'beta',
    });

    try {
      await loader.load();
      const maps3dLibrary = await (window as any).google.maps.importLibrary('maps3d');
      this.Map3DElement = maps3dLibrary.Map3DElement;
      this.Marker3DElement = maps3dLibrary.Marker3DElement;

      this.initializeMap();
      this.spawnLocalCollectibles();
      this.spawnCityRingsAndObstacles(this.playerLat, this.playerLng);
      this.initCharacterRenderer();
      this.initWeatherSystem();
      this.startGameLoop();

      this.mapInitialized = true;
      this.mapError = '';
      this.showToast('🦸 ¡Vuelo 3D con Colisiones Activado!', 'Vuela libremente o esquiva edificios y supera los anillos aéreos');
    } catch (error) {
      console.error('Error loading Google Maps 3D API:', error);
      this.mapError = 'No se pudo inicializar Google Maps 3D. Verifica tu API Key.';
      this.mapInitialized = false;
    }
    this.requestUpdate();
  }

  private initializeMap() {
    if (!this.mapContainerElement || !this.Map3DElement) return;
    this.map = this.mapContainerElement;
    this.updateMapCamera(true);

    // Handle clicks on 3D Earth Globe for Google Earth worldwide exploration
    const onGlobeClick = (e: any) => {
      const pos = e.position || e.detail?.position;
      if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number') {
        if (this.isOrbitalView) {
          this.handleGlobeClick(pos.lat, pos.lng);
        }
      }
    };
    this.mapContainerElement.addEventListener('gmp-click', onGlobeClick);
    this.mapContainerElement.addEventListener('click', onGlobeClick);

    if (this.Marker3DElement) {
      this.playerMarker = new this.Marker3DElement({
        altitudeMode: 'RELATIVE_TO_GROUND',
      });
      this.playerMarker.position = {
        lat: this.playerLat,
        lng: this.playerLng,
        altitude: this.playerAltitude,
      };
      this.playerMarker.label = 'Superman Explorer';
      this.map.appendChild(this.playerMarker);
    }
  }

  private initCharacterRenderer() {
    if (!this.characterCanvas) return;
    this.characterRenderer = new CharacterRenderer(this.characterCanvas);
    this.characterRenderer.resize(
      this.characterCanvas.clientWidth,
      this.characterCanvas.clientHeight,
    );
    if (USE_3D_HERO && this.hero3dCanvas) {
      try {
        this.hero3d = new Hero3D(this.hero3dCanvas);
        this.hero3d.resize(this.characterCanvas.clientWidth, this.characterCanvas.clientHeight);
        this.characterRenderer.hideBody = true;
      } catch (err) {
        console.warn('3D hero unavailable, using 2D fallback', err);
        this.hero3d = undefined;
      }
    }
  }

  private initWeatherSystem() {
    if (!this.weatherCanvas) return;
    this.weatherSystem = new WeatherParticleSystem(this.weatherCanvas);
    this.weatherSystem.setCondition(this.currentWeather);
    sound.setWeatherAmbient(this.currentWeather);
  }

  /**
   * Main 60 FPS Game Loop
   */
  private startGameLoop() {
    this.lastFrameTime = performance.now();

    const loop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1);
      this.lastFrameTime = currentTime;

      this.updatePhysics(deltaTime);
      this.checkCollisionsAndRings(deltaTime);
      this.checkCollectibleCollisions();
      this.renderWeather(deltaTime);
      this.renderCharacter(deltaTime);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Updates player position, altitude, heading, velocity, and map camera
   */
  private updatePhysics(deltaTime: number) {
    if (this.isOrbitalView) return; // Freeze ground movement while in space globe view

    if (this.showIntro) {
      // Cinematic idle orbit around the hero while the intro is on screen
      this.playerHeading = (this.playerHeading + 6 * deltaTime) % 360;
      this.playerTilt = 66;
      this.playerRange = 130;
      this.currentSpeedKmh = 0;
      this.updateMapCamera();
      return;
    }

    // 1. Steering & Turn Angle (from Joystick or Keys)
    let turnInput = 0;
    if (this.isJoystickActive && Math.abs(this.joystickKnobX) > 4) {
      turnInput += this.joystickKnobX / 36;
    }
    if (this.keysPressed['a'] || this.keysPressed['arrowleft']) turnInput -= 1;
    if (this.keysPressed['d'] || this.keysPressed['arrowright']) turnInput += 1;

    const turnRate = 96;
    if (turnInput !== 0) {
      this.playerHeading = (this.playerHeading + turnInput * turnRate * deltaTime + 360) % 360;
    }

    // 2. Vertical Flight & Altitude (Climb / Dive)
    let climbInput = 0;
    if (this.isClimbing || this.keysPressed['e'] || this.keysPressed[' ']) {
      climbInput += 1;
    }
    if (this.isDiving || this.keysPressed['q']) {
      climbInput -= 1;
    }

    const verticalSpeedMps = 24.0;
    if (climbInput !== 0) {
      this.playerAltitude = Math.max(0, Math.min(500, this.playerAltitude + climbInput * verticalSpeedMps * deltaTime));
    }

    // 3. Acceleration / Gas / Brake / Reverse
    let forwardInput = 0;
    if (this.isAccelerating || this.keysPressed['w'] || this.keysPressed['arrowup']) {
      forwardInput += 1;
    }
    if (this.isBraking || this.keysPressed['s'] || this.keysPressed['arrowdown']) {
      forwardInput -= 0.8;
    }
    if (this.isJoystickActive && Math.abs(this.joystickKnobY) > 6) {
      forwardInput += (-this.joystickKnobY / 36) * 0.95;
    }

    const isShiftHeld = this.keysPressed['shift'] || this.isTurboActive;
    let targetSpeedMs = isShiftHeld ? 68.0 : 19.0;
    const currentSpeedTarget = forwardInput * targetSpeedMs;

    const accelRate = 4.2;
    const currentMs = (this.currentSpeedKmh * 1000) / 3600;
    const newSpeedMs = currentMs + (currentSpeedTarget - currentMs) * Math.min(1, accelRate * deltaTime);
    this.currentSpeedKmh = Math.max(0, (newSpeedMs * 3600) / 1000);

    // Update flight wind sound
    sound.updateFlightSound(this.currentSpeedKmh, this.currentSpeedKmh > 1);

    // Move player in world coordinates
    if (Math.abs(newSpeedMs) > 0.05) {
      const distanceStep = newSpeedMs * deltaTime; // meters
      this.totalDistanceMeters += Math.abs(distanceStep);
      this.autoCaptureDistance += Math.abs(distanceStep);

      if (this.autoCaptureDistance >= 200) {
        this.autoCaptureDistance = 0;
        this.currentScore += 25;
        this.showToast('📸 ¡Postal Aérea Registrada!', '+25 Puntos de Explorador');
      }

      const headingRad = (this.playerHeading * Math.PI) / 180;
      const dNorth = Math.cos(headingRad) * distanceStep;
      const dEast = Math.sin(headingRad) * distanceStep;

      const metersPerLatDegree = 111139;
      const metersPerLngDegree = 111139 * Math.cos((this.playerLat * Math.PI) / 180);

      this.playerLat += dNorth / metersPerLatDegree;
      this.playerLng += dEast / metersPerLngDegree;

      this.updateMapCamera();

      if (this.playerMarker) {
        this.playerMarker.position = {
          lat: this.playerLat,
          lng: this.playerLng,
          altitude: this.playerAltitude,
        };
      }

      this.scheduleReverseGeocode();
    } else {
      this.updateMapCamera();
    }

    // Update Day-Night Solar simulation & 3D building lighting
    this.dayNightState = this.dayNightSystem.update(this.playerLat, this.playerLng);

    // Update Milestone Missions (street hunt, altitude peak, combo)
    this.missionSystem.update(
      this.playerLat,
      this.playerLng,
      this.playerAltitude,
      deltaTime,
      this.ringCombo,
    );
  }

  /**
   * 3D Collision Physics against Ground and Buildings + Aerial Ring Detection
   */
  private checkCollisionsAndRings(deltaTime: number) {
    if (this.ringComboTimer > 0) {
      this.ringComboTimer -= deltaTime;
      if (this.ringComboTimer <= 0) {
        this.ringCombo = 0;
      }
    }
    if (this.collisionCooldown > 0) {
      this.collisionCooldown -= deltaTime;
    }

    // 1. Ground Collision
    if (this.playerAltitude <= 0) {
      this.playerAltitude = 0;
      if (this.currentSpeedKmh > 35 && this.collisionCooldown <= 0 && this.collisionsEnabled) {
        this.collisionCooldown = 1.0;
        sound.playImpact();
        this.characterRenderer?.triggerCollisionImpact(false);
        this.triggerScreenShake();
        this.currentSpeedKmh = Math.max(0, this.currentSpeedKmh * 0.4);
        this.currentScore = Math.max(0, this.currentScore - 10);
        this.showToast('⚠️ Aterrizaje brusco', 'Reduce la velocidad antes de tocar el suelo');
      }
    }

    // 2. Building & Obstacle Collisions (Suave, sutil y elegante)
    if (this.collisionsEnabled && !this.isOrbitalView) {
      let nearestWarning = '';
      for (const obs of this.currentCityObstacles) {
        const dLat = (this.playerLat - obs.lat) * 111139;
        const dLng = (this.playerLng - obs.lng) * 111139 * Math.cos((this.playerLat * Math.PI) / 180);
        const dist2D = Math.sqrt(dLat * dLat + dLng * dLng);

        // Check if player altitude is within obstacle height
        if (this.playerAltitude <= obs.heightMeters) {
          if (dist2D <= obs.radiusMeters + 3) {
            // Impacto sutil sin sacudida brusca
            if (this.collisionCooldown <= 0) {
              this.collisionCooldown = 1.0;
              sound.playImpact();
              this.characterRenderer?.triggerCollisionImpact(true);
              this.triggerScreenShake();

              // Suave desviación sin empujar violentamente al jugador
              const angle = Math.atan2(dLat, dLng);
              const pushMeters = 2.5;
              this.playerLat += (Math.sin(angle) * pushMeters) / 111139;
              this.playerLng += (Math.cos(angle) * pushMeters) / (111139 * Math.cos((this.playerLat * Math.PI) / 180));
              this.currentSpeedKmh = Math.max(0, this.currentSpeedKmh * 0.45);
              this.currentScore = Math.max(0, this.currentScore - 10);
              this.showToast(
                `⚠️ Contacto con ${obs.name}`,
                `${Math.round(this.playerAltitude)}m de altitud`,
              );
            }
          } else if (dist2D <= obs.radiusMeters + 20) {
            nearestWarning = `${obs.name} (${Math.round(dist2D)}m)`;
          }
        }
      }
      this.proximityWarning = nearestWarning;
    } else {
      this.proximityWarning = '';
    }

    // 3. Aerial Ring Circuit Fly-Through
    for (const ring of this.aerialRings) {
      if (ring.passed) continue;
      const dLat = (this.playerLat - ring.lat) * 111139;
      const dLng = (this.playerLng - ring.lng) * 111139 * Math.cos((this.playerLat * Math.PI) / 180);
      const dist2D = Math.sqrt(dLat * dLat + dLng * dLng);
      const dAlt = Math.abs(this.playerAltitude - ring.altitudeMeters);
      const dist3D = Math.sqrt(dist2D * dist2D + dAlt * dAlt);

      if (dist3D <= ring.radiusMeters + 7) {
        ring.passed = true;
        this.ringsPassedCount++;
        this.ringCombo++;
        this.ringComboTimer = 8.0;
        sound.playRingPassed(this.ringCombo);
        this.characterRenderer?.triggerShockwave(ring.color, 160);

        // Instant speed boost surge!
        this.currentSpeedKmh = Math.min(270, this.currentSpeedKmh + 32);
        const earned = ring.points * this.ringCombo;
        this.currentScore += earned;
        this.showToast(
          `⭕ ¡Anillo #${ring.sequenceIndex} Superado!`,
          `+${earned} XP (Combo x${this.ringCombo}) • ¡Impulso Supersónico!`,
        );

        // Update 3D marker label
        const markerObj = this.ringMarkers.find((m) => m.__id === ring.id);
        if (markerObj && markerObj.element) {
          markerObj.element.label = `✅ #${ring.sequenceIndex}`;
        }
        this.requestUpdate();
      }
    }
  }

  private updateMapCamera(forceFullUpdate: boolean = false) {
    if (!this.map || this.isOrbitalView) return;

    const alt = Math.round(Number.isFinite(this.playerAltitude) ? this.playerAltitude : 45);
    this.map.center = {
      lat: this.playerLat,
      lng: this.playerLng,
      altitude: alt,
    };
    this.map.heading = this.playerHeading;
    this.map.tilt = this.playerTilt;
    this.map.range = this.playerRange;

    if (this.playerMarker) {
      this.playerMarker.position = {
        lat: this.playerLat,
        lng: this.playerLng,
        altitude: alt,
      };
    }
  }

  private renderCharacter(deltaTime: number) {
    if (this.isOrbitalView) this.hero3d?.setVisible(false);
    if (!this.characterRenderer || this.isOrbitalView) return;

    let turnInput = 0;
    if (this.isJoystickActive && Math.abs(this.joystickKnobX) > 3) {
      turnInput = Math.max(-1, Math.min(1, this.joystickKnobX / 30));
    } else {
      if (this.keysPressed['a'] || this.keysPressed['arrowleft']) turnInput -= 1;
      if (this.keysPressed['d'] || this.keysPressed['arrowright']) turnInput += 1;
    }

    const isMoving = this.currentSpeedKmh > 0.8;
    const verticalIntent = this.isClimbing || this.keysPressed['e'] || this.keysPressed[' '] ? 1 : (this.isDiving || this.keysPressed['q'] ? -1 : 0);

    this.characterRenderer.render(
      this.avatarMode,
      isMoving,
      this.currentSpeedKmh,
      turnInput,
      this.playerRange,
      this.cameraMode,
      deltaTime,
      verticalIntent,
      this.playerAltitude,
      this.playerTilt,
      this.currentWeather,
    );
    this.hero3d?.render(this.characterRenderer.pose);
  }

  /**
   * Renders dynamic atmospheric weather particles and visibility attenuation
   */
  private renderWeather(deltaTime: number) {
    if (!this.weatherSystem || this.isOrbitalView) return;

    let turnInput = 0;
    if (this.isJoystickActive && Math.abs(this.joystickKnobX) > 3) {
      turnInput = Math.max(-1, Math.min(1, this.joystickKnobX / 30));
    } else {
      if (this.keysPressed['a'] || this.keysPressed['arrowleft']) turnInput -= 1;
      if (this.keysPressed['d'] || this.keysPressed['arrowright']) turnInput += 1;
    }

    this.weatherSystem.updateAndRender(
      deltaTime,
      this.currentSpeedKmh,
      turnInput,
      this.playerRange,
    );
  }

  /**
   * Sets weather condition ('rain' | 'snow' | 'fog' | 'clear')
   */
  public setWeather(condition: WeatherCondition, userInitiated = true) {
    this.currentWeather = condition;
    if (this.weatherSystem) {
      this.weatherSystem.setCondition(condition);
    }
    sound.setWeatherAmbient(condition);
    if (userInitiated) {
      const meta = WEATHER_METADATA[condition];
      this.showToast(`${meta.icon} Clima: ${meta.name}`, meta.description);
    }
    this.requestUpdate();
  }

  private checkCollectibleCollisions() {
    const collectThresholdMeters = 30;

    this.collectibles.forEach((c) => {
      if (c.collected) return;

      const dLat = (this.playerLat - c.lat) * 111139;
      const dLng = (this.playerLng - c.lng) * 111139 * Math.cos((this.playerLat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      if (dist <= collectThresholdMeters) {
        c.collected = true;
        this.currentScore += c.points;
        sound.playCollectChime();
        this.showToast(`✨ ${c.title} Recolectado!`, `+${c.points} Puntos`);

        const markerObj = this.collectibleMarkers.find((m) => m.__id === c.id);
        if (markerObj && markerObj.element) {
          markerObj.element.remove();
        }
        this.requestUpdate();
      }
    });
  }

  private spawnLocalCollectibles() {
    this.collectibleMarkers.forEach((m) => m.element?.remove());
    this.collectibleMarkers = [];

    const count = 7;
    const radiusMeters = 350;
    const newCollectibles: CollectibleSphere[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i * (Math.PI * 2)) / count + Math.random() * 0.4;
      const dist = 80 + Math.random() * radiusMeters;

      const dLat = (Math.cos(angle) * dist) / 111139;
      const dLng = (Math.sin(angle) * dist) / (111139 * Math.cos((this.playerLat * Math.PI) / 180));

      const sphere: CollectibleSphere = {
        id: `sphere-${Date.now()}-${i}`,
        lat: this.playerLat + dLat,
        lng: this.playerLng + dLng,
        title: `Esfera Turística #${i + 1}`,
        collected: false,
        points: 100,
      };

      newCollectibles.push(sphere);

      if (this.Marker3DElement && this.map) {
        const marker = new this.Marker3DElement({
          altitudeMode: 'CLAMP_TO_GROUND',
        });
        marker.position = {lat: sphere.lat, lng: sphere.lng, altitude: 0};
        marker.label = '⭐ Orb';
        this.map.appendChild(marker);
        this.collectibleMarkers.push({__id: sphere.id, element: marker});
      }
    }

    this.collectibles = newCollectibles;
  }

  /**
   * Spawns 3D Aerial Rings & City Building Obstacles
   */
  private spawnCityRingsAndObstacles(cityLat: number, cityLng: number) {
    // 1. Clear old ring markers
    this.ringMarkers.forEach((m) => m.element?.remove());
    this.ringMarkers = [];
    this.ringsPassedCount = 0;
    this.ringCombo = 0;

    // 2. Setup city obstacle list: famous landmarks + procedural city buildings
    const localObstacles: BuildingObstacle[] = [];
    WORLD_LANDMARK_OBSTACLES.forEach((obs) => {
      const dLat = (cityLat - obs.lat) * 111139;
      const dLng = (cityLng - obs.lng) * 111139 * Math.cos((cityLat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist < 25000) {
        localObstacles.push(obs);
      }
    });

    // Add procedurally generated urban building obstacles around the city center
    const buildingHeights = [45, 65, 85, 110, 55, 75, 95, 130];
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12 + 0.25;
      const dist = 90 + (i % 3) * 70;
      const bLat = cityLat + (Math.cos(angle) * dist) / 111139;
      const bLng = cityLng + (Math.sin(angle) * dist) / (111139 * Math.cos((cityLat * Math.PI) / 180));
      localObstacles.push({
        id: `urban-bldg-${i}`,
        name: `Edificio Urbano #${i + 1}`,
        lat: bLat,
        lng: bLng,
        radiusMeters: 22,
        heightMeters: buildingHeights[i % buildingHeights.length],
        type: 'skyscraper',
      });
    }
    this.currentCityObstacles = localObstacles;

    // 3. Generate 3D Aerial Flight Rings
    const newRings: AerialRing[] = [];
    const ringCount = 8;
    const ringColors = ['#f59e0b', '#38bdf8', '#10b981', '#a855f7', '#ec4899', '#f97316', '#06b6d4', '#eab308'];
    const ringAltitudes = [25, 45, 65, 85, 35, 55, 75, 40];

    for (let i = 0; i < ringCount; i++) {
      const angle = (i * Math.PI * 2) / ringCount + 0.1;
      const dist = 110 + (i % 4) * 55;
      const rLat = cityLat + (Math.cos(angle) * dist) / 111139;
      const rLng = cityLng + (Math.sin(angle) * dist) / (111139 * Math.cos((cityLat * Math.PI) / 180));
      const alt = ringAltitudes[i % ringAltitudes.length];

      const ring: AerialRing = {
        id: `ring-${Date.now()}-${i}`,
        lat: rLat,
        lng: rLng,
        altitudeMeters: alt,
        radiusMeters: 14,
        passed: false,
        color: ringColors[i % ringColors.length],
        points: 150,
        sequenceIndex: i + 1,
      };

      newRings.push(ring);

      if (this.Marker3DElement && this.map) {
        const marker = new this.Marker3DElement({
          altitudeMode: 'RELATIVE_TO_GROUND',
        });
        marker.position = {lat: ring.lat, lng: ring.lng, altitude: ring.altitudeMeters};
        marker.label = `⭕ #${ring.sequenceIndex} (${ring.altitudeMeters}m)`;
        this.map.appendChild(marker);
        this.ringMarkers.push({__id: ring.id, element: marker});
      }
    }

    this.aerialRings = newRings;
  }

  private scheduleReverseGeocode() {
    if (this.geocodeThrottleTimer) return;

    this.geocodeThrottleTimer = setTimeout(() => {
      this.geocodeThrottleTimer = null;

      // Find nearest landmark or display city sector without making billing-restricted API calls
      let nearestName = '';
      let minDistMeters = 3500;

      for (const lm of WORLD_LANDMARK_OBSTACLES) {
        const dLat = (this.playerLat - lm.lat) * 111139;
        const dLng = (this.playerLng - lm.lng) * 111139 * Math.cos((this.playerLat * Math.PI) / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < minDistMeters) {
          minDistMeters = dist;
          nearestName = `${lm.name} (${Math.round(dist)}m)`;
        }
      }

      if (nearestName) {
        this.currentStreetName = nearestName;
      } else {
        this.currentStreetName = `${this.currentCity} • Sector ${Math.abs(Math.round(this.playerLat * 100) % 100)}-${Math.abs(Math.round(this.playerLng * 100) % 100)}`;
      }
    }, 2500);
  }

  public snapStreetViewPhoto() {
    sound.playCameraShutter();
    this.photoFlashActive = true;
    setTimeout(() => {
      this.photoFlashActive = false;
    }, 250);

    const compassDirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const dirIdx = Math.round(this.playerHeading / 45) % 8;
    const compass = compassDirs[dirIdx];

    const newPhoto: CapturedPhoto = {
      id: `photo-${Date.now()}`,
      locationName: this.currentStreetName || `${this.currentCity}`,
      lat: Number(this.playerLat.toFixed(5)),
      lng: Number(this.playerLng.toFixed(5)),
      heading: Math.round(this.playerHeading),
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
      speedKmh: Math.round(this.currentSpeedKmh),
    };

    this.capturedPhotos = [newPhoto, ...this.capturedPhotos];
    this.currentScore += 50;

    // Check Milestone Mission: Fotografiar 3 edificios icónicos
    const photoMissionResult = this.missionSystem.onPhotoSnapped(this.playerLat, this.playerLng);
    if (photoMissionResult.newlyPhotographedName) {
      this.showToast(
        '🏛️ ¡Edificio Icónico Fotografiado!',
        `${photoMissionResult.newlyPhotographedName} (${photoMissionResult.completedCount}/3 Hitos)`,
      );
    } else {
      this.showToast('📸 ¡Foto 360° Capturada!', `${newPhoto.locationName} (${compass} ${newPhoto.heading}°) • +50 XP`);
    }
  }

  public static readonly THEMES = [
    { id: 'midnight', label: 'Medianoche', c: '#4da3ff' },
    { id: 'ocean', label: 'Océano', c: '#5ac8fa' },
    { id: 'sage', label: 'Salvia', c: '#a8d5ba' },
    { id: 'rosegold', label: 'Oro rosa', c: '#f6b8ab' },
    { id: 'gold', label: 'Dorado', c: '#f2cc8f' },
    { id: 'orchid', label: 'Orquídea', c: '#c9a7ff' },
    { id: 'graphite', label: 'Grafito', c: '#e5e5ea' },
  ];

  public setTheme(id: string) {
    this.uiTheme = id;
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem('ee3d-theme', id); } catch {}
  }

  public startGameFromIntro() {
    if (!this.showIntro || this.introLeaving) return;
    this.introLeaving = true;
    sound.playTeleportWhoosh(); // first user gesture: also unlocks audio
    this.playerRange = this.introSavedRange;
    this.updateMapCamera();
    window.setTimeout(() => {
      this.showIntro = false;
      this.introLeaving = false;
      this.showToast('🦸 ¡A volar!', 'Joystick o WASD para moverte • Espacio para subir');
    }, 650);
  }

  public toggleAudio() {
    this.isMuted = sound.toggleMute();
    this.showToast(this.isMuted ? '🔇 Audio Silenciado' : '🔊 Audio Activado', '');
  }

  public showToast(title: string, subtext: string) {
    this.toastMessage = title;
    this.toastSubtext = subtext;
    this.requestUpdate();

    setTimeout(() => {
      if (this.toastMessage === title) {
        this.toastMessage = '';
        this.toastSubtext = '';
        this.requestUpdate();
      }
    }, 3200);
  }

  public handleMapQuery(params: MapParams) {
    if (params.location) {
      this.searchAndTeleport(params.location);
    }
  }

  public addMessage(role: string, text: string) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}-message`;
    const textSpan = document.createElement('div');
    textSpan.className = 'message-text';
    textSpan.innerText = text;
    msgDiv.appendChild(textSpan);

    const thinkingContainer = document.createElement('details');
    thinkingContainer.className = 'thinking-container hidden';
    const summary = document.createElement('summary');
    summary.innerText = 'Thought process';
    const thinkingText = document.createElement('div');
    thinkingText.className = 'thinking-text';
    thinkingContainer.appendChild(summary);
    thinkingContainer.appendChild(thinkingText);
    msgDiv.appendChild(thinkingContainer);

    this.messages = [...this.messages, msgDiv];
    this.requestUpdate();

    return {thinkingElement: thinkingText, textElement: textSpan, thinkingContainer};
  }

  public setChatState(state: ChatState) {
    this.chatState = state;
  }

  public scrollToTheEnd() {
    const anchor = this.querySelector('#chatAnchor');
    anchor?.scrollIntoView({behavior: 'smooth'});
  }

  public getFilteredVuelaSuggestions(): LandmarkLocation[] {
    const q = (this.vuelaSearchQuery || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!q) return [];
    return WORLD_DESTINATIONS.filter((d) => {
      const city = d.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const name = d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const country = d.country.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return city.includes(q) || name.includes(q) || country.includes(q);
    }).slice(0, 6);
  }

  public selectVuelaDestination(dest: LandmarkLocation) {
    this.vuelaSearchQuery = '';
    this.showVuelaDropdown = false;
    this.flyFromOrbitToCity(
      dest.lat,
      dest.lng,
      dest.city,
      dest.country,
      dest.flag,
      dest.heading,
    );
  }

  public async executeVuelaSearch() {
    const query = this.vuelaSearchQuery.trim();
    if (!query) return;

    this.showVuelaDropdown = false;
    this.showToast('🔍 Localizando destino...', `Buscando "${query}" en el mapa mundial...`);

    // 1. Check curated list
    const qNorm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matched = WORLD_DESTINATIONS.find((d) => {
      const city = d.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const name = d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const country = d.country.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return city.includes(qNorm) || name.includes(qNorm) || country.includes(qNorm);
    });

    if (matched) {
      this.selectVuelaDestination(matched);
      return;
    }

    // 2. Fallback to OpenStreetMap Nominatim for any place on Earth
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'es,en' } },
      );
      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          const item = results[0];
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const parts = (item.display_name || query).split(',');
          const cityName = parts[0]?.trim() || query;
          const countryName = parts[parts.length - 1]?.trim() || 'Mundo';

          this.flyFromOrbitToCity(
            lat,
            lon,
            cityName,
            countryName,
            '🌍',
            195,
          );
          this.vuelaSearchQuery = '';
          return;
        }
      }
      this.showToast('⚠️ Destino no encontrado', `No se pudo geolocalizar "${query}". Intenta con otra ciudad o maravilla.`);
    } catch (e) {
      this.showToast('⚠️ Error de conexión', 'No se pudo contactar el geocodificador satelital.');
    }
  }

  public toggleAutoLocalTime() {
    const isAuto = !this.dayNightSystem.getIsAuto();
    this.dayNightSystem.setAutoLocalTime(isAuto);
    this.dayNightState = this.dayNightSystem.update(this.playerLat, this.playerLng);
    this.showToast(
      isAuto ? '⏰ Hora Local Automática Activada' : '⏸️ Time Shift Manual Activado',
      isAuto
        ? `Hora real de ${this.currentCity}: ${this.dayNightState.timeString}`
        : 'Usa el deslizador o presets para ajustar la iluminación',
    );
    this.requestUpdate();
  }

  public setTimePreset(hour: number) {
    this.dayNightSystem.setManualHour(hour);
    this.dayNightState = this.dayNightSystem.update(this.playerLat, this.playerLng);
    this.showToast(
      `🌅 Time Shift: ${this.dayNightState.periodLabel}`,
      `Hora solar ajustada a las ${this.dayNightState.timeString}`,
    );
    this.requestUpdate();
  }

  public handleManualTimeSlider(hour: number) {
    this.dayNightSystem.setManualHour(hour);
    this.dayNightState = this.dayNightSystem.update(this.playerLat, this.playerLng);
    this.requestUpdate();
  }

  private getFilteredOrbitalSuggestions(): LandmarkLocation[] {
    const q = (this.orbitalSearchQuery || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!q) return [];
    return WORLD_DESTINATIONS.filter((d) => {
      const city = d.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const name = d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const country = d.country.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return city.includes(q) || name.includes(q) || country.includes(q);
    }).slice(0, 6);
  }

  render() {
    const formattedDistance =
      this.totalDistanceMeters >= 1000
        ? `${(this.totalDistanceMeters / 1000).toFixed(2)} km`
        : `${Math.round(this.totalDistanceMeters)} m`;

    const worldRegions = ['Todos', 'América del Sur', 'Europa', 'Norteamérica', 'Asia', 'Oceanía', 'África'];
    const filteredDestinations =
      this.selectedRegion === 'Todos'
        ? WORLD_DESTINATIONS
        : WORLD_DESTINATIONS.filter((d) => d.region === this.selectedRegion);

    return html`
      <div class="game-container ${this.isScreenShaking ? 'shake-impact' : ''} ${this.showIntro ? 'intro-active' : ''} ${this.introLeaving ? 'intro-leaving' : ''}">
        <!-- Google Photorealistic 3D Map (Crisp Hybrid Mode with 3D Altitude) -->
        <gmp-map-3d
          id="mapContainer"
          class="map-viewport"
          mode="hybrid"
          center="${this.playerLat},${this.playerLng},${this.playerAltitude}"
          heading="${this.playerHeading}"
          tilt="${this.playerTilt}"
          range="${this.playerRange}"
          internal-usage-attribution-ids="gmp_mcp_codeassist_v1_aistudio"
          default-ui-disabled="true"
          role="application">
        </gmp-map-3d>

        <!-- Dynamic Day-Night Solar Lighting & 3D Building Illumination Overlay -->
        <div
          class="day-night-lighting-overlay ${this.dayNightState?.period || 'day'}"
          style="
            background: ${this.dayNightState?.overlayCss || 'transparent'};
            mix-blend-mode: ${this.dayNightState?.overlayBlendMode || 'normal'};
          "></div>

        <!-- Dynamic Weather & Atmospheric Particle Canvas -->
        <canvas id="weatherCanvas" class="weather-overlay-canvas"></canvas>

        <!-- 3D Animated Character Canvas -->
        <canvas id="hero3dCanvas" class="character-overlay-canvas hero3d-canvas"></canvas>
        <canvas id="characterCanvas" class="character-overlay-canvas"></canvas>

        <!-- Camera Flash Overlay -->
        <div class="camera-flash-overlay ${this.photoFlashActive ? 'active' : ''}"></div>

        <!-- PROXIMITY ALERT BANNER (Aviso de colisión sutil y compacto) -->
        ${this.proximityWarning
          ? html`
              <div class="proximity-warning-banner">
                <span>⚠️</span>
                <span>${this.proximityWarning}</span>
              </div>
            `
          : ''}

        <!-- ========================================================
             TOP HUD BAR (Minimalista & Limpio en Ciudad y Espacio)
             ======================================================== -->
        <header class="game-top-bar">
          <!-- Left: Minimalist Status Pill -->
          <div class="top-left-status-group">
            ${this.isOrbitalView
              ? html`
                  <div class="compact-status-pill">
                    <span class="flag-icon">🌍</span>
                    <div class="status-info">
                      <span class="street-name">GOOGLE EARTH 3D</span>
                      <span class="speed-and-coords">🛰️ <b>12,500 km</b> • Órbita Espacial</span>
                    </div>
                  </div>
                `
              : html`
                  <div class="compact-status-pill">
                    <span class="flag-icon">${this.currentFlag}</span>
                    <div class="status-info">
                      <span class="street-name">${this.currentCity}</span>
                      <span class="speed-and-coords">
                        <b>${Math.round(this.currentSpeedKmh)} KM/H</b> • ⛰️ <b>${Math.round(this.playerAltitude)}M</b> • 🗺️ <b>${formattedDistance}</b>
                      </span>
                    </div>
                  </div>

                  <!-- Subtle compact chip for timed hunt ONLY while timer is actively running -->
                  ${(() => {
                    const timedMission = this.missionSystem.currentMissions.find(
                      (m) => m.type === 'timed_street_hunt' && m.timerActive && !m.completed,
                    );
                    if (!timedMission) return '';
                    return html`
                      <div
                        class="compact-hunt-radar-pill"
                        @click=${() => {
                          this.showSideDrawer = true;
                          this.activeDrawerTab = 'misiones';
                        }}
                        title="Ver detalles de la misión en el panel lateral">
                        <span class="radar-ping-dot"></span>
                        <span>⏱️ ${Math.ceil(timedMission.timeRemainingSeconds || 0)}s</span>
                        <span class="radar-cue-text">• 📡 ${timedMission.radarDistanceMeters}m al ${timedMission.radarDirection}</span>
                      </div>
                    `;
                  })()}
                `}
          </div>

          <!-- Right: Centralized Drawer Menu Button -->
          <div class="top-right-group">
            <button
              class="side-drawer-toggle-btn ${this.showSideDrawer ? 'active' : ''}"
              @click=${() => (this.showSideDrawer = !this.showSideDrawer)}
              title="Abrir Menú de Exploración, Buscador, Misiones y Opciones (Tecla M)">
              <span class="toggle-icon">${this.showSideDrawer ? '✕' : '☰'}</span>
              <span class="toggle-text">Menú & Explorar</span>
              ${this.missionSystem.getCompletedCount() < this.missionSystem.currentMissions.length
                ? html`
                    <span class="toggle-badge">
                      ${this.missionSystem.getCompletedCount()}/${this.missionSystem.currentMissions.length}
                    </span>
                  `
                : ''}
            </button>
          </div>
        </header>

        <!-- Backdrop for Side Drawer -->
        <div
          class="side-drawer-backdrop ${this.showSideDrawer ? 'open' : ''}"
          @click=${() => (this.showSideDrawer = false)}>
        </div>

        <!-- ========================================================
             SLIDE-OUT RIGHT DRAWER (Centraliza toda la info y buscadores)
             ======================================================== -->
        <aside class="side-drawer ${this.showSideDrawer ? 'open' : ''}">
          <!-- Drawer Header -->
          <div class="side-drawer-header">
            <div class="side-drawer-title-wrap">
              <span class="side-drawer-city-flag">${this.currentFlag}</span>
              <div class="side-drawer-title-texts">
                <h2>${this.currentCity}</h2>
                <p>${this.currentCountry} • 🗺️ ${formattedDistance} • ⛰️ ${Math.round(this.playerAltitude)}m</p>
              </div>
            </div>
            <button class="close-btn" @click=${() => (this.showSideDrawer = false)} title="Cerrar Menú (Esc)">✕</button>
          </div>

          <!-- Quick Navigation Tabs inside Drawer -->
          <div class="side-drawer-nav-tabs">
            <button
              class="drawer-tab-btn ${this.activeDrawerTab === 'vuela' ? 'active' : ''}"
              @click=${() => (this.activeDrawerTab = 'vuela')}>
              ✈️ Vuela
            </button>
            <button
              class="drawer-tab-btn ${this.activeDrawerTab === 'misiones' ? 'active' : ''}"
              @click=${() => (this.activeDrawerTab = 'misiones')}>
              🎯 Misiones (${this.missionSystem.getCompletedCount()}/${this.missionSystem.currentMissions.length})
            </button>
            <button
              class="drawer-tab-btn ${this.activeDrawerTab === 'tiempo' ? 'active' : ''}"
              @click=${() => (this.activeDrawerTab = 'tiempo')}>
              ⏰ Día/Noche
            </button>
            <button
              class="drawer-tab-btn ${this.activeDrawerTab === 'clima' ? 'active' : ''}"
              @click=${() => (this.activeDrawerTab = 'clima')}>
              🌦️ Clima
            </button>
            <button
              class="drawer-tab-btn ${this.activeDrawerTab === 'pasaporte' ? 'active' : ''}"
              @click=${() => (this.activeDrawerTab = 'pasaporte')}>
              🛂 Pasaporte (${this.passportStamps.length})
            </button>
            <button
              class="drawer-tab-btn ${this.activeDrawerTab === 'ajustes' ? 'active' : ''}"
              @click=${() => (this.activeDrawerTab = 'ajustes')}>
              ⚙️ Ajustes
            </button>
          </div>

          <!-- Scrollable Drawer Content -->
          <div class="side-drawer-scroll">
            <!-- TAB 1: VUELA & BUSCADOR GLOBAL -->
            ${this.activeDrawerTab === 'vuela'
              ? html`
                  <div class="drawer-card-section">
                    <div class="drawer-section-header">
                      <span class="drawer-section-title">✈️ (Vuela a donde quieras)</span>
                      <span class="drawer-section-badge">Buscador</span>
                    </div>

                    <!-- Buscador Input con Autocompletado -->
                    <div class="vuela-search-pill" style="width: 100%; min-width: 0;">
                      <div class="vuela-search-box">
                        <span class="vuela-search-icon">🔍</span>
                        <input
                          type="text"
                          class="vuela-search-input"
                          placeholder="Busca cualquier ciudad, país o lugar del mundo..."
                          .value=${this.vuelaSearchQuery}
                          @input=${(e: InputEvent) => {
                            this.vuelaSearchQuery = (e.target as HTMLInputElement).value;
                            this.showVuelaDropdown = true;
                          }}
                          @focus=${() => {
                            if (this.vuelaSearchQuery.trim().length > 0) this.showVuelaDropdown = true;
                          }}
                          @keydown=${(e: KeyboardEvent) => {
                            if (e.key === 'Enter') {
                              this.executeVuelaSearch();
                              this.showSideDrawer = false;
                            }
                          }}
                        />
                        ${this.vuelaSearchQuery.length > 0
                          ? html`
                              <button class="vuela-clear-btn" @click=${() => { this.vuelaSearchQuery = ''; this.showVuelaDropdown = false; }}>✕</button>
                            `
                          : ''}
                        <button
                          class="vuela-search-submit"
                          @click=${() => {
                            this.executeVuelaSearch();
                            this.showSideDrawer = false;
                          }}
                          title="Volar a este lugar">
                          Volar 🪂
                        </button>
                      </div>

                      <!-- Sugerencias desplegables -->
                      ${this.showVuelaDropdown && this.vuelaSearchQuery.trim().length > 0
                        ? html`
                            <div class="vuela-suggestions-dropdown" style="position: relative; top: 6px;">
                              ${this.getFilteredVuelaSuggestions().map(
                                (d) => html`
                                  <div
                                    class="vuela-suggestion-item"
                                    @click=${() => {
                                      this.selectVuelaDestination(d);
                                      this.showSideDrawer = false;
                                    }}>
                                    <span class="vuela-sugg-flag">${d.flag}</span>
                                    <div class="vuela-sugg-text">
                                      <div class="vuela-sugg-city">${d.city}, ${d.country}</div>
                                      <div class="vuela-sugg-landmark">${d.name}</div>
                                    </div>
                                    <span class="vuela-sugg-fly">Volar 🪂</span>
                                  </div>
                                `,
                              )}
                              <div
                                class="vuela-suggestion-item"
                                @click=${() => {
                                  this.executeVuelaSearch();
                                  this.showSideDrawer = false;
                                }}>
                                <span class="vuela-sugg-flag">🌐</span>
                                <div class="vuela-sugg-text">
                                  <div class="vuela-sugg-city">Buscar "${this.vuelaSearchQuery}" en todo el mundo</div>
                                  <div class="vuela-sugg-landmark">Geolocalización satelital global</div>
                                </div>
                                <span class="vuela-sugg-fly">Explorar</span>
                              </div>
                            </div>
                          `
                        : ''}
                    </div>

                    <!-- Quick Space / Random Buttons -->
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      ${this.isOrbitalView
                        ? html`
                            <button
                              class="drawer-space-btn"
                              style="flex: 1;"
                              @click=${() => {
                                this.showSideDrawer = false;
                                this.descendToCoordinates(this.playerLat, this.playerLng, this.currentCity, this.currentCountry, this.currentFlag);
                              }}>
                              <span>🪂 Descender a ${this.currentCity}</span>
                            </button>
                          `
                        : html`
                            <button
                              class="drawer-space-btn"
                              style="flex: 1;"
                              @click=${() => {
                                this.showSideDrawer = false;
                                this.launchToSpace();
                              }}>
                              <span>🚀 Ascender al Espacio (Google Earth 3D)</span>
                            </button>
                          `}
                      <button
                        class="drawer-chip-item"
                        style="padding: 10px 14px; font-weight: 700;"
                        @click=${() => {
                          this.teleportToRandomDestination();
                          this.showSideDrawer = false;
                        }}
                        title="Volar a un destino aleatorio">
                        <span>🎲 Destino Sorpresa</span>
                      </button>
                    </div>

                    <!-- Region Filter Tabs -->
                    <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Filtrar por región:</div>
                    <div class="drawer-quick-chips">
                      ${worldRegions.map(
                        (region) => html`
                          <button
                            class="drawer-chip-item ${this.selectedRegion === region ? 'active' : ''}"
                            @click=${() => (this.selectedRegion = region)}>
                            ${region}
                          </button>
                        `,
                      )}
                    </div>

                    <!-- Curated World Destinations List -->
                    <div style="font-size: 11px; color: var(--muted); margin-top: 6px;">
                      Destinos disponibles (${filteredDestinations.length}):
                    </div>
                    <div class="drawer-dest-grid" style="max-height: 380px; overflow-y: auto;">
                      ${filteredDestinations.map(
                        (dest) => html`
                          <div
                            class="drawer-dest-card"
                            @click=${() => {
                              this.flyFromOrbitToCity(dest.lat, dest.lng, dest.city, dest.country, dest.flag, dest.heading || 195);
                              this.showSideDrawer = false;
                            }}>
                            <span class="drawer-card-flag">${dest.flag}</span>
                            <div class="drawer-card-texts">
                              <div class="drawer-card-city">
                                <b>${dest.city}</b>, ${dest.country}
                                <span style="font-size: 10px; margin-left: 4px; color: var(--a1);">
                                  ${WEATHER_METADATA[getWeatherForCity(dest.city)].icon}
                                </span>
                              </div>
                              <div class="drawer-card-landmark">${dest.name}</div>
                              <div style="font-size: 10px; color: var(--muted); line-height: 1.2;">${dest.description}</div>
                            </div>
                            <span class="vuela-sugg-fly">Volar</span>
                          </div>
                        `,
                      )}
                    </div>
                  </div>
                `
              : ''}

            <!-- TAB 2: MISIONES E HITOS -->
            ${this.activeDrawerTab === 'misiones'
              ? html`
                  <div class="drawer-card-section">
                    <div class="drawer-section-header">
                      <span class="drawer-section-title">🎯 Misiones en ${this.currentCity}</span>
                      <span class="drawer-section-badge">
                        ${this.missionSystem.getCompletedCount()}/${this.missionSystem.currentMissions.length} Completadas
                      </span>
                    </div>

                    <div class="missions-list" style="max-height: none; gap: 8px;">
                      ${this.missionSystem.currentMissions.map(
                        (mission) => html`
                          <div class="mission-card ${mission.completed ? 'completed' : ''}" style="padding: 10px;">
                            <div class="mission-card-icon" style="width: 38px; height: 38px; font-size: 20px;">
                              ${mission.icon}
                            </div>
                            <div class="mission-card-info">
                              <div class="mission-card-title" style="font-size: 12.5px;">
                                <span>${mission.title}</span>
                                <span class="mission-xp-tag">+${mission.xpReward} XP</span>
                              </div>
                              <div class="mission-card-desc" style="font-size: 11px;">${mission.description}</div>
                              <div class="mission-progress-bar-wrap">
                                <div
                                  class="mission-progress-bar-fill"
                                  style="width: ${Math.min(100, Math.round((mission.progress / mission.maxProgress) * 100))}%;">
                                </div>
                              </div>
                              <div class="mission-status-row">
                                ${mission.completed
                                  ? html`
                                      <span class="mission-completed-badge">✅ ¡Completado!</span>
                                    `
                                  : mission.type === 'timed_street_hunt'
                                    ? html`
                                        <span class="mission-radar-cue">
                                          ${mission.timerActive
                                            ? `⏱️ ${Math.ceil(mission.timeRemainingSeconds || 0)}s • 📡 ${mission.radarDistanceMeters}m al ${mission.radarDirection}`
                                            : '❌ Tiempo agotado'}
                                        </span>
                                        ${!mission.timerActive
                                          ? html`
                                              <button
                                                class="target-descend-btn"
                                                style="padding: 3px 8px; font-size: 10.5px;"
                                                @click=${() => this.missionSystem.restartTimedStreetHunt()}>
                                                🔄 Reintentar 1 min
                                              </button>
                                            `
                                          : ''}
                                      `
                                    : mission.type === 'photo_landmarks'
                                      ? html`
                                          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                                            <span class="mission-radar-cue">📸 ${mission.progress}/${mission.maxProgress} edificios</span>
                                            <button
                                              class="drawer-chip-item"
                                              style="padding: 2px 7px; font-size: 10.5px;"
                                              @click=${() => this.snapStreetViewPhoto()}>
                                              📸 Tomar Foto
                                            </button>
                                          </div>
                                        `
                                      : html`
                                          <span class="mission-radar-cue">Progreso: ${mission.progress}/${mission.maxProgress}</span>
                                        `}
                              </div>
                            </div>
                          </div>
                        `,
                      )}
                    </div>
                  </div>
                `
              : ''}

            <!-- TAB 3: CICLO DÍA-NOCHE & TIME SHIFT -->
            ${this.activeDrawerTab === 'tiempo'
              ? html`
                  <div class="drawer-card-section">
                    <div class="drawer-section-header">
                      <span class="drawer-section-title">⏰ Ciclo Día-Noche & Time Shift</span>
                      <span class="drawer-section-badge">${this.dayNightState?.periodLabel || 'Día'}</span>
                    </div>

                    <!-- Auto local time toggle -->
                    <div
                      class="time-shift-auto-toggle ${this.dayNightState?.isAutoLocalTime ? 'active' : ''}"
                      @click=${() => this.toggleAutoLocalTime()}>
                      <div class="auto-toggle-info">
                        <div class="auto-toggle-text">Hora Local Automática</div>
                        <div class="auto-toggle-sub">Calculada astronómicamente según las coordenadas reales de ${this.currentCity}</div>
                      </div>
                      <span class="auto-toggle-badge ${this.dayNightState?.isAutoLocalTime ? 'active' : ''}">
                        ${this.dayNightState?.isAutoLocalTime ? 'ACTIVO' : 'MANUAL'}
                      </span>
                    </div>

                    <!-- Presets Grid -->
                    <div class="time-presets-grid">
                      <button
                        class="time-preset-btn ${this.dayNightState?.period === 'sunrise' ? 'active' : ''}"
                        @click=${() => this.setTimePreset(6.5)}>
                        <span class="time-preset-icon">🌅</span>
                        <span>Amanecer</span>
                      </button>
                      <button
                        class="time-preset-btn ${this.dayNightState?.period === 'day' ? 'active' : ''}"
                        @click=${() => this.setTimePreset(12)}>
                        <span class="time-preset-icon">☀️</span>
                        <span>Mediodía</span>
                      </button>
                      <button
                        class="time-preset-btn ${this.dayNightState?.period === 'sunset' ? 'active' : ''}"
                        @click=${() => this.setTimePreset(18.5)}>
                        <span class="time-preset-icon">🌇</span>
                        <span>Atardecer</span>
                      </button>
                      <button
                        class="time-preset-btn ${this.dayNightState?.period === 'night' ? 'active' : ''}"
                        @click=${() => this.setTimePreset(23)}>
                        <span class="time-preset-icon">🌙</span>
                        <span>Noche</span>
                      </button>
                    </div>

                    <!-- 24h Slider -->
                    <div class="time-slider-wrap">
                      <div class="time-slider-label">
                        <span>Ajustar hora solar (00:00 a 23:59):</span>
                        <b>${this.dayNightState?.timeString || '12:00'}</b>
                      </div>
                      <input
                        type="range"
                        class="time-range-input"
                        min="0"
                        max="23.9"
                        step="0.25"
                        .value=${this.dayNightState?.localHour ?? 12}
                        @input=${(e: Event) => this.handleManualTimeSlider((e.target as HTMLInputElement).valueAsNumber)}
                      />
                    </div>
                  </div>
                `
              : ''}

            <!-- TAB 4: CLIMA & FÍSICAS -->
            ${this.activeDrawerTab === 'clima'
              ? html`
                  <div class="drawer-card-section">
                    <div class="drawer-section-header">
                      <span class="drawer-section-title">🌦️ Clima & Físicas de Vuelo</span>
                      <span class="drawer-section-badge">${this.currentWeather.toUpperCase()}</span>
                    </div>

                    <!-- Weather Condition Selector -->
                    <div style="font-size: 11px; color: var(--muted);">Condición meteorológica:</div>
                    <div class="weather-selector-pill" style="width: 100%; justify-content: space-around;">
                      <button
                        class="weather-option-btn ${this.currentWeather === 'clear' ? 'active' : ''}"
                        @click=${() => this.setWeather('clear')}
                        title="☀️ Despejado">
                        ☀️ Despejado
                      </button>
                      <button
                        class="weather-option-btn ${this.currentWeather === 'rain' ? 'active' : ''}"
                        @click=${() => this.setWeather('rain')}
                        title="🌧️ Lluvia">
                        🌧️ Lluvia
                      </button>
                      <button
                        class="weather-option-btn ${this.currentWeather === 'snow' ? 'active' : ''}"
                        @click=${() => this.setWeather('snow')}
                        title="❄️ Nieve">
                        ❄️ Nieve
                      </button>
                      <button
                        class="weather-option-btn ${this.currentWeather === 'fog' ? 'active' : ''}"
                        @click=${() => this.setWeather('fog')}
                        title="🌫️ Niebla">
                        🌫️ Niebla
                      </button>
                    </div>

                    <!-- Collision Mode Toggle -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                      <span style="font-size: 11.5px; color: #fff; font-weight: 600;">Colisiones con edificios:</span>
                      <button
                        class="collision-mode-toggle ${this.collisionsEnabled ? 'active' : ''}"
                        style="padding: 5px 12px;"
                        @click=${() => this.toggleCollisions()}
                        title="Alternar Colisiones (Tecla T)">
                        ${this.collisionsEnabled ? '🛡️ Activadas' : '🕊️ Vuelo Libre'}
                      </button>
                    </div>
                  </div>
                `
              : ''}

            <!-- TAB 5: PASAPORTE & ÁLBUM 360° -->
            ${this.activeDrawerTab === 'pasaporte'
              ? html`
                  <div class="drawer-card-section">
                    <div class="drawer-section-header">
                      <span class="drawer-section-title">🛂 Pasaporte de Viajero</span>
                      <span class="drawer-section-badge">${this.passportStamps.length} Ciudades</span>
                    </div>

                    <div class="passport-stats-bar" style="margin-bottom: 8px;">
                      <div>Ciudades: <b>${this.passportStamps.length}</b></div>
                      <div>Distancia: <b>${formattedDistance}</b></div>
                      <div>XP: <b>${this.currentScore} pts</b></div>
                    </div>

                    <!-- Stamps Collection -->
                    <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Sellos oficiales desbloqueados:</div>
                    <div class="passport-stamps-grid" style="max-height: 200px; overflow-y: auto;">
                      ${this.passportStamps.map(
                        (stamp) => html`
                          <div class="passport-stamp-badge" style="padding: 6px;">
                            <div class="stamp-ink-circle" style="width: 58px; height: 58px;">
                              <span class="stamp-souvenir" style="font-size: 16px;">${stamp.souvenirIcon}</span>
                              <span class="stamp-city" style="font-size: 7.5px;">${stamp.cityName.toUpperCase()}</span>
                              <span class="stamp-flag" style="font-size: 10px;">${stamp.flag}</span>
                              <span class="stamp-date" style="font-size: 6.5px;">${stamp.unlockedAt}</span>
                            </div>
                            <div class="stamp-country" style="font-size: 9px;">${stamp.country}</div>
                          </div>
                        `,
                      )}
                    </div>

                    <!-- Photo Gallery -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
                      <span style="font-size: 11.5px; font-weight: 700; color: #fff;">📸 Álbum 360° (${this.capturedPhotos.length})</span>
                      <button
                        class="drawer-chip-item"
                        style="padding: 4px 8px; font-size: 10.5px;"
                        @click=${() => this.snapStreetViewPhoto()}>
                        📸 Tomar Foto
                      </button>
                    </div>

                    ${this.capturedPhotos.length === 0
                      ? html`<div style="font-size: 11px; color: var(--muted); text-align: center; padding: 12px 0;">No has tomado fotos aún. ¡Usa la tecla C o el botón superior!</div>`
                      : html`
                          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; margin-top: 6px;">
                            ${this.capturedPhotos.map(
                              (p) => html`
                                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 6px 10px;">
                                  <div>
                                    <div style="font-size: 11px; font-weight: 700; color: #fff;">${p.locationName}</div>
                                    <div style="font-size: 9.5px; color: var(--muted);">🧭 ${p.heading}° • 🕒 ${p.timestamp} • 🚀 ${p.speedKmh} km/h</div>
                                  </div>
                                  <span style="font-size: 16px;">📷</span>
                                </div>
                              `,
                            )}
                          </div>
                        `}
                  </div>
                `
              : ''}

            <!-- TAB 6: AJUSTES & HERRAMIENTAS -->
            ${this.activeDrawerTab === 'ajustes'
              ? html`
                  <div class="drawer-card-section">
                    <div class="drawer-section-header">
                      <span class="drawer-section-title">⚙️ Ajustes & Herramientas</span>
                    </div>

                    <!-- Camera Perspective Selector -->
                    <div style="font-size: 11px; color: var(--muted);">Modo de Cámara:</div>
                    <div class="segment-group" style="width: 100%;">
                      <button
                        class="seg-btn ${this.cameraMode === 'first_person' ? 'active' : ''}"
                        style="flex: 1; padding: 8px;"
                        @click=${() => this.setCameraMode('first_person')}>
                        👁️ 1ª Persona (Cabina)
                      </button>
                      <button
                        class="seg-btn ${this.cameraMode === 'third_person' ? 'active' : ''}"
                        style="flex: 1; padding: 8px;"
                        @click=${() => this.setCameraMode('third_person')}>
                        🦸 3ª Persona (Superhéroe)
                      </button>
                    </div>

                    <!-- Theme Swatches -->
                    <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Tema visual de interfaz:</div>
                    <div class="theme-swatches" style="margin-top: 0;">
                      ${MapApp.THEMES.map(
                        (t) => html`
                          <button
                            class="theme-swatch ${this.uiTheme === t.id ? 'selected' : ''}"
                            style="--sw:${t.c}"
                            title=${t.label}
                            aria-label=${t.label}
                            @click=${() => this.setTheme(t.id)}></button>
                        `,
                      )}
                    </div>

                    <!-- Audio Toggle -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                      <span style="font-size: 11.5px; color: #fff; font-weight: 600;">Efectos de sonido:</span>
                      <button
                        class="drawer-chip-item"
                        style="padding: 6px 12px;"
                        @click=${() => this.toggleAudio()}>
                        <span>${this.isMuted ? '🔇 Desactivado' : '🔊 Activado'}</span>
                      </button>
                    </div>

                    <!-- Controles rápidos / Ayuda -->
                    <div style="font-size: 10.5px; color: var(--muted); line-height: 1.4; margin-top: 6px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px;">
                      <b>💡 Guía de manejo:</b><br />
                      • <b>W / Arriba</b>: Acelerar (Gas)<br />
                      • <b>Shift</b>: Turbo supersónico<br />
                      • <b>S / Abajo</b>: Frenar<br />
                      • <b>E / Q</b>: Subir / Bajar altitud<br />
                      • <b>R</b>: Giro acrobático 360°<br />
                      • <b>Espacio / G</b>: Ascender al espacio exterior<br />
                      • <b>Joystick táctil</b>: Gira y navega con el pulgar
                    </div>
                  </div>
                `
              : ''}
          </div>
        </aside>

        <!-- ========================================================
             BOTTOM HUD: SOLO MANEJO DEL PERSONAJE / NAVEGACIÓN
             ======================================================== -->
        ${this.isOrbitalView
          ? html`
              <!-- Floating Target Card when user clicks ANYWHERE on Earth in Orbit -->
              ${this.selectedOrbitalTarget
                ? html`
                    <div class="orbital-target-card">
                      <div class="target-card-info">
                        <span class="target-card-flag">${this.selectedOrbitalTarget.flag || '📍'}</span>
                        <div class="target-card-texts">
                          <div class="target-card-title">${this.selectedOrbitalTarget.name}</div>
                          <div class="target-card-coords">
                            ${this.selectedOrbitalTarget.lat.toFixed(4)}°, ${this.selectedOrbitalTarget.lng.toFixed(4)}°
                          </div>
                        </div>
                      </div>
                      <div class="target-card-actions">
                        <button
                          class="target-descend-btn"
                          @click=${() =>
                            this.descendToCoordinates(
                              this.selectedOrbitalTarget!.lat,
                              this.selectedOrbitalTarget!.lng,
                              this.selectedOrbitalTarget!.name,
                              this.selectedOrbitalTarget!.country,
                              this.selectedOrbitalTarget!.flag,
                            )}>
                          ⚡ Descender en Vuelo Aquí 🪂
                        </button>
                        <button class="target-close-btn" @click=${() => (this.selectedOrbitalTarget = null)}>✕</button>
                      </div>
                    </div>
                  `
                : ''}

              <!-- Space Globe Navigation Controls -->
              <div class="earth-nav-controls">
                <button class="earth-nav-btn" @click=${() => this.zoomGlobe(0.6)} title="Acercar Globo (＋)">＋</button>
                <button class="earth-nav-btn" @click=${() => this.zoomGlobe(1.5)} title="Alejar Globo (－)">－</button>
                <button class="earth-nav-btn" @click=${() => this.spinGlobe('east')} title="Girar Globo Este (🔄)">🔄</button>
                <button class="earth-nav-btn" @click=${() => this.resetNorth()} title="Alinear Norte (🧭)">🧭</button>
                <button
                  class="earth-nav-btn"
                  style="font-size: 11px; padding: 0 10px; width: auto;"
                  @click=${() => this.descendToCoordinates(this.playerLat, this.playerLng, this.currentCity, this.currentCountry, this.currentFlag)}
                  title="Descender en vuelo hacia la Tierra">
                  🪂 Descender
                </button>
              </div>
            `
          : html`
              <!-- Bottom HUD: Joystick, Camera & Flight Cluster -->
              <footer class="game-bottom-hud">
                <!-- LEFT: Virtual Steering Joystick (Ergonómico para pulgar izquierdo) -->
                <div
                  class="virtual-joystick-base"
                  @pointerdown=${(e: PointerEvent) => this.handleJoystickPointerDown(e)}
                  @pointermove=${(e: PointerEvent) => this.handleJoystickPointerMove(e)}
                  @pointerup=${(e: PointerEvent) => this.handleJoystickPointerUp(e)}
                  @pointercancel=${(e: PointerEvent) => this.handleJoystickPointerUp(e)}
                  title="Joystick 360° (Arrastra para girar y volar)">
                  <div class="joystick-ring"></div>
                  <div
                    class="joystick-knob"
                    style="transform: translate(${this.joystickKnobX}px, ${this.joystickKnobY}px);">
                    <span class="joystick-icon">🧭</span>
                  </div>
                </div>

                <!-- CENTER: Camera Mode & Zoom Dock -->
                <div class="camera-zoom-bar">
                  <div class="segment-group">
                    <button
                      class="seg-btn ${this.cameraMode === 'first_person' ? 'active' : ''}"
                      @click=${() => this.setCameraMode('first_person')}
                      title="Vista en 1ª Persona (Tecla V)">
                      👁️ 1ª
                    </button>
                    <button
                      class="seg-btn ${this.cameraMode === 'third_person' ? 'active' : ''}"
                      @click=${() => this.setCameraMode('third_person')}
                      title="Vista en 3ª Persona">
                      🦸 3ª
                    </button>
                  </div>

                  <div class="segment-group zoom-presets-group">
                    <button
                      class="seg-btn ${this.zoomPreset === 'close' ? 'active' : ''}"
                      @click=${() => this.setZoomPreset('close')}
                      title="Zoom Cerca">
                      Cerca
                    </button>
                    <button
                      class="seg-btn ${this.zoomPreset === 'medium' ? 'active' : ''}"
                      @click=${() => this.setZoomPreset('medium')}
                      title="Zoom Medio">
                      Medio
                    </button>
                    <button
                      class="seg-btn ${this.zoomPreset === 'sky' ? 'active' : ''}"
                      @click=${() => this.setZoomPreset('sky')}
                      title="Vista del Cielo">
                      Cielo
                    </button>
                  </div>

                  <div class="zoom-stepper">
                    <button class="zoom-step-btn" @click=${() => this.zoomIn()} title="Acercar">＋</button>
                    <button class="zoom-step-btn" @click=${() => this.zoomOut()} title="Alejar">－</button>
                  </div>
                </div>

                <!-- RIGHT: Flight Drive Cluster (Ergonómico para pulgar derecho) -->
                <div class="drive-buttons-cluster">
                  <div class="vertical-controls">
                    <button
                      class="btn-vert ${this.isClimbing ? 'pressing' : ''}"
                      @pointerdown=${() => {
                        this.isClimbing = true;
                      }}
                      @pointerup=${() => {
                        this.isClimbing = false;
                      }}
                      @pointerleave=${() => {
                        this.isClimbing = false;
                      }}
                      title="Ascender Altitud (E)">
                      ▲ SUBIR
                    </button>
                    <button
                      class="btn-vert btn-space-launch-vert"
                      @click=${() => this.launchToSpace()}
                      title="Subir al Espacio Exterior y ver toda la Tierra (Espacio / G)">
                      🚀 ESPACIO
                    </button>
                    <button
                      class="btn-vert ${this.isDiving ? 'pressing' : ''}"
                      @pointerdown=${() => {
                        this.isDiving = true;
                      }}
                      @pointerup=${() => {
                        this.isDiving = false;
                      }}
                      @pointerleave=${() => {
                        this.isDiving = false;
                      }}
                      title="Descender Altitud (Q)">
                      ▼ BAJAR
                    </button>
                  </div>

                  <!-- Acrobacia: Giro de Barril 360° -->
                  <button
                    class="drive-btn btn-stunt"
                    @click=${() => this.triggerStuntRoll()}
                    title="Acrobacia: Giro de Barril (Tecla R)">
                    🌀 GIRO
                  </button>

                  <!-- Turbo Supersónico -->
                  <button
                    class="drive-btn btn-turbo ${this.isTurboActive ? 'pressing' : ''}"
                    @pointerdown=${() => this.triggerTurboBoost()}
                    title="Turbo Supersónico Mach (Tecla Shift)">
                    ⚡ TURBO
                  </button>

                  <!-- Frenar -->
                  <button
                    class="drive-btn btn-brake ${this.isBraking ? 'pressing' : ''}"
                    @pointerdown=${() => {
                      this.isBraking = true;
                    }}
                    @pointerup=${() => {
                      this.isBraking = false;
                    }}
                    @pointerleave=${() => {
                      this.isBraking = false;
                    }}
                    title="Frenar (S / Flecha abajo)">
                    🛑 FRENO
                  </button>

                  <!-- Acelerar -->
                  <button
                    class="drive-btn btn-gas ${this.isAccelerating ? 'pressing' : ''}"
                    @pointerdown=${() => {
                      this.isAccelerating = true;
                    }}
                    @pointerup=${() => {
                      this.isAccelerating = false;
                    }}
                    @pointerleave=${() => {
                      this.isAccelerating = false;
                    }}
                    title="Acelerar hacia adelante (W / Flecha arriba)">
                    ⚡ ACEL
                  </button>
                </div>
              </footer>
            `}

        ${this.showThemePicker
          ? html`
              <div class="theme-popover" @pointerdown=${(e: Event) => e.stopPropagation()}>
                <div class="theme-popover-title">Color</div>
                <div class="theme-swatches">
                  ${MapApp.THEMES.map(
                    (t) => html`
                      <button
                        class="theme-swatch ${this.uiTheme === t.id ? 'selected' : ''}"
                        style="--sw:${t.c}"
                        title=${t.label}
                        aria-label=${t.label}
                        @click=${() => this.setTheme(t.id)}></button>
                    `,
                  )}
                </div>
              </div>
            `
          : ''}

        <!-- INTRO -->
        ${this.showIntro
          ? html`
              <div class="intro-screen ${this.introLeaving ? 'leaving' : ''}">
                <div class="intro-top">
                  <div class="intro-kicker">EARTH EXPLORER 3D</div>
                  <h1 class="intro-title">Super<span>Earth</span></h1>
                  <p class="intro-sub">Vuela sobre el mundo real, ciudad por ciudad.</p>
                </div>
                <div class="intro-bottom">
                  <button class="play-btn" @click=${() => this.startGameFromIntro()} aria-label="Jugar">
                    <span class="play-icon" aria-hidden="true"></span>
                    <span class="play-label">Jugar</span>
                  </button>
                  <div class="intro-hint">Enter o toca para empezar</div>
                </div>
              </div>
            `
          : ''}

        <!-- ERROR OVERLAY IF MAP FAILS -->
        ${this.mapError
          ? html`
              <div class="map-error-overlay">
                <div class="error-dialog">
                  <h3>⚠️ Inicialización de Google Maps 3D</h3>
                  <p>${this.mapError}</p>
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }
}
