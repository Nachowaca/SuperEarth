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
  @query('#characterCanvas') characterCanvas?: HTMLCanvasElement;
  @query('#hero3dCanvas') hero3dCanvas?: HTMLCanvasElement;
  @query('#worldMapSearchInput') worldMapSearchInputElement?: HTMLInputElement;

  // --- Coordinates, 3D Altitude & Camera ---
  @state() playerLat: number = -34.6037; // Buenos Aires Obelisk default
  @state() playerLng: number = -58.3816;
  @state() playerAltitude: number = 42; // Real altitude in meters above ground level
  @state() playerHeading: number = 195;
  @state() playerTilt: number = 58; // Sky View tilt
  @state() playerRange: number = 220; // Starts ALWAYS from the SKY!
  @state() currentSpeedKmh: number = 0;
  @state() totalDistanceMeters: number = 0;
  @state() currentScore: number = 0;
  @state() currentStreetName: string = 'Obelisco & Av. 9 de Julio';
  @state() currentCity: string = 'Buenos Aires';
  @state() currentCountry: string = 'Argentina';
  @state() currentFlag: string = '🇦🇷';

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
  private geocoder?: any;
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

      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (key === ' ' || e.code === 'Space') {
        this.triggerJump();
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
        this.toggleAudio();
      } else if (key === 'p') {
        this.showPassportModal = !this.showPassportModal;
      } else if (key === 'g') {
        this.openWorldGlobeView();
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
      if (this.showWorldMapModal || this.showPassportModal) {
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
      this.playerRange = 220; // Sky View standard
      this.playerTilt = 58;
      this.showToast('🛰️ Vista del Cielo', 'Perspectiva aérea de la ciudad');
    }
  }

  public zoomIn() {
    this.zoomCamera(-16);
  }

  public zoomOut() {
    this.zoomCamera(16);
  }

  public zoomCamera(deltaMeters: number) {
    this.playerRange = Math.max(10, Math.min(260, this.playerRange + deltaMeters));
    if (this.playerRange <= 22) {
      this.zoomPreset = 'close';
    } else if (this.playerRange >= 110) {
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
   * Open World Globe View (Lifting into Orbit to choose any city)
   */
  public openWorldGlobeView() {
    this.showWorldMapModal = true;
    this.isOrbitalView = true;

    if (this.map) {
      sound.playTeleportWhoosh();
      this.map.flyCameraTo({
        endCamera: {
          center: {lat: this.playerLat, lng: this.playerLng, altitude: 0},
          heading: this.playerHeading,
          tilt: 10,
          range: 9500000, // 9,500 km in space (3D Globe perspective!)
        },
        durationMillis: 2200,
      });
    }
    this.showToast('🌍 Vista del Globo Terrestre', 'Elige cualquier ciudad para volar desde el cielo');
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
    this.isOrbitalView = false;

    sound.playTeleportWhoosh();

    this.playerLat = lat;
    this.playerLng = lng;
    this.playerAltitude = 50; // Fly above street level
    this.playerHeading = heading;
    this.playerTilt = 58;
    this.playerRange = 220; // Always start in SKY VIEW!
    this.zoomPreset = 'sky';
    this.currentCity = city;
    this.currentCountry = country;
    this.currentFlag = flag;
    this.currentStreetName = `${city}, ${country}`;
    this.currentSpeedKmh = 0;
    this.ringCombo = 0;

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
          tilt: 58,
          range: 220, // Sky View!
        },
        durationMillis: 3400,
      });
    }

    if (this.playerMarker) {
      this.playerMarker.position = {lat: lat, lng: lng, altitude: this.playerAltitude};
    }

    this.spawnLocalCollectibles();
    this.spawnCityRingsAndObstacles(lat, lng);
    this.showToast(`🚀 ¡Descenso aéreo a ${city}!`, `Iniciando vuelo desde el cielo (${flag})`);
  }

  /**
   * Search and fly to ANY city on Earth
   */
  public searchAndTeleport(query: string) {
    if (!query.trim() || !this.geocoder) return;

    this.showWorldMapModal = false;
    this.isOrbitalView = false;

    this.geocoder.geocode({address: query}, (results: any, status: string) => {
      if (status === 'OK' && results && results[0]) {
        const result = results[0];
        const loc = result.geometry.location;

        let city = query;
        let country = '';
        let flag = '🌐';

        if (result.address_components) {
          for (const comp of result.address_components) {
            if (comp.types.includes('locality')) {
              city = comp.long_name;
            } else if (!city && comp.types.includes('administrative_area_level_1')) {
              city = comp.long_name;
            }
            if (comp.types.includes('country')) {
              country = comp.long_name;
              flag = countryCodeToFlagEmoji(comp.short_name);
            }
          }
        }

        this.flyFromOrbitToCity(loc.lat(), loc.lng(), city, country || 'Mundo', flag, 195);
      } else {
        this.showToast('⚠️ No Encontrado', `No se encontró "${query}". Intenta con otra ciudad.`);
      }
    });
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

    const loader = new Loader({
      apiKey: USER_PROVIDED_GOOGLE_MAPS_API_KEY,
      version: 'beta',
      libraries: ['geocoding', 'routes', 'geometry'],
    });

    try {
      await loader.load();
      const maps3dLibrary = await (window as any).google.maps.importLibrary('maps3d');
      this.Map3DElement = maps3dLibrary.Map3DElement;
      this.Marker3DElement = maps3dLibrary.Marker3DElement;

      if ((window as any).google && (window as any).google.maps) {
        this.geocoder = new (window as any).google.maps.Geocoder();
      }

      this.initializeMap();
      this.spawnLocalCollectibles();
      this.spawnCityRingsAndObstacles(this.playerLat, this.playerLng);
      this.initCharacterRenderer();
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
    );
    this.hero3d?.render(this.characterRenderer.pose);
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

      const dLat = Math.abs(this.playerLat - this.lastGeocodedLat);
      const dLng = Math.abs(this.playerLng - this.lastGeocodedLng);
      if (dLat < 0.00035 && dLng < 0.00035) return;

      this.lastGeocodedLat = this.playerLat;
      this.lastGeocodedLng = this.playerLng;

      if (this.geocoder) {
        this.geocoder.geocode(
          {location: {lat: this.playerLat, lng: this.playerLng}},
          (results: any, status: string) => {
            if (status === 'OK' && results && results[0]) {
              const formatted = results[0].formatted_address;
              this.currentStreetName = formatted.split(',').slice(0, 2).join(',');
            }
          },
        );
      }
    }, 3000);
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
    this.showToast('📸 ¡Foto 360° Capturada!', `${newPhoto.locationName} (${compass} ${newPhoto.heading}°) • +50 XP`);
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
      <div class="game-container ${this.isScreenShaking ? 'shake-impact' : ''}">
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

        <!-- TOP BAR: Sleek, Low-Profile Capsule (Placed at top: 8px) -->
        <header class="game-top-bar">
          <!-- City, Speed, Altitud & Recorrido Pill -->
          <div class="compact-status-pill">
            <span class="flag-icon">${this.currentFlag}</span>
            <div class="status-info">
              <span class="street-name">${this.currentCity}</span>
              <span class="speed-and-coords">
                <b>${Math.round(this.currentSpeedKmh)} KM/H</b> • ⛰️ <b>${Math.round(this.playerAltitude)}M</b> • 🗺️ <b>${formattedDistance}</b>
              </span>
            </div>
          </div>

          <!-- Aerial Ring Circuit & Combo Badges -->
          ${this.aerialRings.length > 0
            ? html`
                <div class="circuit-pill" title="Anillos Aéreos Superados en la Ciudad">
                  ⭕ <b>${this.ringsPassedCount}/${this.aerialRings.length}</b>
                </div>
              `
            : ''}

          ${this.ringCombo > 1
            ? html`
                <div class="combo-pill" title="Combo de Anillos Consecutivos">
                  🔥 COMBO x${this.ringCombo}
                </div>
              `
            : ''}

          <!-- Collision Mode Toggle -->
          <button
            class="collision-mode-toggle ${this.collisionsEnabled ? 'active' : ''}"
            @click=${() => this.toggleCollisions()}
            title="Alternar Colisiones con Edificios y Suelo (T)">
            ${this.collisionsEnabled ? '🛡️ Colisión ON' : '🕊️ Libre'}
          </button>

          <!-- Top Action Buttons -->
          <div class="top-actions">
            <!-- World Globe & Orbit Button -->
            <button
              class="top-icon-btn highlight-btn"
              @click=${() => this.openWorldGlobeView()}
              title="Volar desde el Mapa Mundo 3D (G)">
              🌍 Mapa Mundo
            </button>

            <!-- Passport Stamps -->
            <button
              class="top-icon-btn ${this.showPassportModal ? 'active' : ''}"
              @click=${() => (this.showPassportModal = !this.showPassportModal)}
              title="Pasaporte de Viajero (P)">
              🛂 ${this.passportStamps.length}
            </button>

            <!-- Snap Postcard -->
            <button
              class="top-icon-btn"
              @click=${() => this.snapStreetViewPhoto()}
              title="Capturar Foto 360° (C)">
              📸
            </button>

            <!-- UI Theme -->
            <button
              class="top-icon-btn theme-btn"
              @click=${() => (this.showThemePicker = !this.showThemePicker)}
              title="Color de la interfaz">
              <span class="theme-dot"></span>
            </button>

            <!-- Audio Mute -->
            <button
              class="top-icon-btn"
              @click=${() => this.toggleAudio()}
              title="Sonido (M)">
              ${this.isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </header>

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

        <!-- TOAST NOTIFICATION -->
        ${this.toastMessage
          ? html`
              <div class="game-toast-container">
                <div class="game-toast">
                  <div class="toast-title">${this.toastMessage}</div>
                  ${this.toastSubtext
                    ? html`<div class="toast-subtext">${this.toastSubtext}</div>`
                    : ''}
                </div>
              </div>
            `
          : ''}

        <!-- BOTTOM HUD: Low, sleek, ergonomic and fully interactive -->
        <footer class="game-bottom-hud">
          <!-- LEFT: Virtual Steering Joystick (360° Manejo) -->
          <div
            class="virtual-joystick-base"
            @pointerdown=${(e: PointerEvent) => this.handleJoystickPointerDown(e)}
            @pointermove=${(e: PointerEvent) => this.handleJoystickPointerMove(e)}
            @pointerup=${(e: PointerEvent) => this.handleJoystickPointerUp(e)}
            @pointercancel=${(e: PointerEvent) => this.handleJoystickPointerUp(e)}
            title="Joystick 360° (Arrastra para girar)">
            <div class="joystick-ring"></div>
            <div
              class="joystick-knob"
              style="transform: translate(${this.joystickKnobX}px, ${this.joystickKnobY}px);">
              <span class="joystick-icon">🧭</span>
            </div>
          </div>

          <!-- CENTER: Sleek Low-Profile Camera & Zoom Dock -->
          <div class="camera-zoom-bar">
            <!-- Camera Mode (1ª / 3ª persona) -->
            <div class="segment-group">
              <button
                class="seg-btn ${this.cameraMode === 'first_person' ? 'active' : ''}"
                @click=${() => this.setCameraMode('first_person')}
                title="Vista en 1ª Persona (Nivel calle, tecla V)">
                👁️ 1ª
              </button>
              <button
                class="seg-btn ${this.cameraMode === 'third_person' ? 'active' : ''}"
                @click=${() => this.setCameraMode('third_person')}
                title="Vista en 3ª Persona (Héroe volando)">
                🦸 3ª
              </button>
            </div>

            <!-- Zoom Presets (Starts in Cielo / Sky!) -->
            <div class="segment-group">
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
                title="Vista del Cielo (Predeterminada)">
                Cielo
              </button>
            </div>

            <!-- Zoom Steppers -->
            <div class="zoom-stepper">
              <button class="zoom-step-btn" @click=${() => this.zoomIn()} title="Acercar">＋</button>
              <button class="zoom-step-btn" @click=${() => this.zoomOut()} title="Alejar">－</button>
            </div>
          </div>

          <!-- RIGHT: Drive, Vertical Flight & Stunt Controls -->
          <div class="drive-buttons-cluster">
            <!-- Vertical Flight Controls (Subir / Bajar Altitud) -->
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
                title="Ascender / Subir Altitud (Espacio / E)">
                ▲ SUBIR
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
                title="Descender / Bajar Altitud (Q)">
                ▼ BAJAR
              </button>
            </div>

            <!-- Acrobacia: Giro de Barril 360° -->
            <button
              class="drive-btn btn-stunt"
              @click=${() => this.triggerStuntRoll()}
              title="Acrobacia: Giro de Barril 360° (Tecla R)">
              🌀 GIRO
            </button>

            <!-- Turbo Supersónico -->
            <button
              class="drive-btn btn-turbo ${this.isTurboActive ? 'pressing' : ''}"
              @pointerdown=${() => this.triggerTurboBoost()}
              title="Turbo Supersónico Mach (Tecla Shift)">
              ⚡ TURBO
            </button>

            <!-- Frenar (Brake) -->
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

            <!-- Acelerar (Gas) -->
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

        <!-- WORLD MAP MODAL ("Elegir Cualquier Ciudad del Mundo y Volar") -->
        ${this.showWorldMapModal
          ? html`
              <div
                class="modal-backdrop"
                @click=${() => (this.showWorldMapModal = false)}>
                <div
                  class="world-map-fly-modal"
                  @click=${(e: Event) => e.stopPropagation()}>
                  <!-- Header -->
                  <div class="drawer-header">
                    <div class="passport-title-wrap">
                      <span class="passport-gold-emblem">🌍</span>
                      <div>
                        <h2>Volar desde el Mapa Mundo 3D</h2>
                        <div class="passport-subtitle">
                          Elige una ciudad o escribe cualquier lugar del planeta para descender en vuelo
                        </div>
                      </div>
                    </div>
                    <button
                      class="close-btn"
                      @click=${() => (this.showWorldMapModal = false)}>
                      ✕
                    </button>
                  </div>

                  <!-- Global Search Input -->
                  <div class="world-search-box">
                    <input
                      id="worldMapSearchInput"
                      type="text"
                      class="world-search-input"
                      placeholder="Escribe cualquier ciudad del mundo (ej: Buenos Aires, Tokio, Madrid, Roma, Sidney...)"
                      .value=${this.worldSearchQuery}
                      @input=${(e: InputEvent) => {
                        this.worldSearchQuery = (e.target as HTMLInputElement).value;
                      }}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') {
                          this.searchAndTeleport(this.worldSearchQuery);
                        }
                      }} />
                    <button
                      class="world-search-submit"
                      @click=${() => this.searchAndTeleport(this.worldSearchQuery)}>
                      Volar ✈️
                    </button>
                  </div>

                  <!-- Region Filter Tabs -->
                  <div class="region-tabs-row">
                    ${worldRegions.map(
                      (region) => html`
                        <button
                          class="region-tab-btn ${this.selectedRegion === region ? 'active' : ''}"
                          @click=${() => (this.selectedRegion = region)}>
                          ${region}
                        </button>
                      `,
                    )}
                  </div>

                  <!-- Cities Grid -->
                  <div class="world-cities-grid">
                    ${filteredDestinations.map(
                      (dest) => html`
                        <div
                          class="world-city-card"
                          @click=${() =>
                            this.flyFromOrbitToCity(
                              dest.lat,
                              dest.lng,
                              dest.city,
                              dest.country,
                              dest.flag,
                              dest.heading,
                            )}>
                          <div class="city-flag-badge">${dest.flag}</div>
                          <div class="city-card-info">
                            <div class="city-card-name">${dest.city}</div>
                            <div class="city-card-landmark">${dest.name}</div>
                            <div class="city-card-desc">${dest.description}</div>
                          </div>
                          <button class="city-card-fly-btn">Volar ✈️</button>
                        </div>
                      `,
                    )}
                  </div>
                </div>
              </div>
            `
          : ''}

        <!-- TOURIST PASSPORT MODAL -->
        ${this.showPassportModal
          ? html`
              <div
                class="modal-backdrop"
                @click=${() => (this.showPassportModal = false)}>
                <div
                  class="passport-modal"
                  @click=${(e: Event) => e.stopPropagation()}>
                  <div class="drawer-header">
                    <div class="passport-title-wrap">
                      <span class="passport-gold-emblem">🛂</span>
                      <div>
                        <h2>Pasaporte de Viajero</h2>
                        <div class="passport-subtitle">
                          Sellos oficiales desbloqueados por el mundo
                        </div>
                      </div>
                    </div>
                    <button
                      class="close-btn"
                      @click=${() => (this.showPassportModal = false)}>
                      ✕
                    </button>
                  </div>

                  <div class="passport-stats-bar">
                    <div>
                      Ciudades desbloqueadas:
                      <b>${this.passportStamps.length}</b>
                    </div>
                    <div>
                      Distancia Total:
                      <b>${formattedDistance}</b>
                    </div>
                    <div>
                      Puntos XP:
                      <b>${this.currentScore} pts</b>
                    </div>
                  </div>

                  <div class="passport-stamps-grid">
                    ${this.passportStamps.map(
                      (stamp) => html`
                        <div class="passport-stamp-badge">
                          <div class="stamp-ink-circle">
                            <span class="stamp-souvenir"
                              >${stamp.souvenirIcon}</span
                            >
                            <span class="stamp-city"
                              >${stamp.cityName.toUpperCase()}</span
                            >
                            <span class="stamp-flag">${stamp.flag}</span>
                            <span class="stamp-date">${stamp.unlockedAt}</span>
                          </div>
                          <div class="stamp-country">${stamp.country}</div>
                        </div>
                      `,
                    )}
                  </div>
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
