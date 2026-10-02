/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AvatarMode } from './game_types';
import { WeatherCondition } from './weather_system';
import type { HeroPose } from './hero3d';

interface WindParticle {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
}

interface ContrailPoint {
  x: number;
  y: number;
  alpha: number;
  width: number;
}

interface ImpactSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

/**
 * Cartoon / Comic Book Style 3D Superhero Tourist Renderer
 * Based on user references:
 * - Reference 1: Flying pose with both arms punched forward/overhead into the sky,
 *   streamlined body and projected silhouette shadow.
 * - Reference 2: Classic cartoon Superman style seen from behind, broad shoulders,
 *   vibrant blue suit, red gauntlet gloves, dynamic sweeping crimson cape with comic folds,
 *   black stylized hair, and compact traveler backpack.
 */
export class CharacterRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private windParticles: WindParticle[] = [];
  private contrailsLeft: ContrailPoint[] = [];
  private contrailsRight: ContrailPoint[] = [];
  private impactSparks: ImpactSpark[] = [];
  private shockwaves: ShockwaveRing[] = [];

  // Flight Kinematics & Aerodynamics
  private flightPhase: number = 0;
  private capePhase: number = 0;
  private bankAngle: number = 0; // Roll / alabeo al virar (-35° a +35°)
  private pitchAngle: number = 0; // Pitch / cabeceo (-25° ascenso a +45° picada)
  private hoverBob: number = 0;
  private turnCentrifugal: number = 0;
  private bodyYaw: number = 0; // Rotación axial sobre el eje de la cintura (Yaw)

  // Stunts & Acrobatic Maneuvers
  private barrelRollAngle: number = 0;
  private isRolling: boolean = false;

  // Dynamic Cape Inertia (Física de inercia: movimiento opuesto al doblar/girar el personaje)
  private capeInertiaX: number = 0;
  private capeInertiaVx: number = 0;

  // Collision & Impact Visual Feedback (Sutil y suave)
  private collisionTimer: number = 0;
  private collisionWobble: number = 0;

  // Pose Transition: 0.0 = Hero Stance (Imagen 2), 1.0 = Skyward Flight (Imagen 1)
  private flightPoseProgress: number = 0;

  // Altitude surge boost & climb
  public altitudeBoost: number = 0;
  private altitudeVy: number = 0;
  public isBoosting: boolean = false;
  public onStepSound?: (isLeft: boolean) => void;

  /** When true the 3D hero (hero3d.ts) draws the body; this class keeps drawing FX only. */
  public hideBody: boolean = false;
  /** Latest kinematics, consumed by the 3D hero every frame. */
  public pose: HeroPose = {
    visible: false, viewScale: 1, flightPose: 0, bodyYaw: 0, bankAngle: 0, pitchAngle: 0,
    barrelRollAngle: 0, collisionWobble: 0, hoverBob: 0, altitudeBoost: 0, turnCentrifugal: 0,
    flightPhase: 0, capePhase: 0, isMoving: false, speedKmh: 0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 36; i++) {
      this.windParticles.push({
        x: (Math.random() - 0.5) * 280,
        y: Math.random() * 280 - 140,
        length: Math.random() * 36 + 16,
        speed: Math.random() * 12 + 7,
        alpha: Math.random() * 0.45 + 0.2,
      });
    }
  }

  public resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  public triggerJump() {
    this.isBoosting = true;
    this.altitudeVy = -11;
  }

  /**
   * Triggers an acrobatic 360° Barrel Roll (giro en espiral)
   */
  public triggerBarrelRoll() {
    if (this.isRolling) return;
    this.isRolling = true;
    this.barrelRollAngle = 0;
    this.triggerShockwave('#60a5fa', 120);
  }

  /**
   * Triggers visual collision response (sutil y elegante: suave inclinación y pequeñas chispas doradas)
   */
  public triggerCollisionImpact(isBuilding: boolean = true) {
    this.collisionTimer = 0.22; // Corto y sutil
    this.collisionWobble = (Math.random() > 0.5 ? 1 : -1) * 0.08; // Suave desviación

    const w = this.canvas.width / Math.min(window.devicePixelRatio || 1, 2.5);
    const h = this.canvas.height / Math.min(window.devicePixelRatio || 1, 2.5);
    const centerX = w / 2;
    const centerY = h * 0.50;

    // Solo 3 a 5 pequeñas chispitas doradas muy sutiles
    const count = 4;
    const colors = ['#f59e0b', '#fbbf24', '#fef08a'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 80 + 35;
      this.impactSparks.push({
        x: centerX + (Math.random() - 0.5) * 16,
        y: centerY + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.22,
        maxLife: 0.22,
        color: colors[i % colors.length],
        size: 2.2,
      });
    }
  }

  /**
   * Triggers an expanding shockwave ring
   */
  public triggerShockwave(color: string = '#38bdf8', maxRadius: number = 140) {
    const w = this.canvas.width / Math.min(window.devicePixelRatio || 1, 2.5);
    const h = this.canvas.height / Math.min(window.devicePixelRatio || 1, 2.5);
    this.shockwaves.push({
      x: w / 2,
      y: h * 0.50,
      radius: 12,
      maxRadius: maxRadius,
      alpha: 0.9,
      color: color,
    });
  }

  public render(
    avatarMode: AvatarMode,
    isMoving: boolean,
    speedKmh: number,
    turnDirection: number, // -1 (left), 0 (none), 1 (right)
    cameraRangeMeters: number = 320,
    cameraMode: string = 'third_person',
    deltaTime: number = 0.016,
    verticalIntent: number = 0,
    playerAltitude: number = 42,
    playerTilt: number = 55,
    weatherCondition: WeatherCondition = 'clear',
  ) {
    const w = this.canvas.width / (Math.min(window.devicePixelRatio || 1, 2.5));
    const h = this.canvas.height / (Math.min(window.devicePixelRatio || 1, 2.5));
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    if (cameraMode === 'first_person') {
      this.pose.visible = false;
      return;
    }

    // Check if in outer space orbit (altitud orbital > 50,000m o cámara orbital)
    const isInSpaceOrbit = playerAltitude > 50000 || cameraRangeMeters > 50000;

    // Dynamic Scale according to camera distance
    let viewScale = 1.0;
    if (isInSpaceOrbit) {
      // In outer space: elegant heroic silhouette floating in zero-G overlooking Earth
      viewScale = 0.88;
    } else if (cameraRangeMeters < 20) {
      viewScale = 1.85; // Close-up: prominent comic cape, backpack, arms
    } else if (cameraRangeMeters > 100) {
      // Sky view standard: clean readable cartoon silhouette at 320m
      const droneRatio = Math.max(0.32, 1 - (cameraRangeMeters - 70) / 360);
      viewScale = Math.max(0.32, Math.min(0.68, droneRatio));
    } else {
      viewScale = 1.45 - (cameraRangeMeters - 20) * 0.009;
      viewScale = Math.max(0.7, Math.min(1.45, viewScale));
    }

    // Pivot axis: In space, position at lower-right to frame the 3D Earth globe; otherwise center of screen
    const anchorX = isInSpaceOrbit ? w * 0.78 : w / 2;
    const anchorY = isInSpaceOrbit ? h * 0.68 : h * 0.50;

    // Elegant Transition between Stand (Imagen 2) and Flying Overhead (Imagen 1)
    const targetPose = (isMoving && speedKmh > 1.2 && !isInSpaceOrbit) ? 1.0 : 0.0;
    const poseSpeed = targetPose > this.flightPoseProgress ? 4.8 : 3.6;
    this.flightPoseProgress += (targetPose - this.flightPoseProgress) * Math.min(1, poseSpeed * deltaTime);
    const t = Math.max(0, Math.min(1, this.flightPoseProgress));
    const smoothFlightPose = t * t * (3 - 2 * t);

    // Flight kinematics
    const flightSpeedFactor = Math.min(2.8, Math.max(0.7, speedKmh / 22));
    this.flightPhase += deltaTime * (isMoving ? 4.8 * flightSpeedFactor : (isInSpaceOrbit ? 1.0 : 1.8));
    this.capePhase += deltaTime * (isMoving ? 16 * flightSpeedFactor : (isInSpaceOrbit ? 2.5 : 4.5));

    // Levitation hover bobbing: slow zero-G drift in space
    this.hoverBob = Math.sin(this.flightPhase) * (isInSpaceOrbit ? 5.2 : (isMoving ? 2.2 : 3.8));

    // 1. Axial Body Yaw: Girar primero en su propio eje sobre la cintura antes de doblar
    const targetYaw = turnDirection * 0.46; // Giro sobre su eje vertical
    this.bodyYaw += (targetYaw - this.bodyYaw) * Math.min(1, 14 * deltaTime);

    // 2. Aerodynamic Banking: Alabeo al virar que entra de forma suave y elegante
    const targetBank = turnDirection * 0.28 * Math.min(1.3, Math.max(0.3, speedKmh / 22)) * smoothFlightPose;
    this.bankAngle += (targetBank - this.bankAngle) * Math.min(1, 6 * deltaTime);

    // Aerodynamic Pitch (Cabeceo: erguido en parado, inclinado hacia adelante en vuelo)
    let targetPitch = 0.0;
    if (this.isBoosting || verticalIntent > 0) {
      targetPitch = -0.42; // Pitch UP skyward
    } else if (verticalIntent < 0) {
      targetPitch = 0.55; // Pitch DOWN in dive
    } else if (isMoving) {
      targetPitch = (0.36 + Math.min(0.26, speedKmh / 160)) * smoothFlightPose;
    }
    this.pitchAngle += (targetPitch - this.pitchAngle) * Math.min(1, 7 * deltaTime);

    // 3. Inercia Dinámica de la Capa (Leyes Básicas de la Inercia):
    // La capa se desplaza hacia la dirección OPUESTA al doblar o girar el personaje.
    // Si el personaje dobla a la DERECHA (turnDirection > 0 o bodyYaw > 0), la inercia empuja la capa a la IZQUIERDA (< 0).
    // Si el personaje dobla a la IZQUIERDA (turnDirection < 0 o bodyYaw < 0), la inercia empuja la capa a la DERECHA (> 0).
    const angularMomentum = (turnDirection * 0.75) + (this.bodyYaw / 0.46 * 0.25);
    const inertiaMagnitude = isMoving ? (24 + Math.min(20, speedKmh / 10)) : 18;
    const targetInertiaX = -angularMomentum * inertiaMagnitude;

    // Resorte con amortiguador (Spring-Damper) para una oscilación elástica y natural de la tela
    const springK = isMoving ? 16 : 11;
    const damping = isMoving ? 7.0 : 5.8;
    const forceX = (targetInertiaX - this.capeInertiaX) * springK - this.capeInertiaVx * damping;
    this.capeInertiaVx += forceX * deltaTime;
    this.capeInertiaX += this.capeInertiaVx * deltaTime;

    // Altitude boost physics
    if (this.isBoosting) {
      this.altitudeBoost += this.altitudeVy;
      this.altitudeVy += 22 * deltaTime;
      if (this.altitudeBoost >= 0) {
        this.altitudeBoost = 0;
        this.altitudeVy = 0;
        this.isBoosting = false;
      }
    }

    // Stunts: Barrel Roll physics
    if (this.isRolling) {
      this.barrelRollAngle += deltaTime * 15.0; // Rapid 360° spin
      if (this.barrelRollAngle >= Math.PI * 2) {
        this.barrelRollAngle = 0;
        this.isRolling = false;
      }
    }

    // Collision Impact response & wobble (Sutil y suave)
    if (this.collisionTimer > 0) {
      this.collisionTimer -= deltaTime;
      this.collisionWobble = Math.sin(this.collisionTimer * 28) * 0.06 * (this.collisionTimer / 0.22);
    } else {
      this.collisionWobble = 0;
    }

    this.pose = {
      visible: avatarMode !== 'car',
      viewScale,
      flightPose: smoothFlightPose,
      bodyYaw: this.bodyYaw,
      bankAngle: this.bankAngle,
      pitchAngle: this.pitchAngle,
      barrelRollAngle: this.barrelRollAngle,
      collisionWobble: this.collisionWobble,
      hoverBob: this.hoverBob,
      altitudeBoost: this.altitudeBoost,
      turnCentrifugal: this.turnCentrifugal,
      flightPhase: this.flightPhase,
      capePhase: this.capePhase,
      isMoving,
      speedKmh,
    };

    // Render wind speed lines if flying fast
    if (isMoving && speedKmh > 15) {
      this.renderWindTrails(ctx, anchorX, anchorY, viewScale, speedKmh, deltaTime);
    }

    // Contrails from boot heels
    if (smoothFlightPose > 0.4 || this.isRolling) {
      this.updateAndRenderContrails(ctx, anchorX, anchorY, viewScale, speedKmh, isMoving, deltaTime);
    }

    // Dynamic Expanding Shockwave Rings
    this.renderShockwaves(ctx, deltaTime);

    // ========================================================
    // SOMBRA NATURAL SEGÚN DISTANCIA / ALTITUD Y A ESCALA (Referencia Imagen 1)
    // ========================================================
    this.renderSuperheroProjectedShadow(
      ctx,
      anchorX,
      anchorY,
      viewScale,
      playerAltitude,
      playerTilt,
      cameraRangeMeters,
      smoothFlightPose,
      weatherCondition,
    );

    // ========================================================
    // MAIN CHARACTER TRANSFORM (Eje EXACTO en la CINTURA: w/2, h*0.50)
    // ========================================================
    ctx.save();
    ctx.translate(anchorX, anchorY + this.hoverBob + this.altitudeBoost);
    ctx.scale(viewScale, viewScale);

    // Rotación sobre la cintura: primero gira sobre su eje vertical (Yaw) y luego alabea (Bank)
    ctx.rotate(this.bankAngle + this.barrelRollAngle + this.collisionWobble);
    const yawCos = Math.cos(this.bodyYaw);
    const yawSin = Math.sin(this.bodyYaw);
    ctx.transform(yawCos, 0, yawSin * 0.18, 1, 0, 0);

    if (avatarMode === 'car') {
      this.renderStreetViewCar(ctx, isMoving, speedKmh, turnDirection);
    } else if (!this.hideBody) {
      this.renderCartoonSuperman(
        ctx,
        isMoving,
        speedKmh,
        turnDirection,
        this.pitchAngle,
        avatarMode === 'trekker',
        smoothFlightPose,
        playerAltitude,
        weatherCondition,
      );
    }

    ctx.restore();

    // Render Subtle Collision Impact Sparks over character
    this.renderImpactSparks(ctx, deltaTime);
  }

  /**
   * Renders expanding sonic shockwave rings
   */
  private renderShockwaves(ctx: CanvasRenderingContext2D, deltaTime: number) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, 9 * deltaTime);
      sw.alpha -= deltaTime * 1.6;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius - 2) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(1, 4 * sw.alpha);
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Renders colorful comic impact spark particles & bursts
   */
  private renderImpactSparks(ctx: CanvasRenderingContext2D, deltaTime: number) {
    if (this.impactSparks.length === 0) return;

    for (let i = this.impactSparks.length - 1; i >= 0; i--) {
      const spark = this.impactSparks[i];
      spark.x += spark.vx * deltaTime;
      spark.y += spark.vy * deltaTime;
      spark.vy += 120 * deltaTime; // gravity on sparks
      spark.life -= deltaTime;

      if (spark.life <= 0) {
        this.impactSparks.splice(i, 1);
        continue;
      }

      const progress = spark.life / spark.maxLife;
      ctx.save();
      ctx.translate(spark.x, spark.y);
      ctx.fillStyle = spark.color;
      ctx.shadowColor = spark.color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = Math.max(0, progress);

      // Draw 4-point comic sparkle star
      const s = spark.size * progress;
      ctx.beginPath();
      ctx.moveTo(0, -s * 2);
      ctx.lineTo(s * 0.4, -s * 0.4);
      ctx.lineTo(s * 2, 0);
      ctx.lineTo(s * 0.4, s * 0.4);
      ctx.lineTo(0, s * 2);
      ctx.lineTo(-s * 0.4, s * 0.4);
      ctx.lineTo(-s * 2, 0);
      ctx.lineTo(-s * 0.4, -s * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Sombra natural según distancia y a escala con algo de transparencia (Referencia Imagen 1 y Física 3D):
   * - A escala real con perspectiva 3D: A mayor altitud del personaje, el suelo está más alejado de la cámara,
   *   por lo que la sombra proyectada en el plano terrestre reduce su escala aparente de forma inversamente proporcional.
   * - Posición según distancia/altitud y ángulo solar:
   *   En altitud 0 (contacto en suelo), la sombra se ubica justo bajo las botas con oclusión ambiental nítida.
   *   A medida que el héroe asciende, la sombra se proyecta hacia abajo en la pantalla según el tilt de la cámara y
   *   con un desplazamiento lateral y longitudinal dictado por la luz del sol cenital/diagonal.
   * - Transparencia y difusión natural (Umbra y Penumbra solar):
   *   La sombra NUNCA es opaca ni negra sólida: deja entrever las calles, el asfalto, veredas y edificios del mapa 3D.
   *   Posee una penumbra suave de múltiples paradas con caída gaussiana que se ensancha suavemente con la distancia.
   * - Silueta aerodinámica de superhéroe en vuelo:
   *   En altitudes bajas y medias (< 75m), la sombra proyecta la forma del héroe con brazos extendidos hacia adelante,
   *   torso estilizado, piernas aerodinámicas y la capa ondeante que responde a la inercia del viraje.
   */
  private renderSuperheroProjectedShadow(
    ctx: CanvasRenderingContext2D,
    anchorX: number,
    anchorY: number,
    viewScale: number,
    playerAltitude: number,
    playerTilt: number,
    cameraRangeMeters: number,
    flightPose: number,
    weatherCondition: WeatherCondition = 'clear',
  ) {
    // Si la altitud supera los 270m, la sombra se difunde completamente en la atmósfera
    if (playerAltitude > 270) return;

    const tiltRad = (playerTilt * Math.PI) / 180;

    // 1. Escala a perspectiva ("a escala"):
    // A mayor altitud, la distancia de la cámara al suelo es mayor que la distancia al jugador.
    // Por ende, la proyección de la sombra en el suelo terrestre debe achicarse a escala:
    const perspectiveFactor = cameraRangeMeters / (cameraRangeMeters + playerAltitude * Math.sin(tiltRad) * 0.88);
    const groundScale = Math.max(0.24, Math.min(1.0, perspectiveFactor)) * viewScale;

    // 2. Proyección y distancia en pantalla ("según distancia"):
    // En altitud 0, la sombra hace contacto exactamente en las suelas de las botas (y = +32 * viewScale)
    const baseContactY = 32 * viewScale;
    const groundProjectionFactor = Math.sin(tiltRad) * 1.72;
    const altitudeDropY = (playerAltitude / Math.max(25, cameraRangeMeters)) * 265 * groundProjectionFactor * viewScale;
    const shadowCenterY = baseContactY + altitudeDropY;

    // Desplazamiento lateral y longitudinal del sol (el sol ilumina desde arriba-izquierda)
    const sunOffsetX = (playerAltitude * 0.16 + 5) * groundScale;
    const sunOffsetY = (playerAltitude * 0.06) * groundScale;

    // 3. Transparencia natural ("con algo de transparencia"):
    // En un día normal con luz diurna y cielo azul, las sombras sobre asfalto o tierra tienen luz ambiental de relleno.
    // La opacidad en contacto es sutil (~0.56) y va disminuyendo elegantemente con la altura:
    let baseWeatherAlpha = 0.56;
    if (weatherCondition === 'rain') baseWeatherAlpha = 0.38;
    else if (weatherCondition === 'snow') baseWeatherAlpha = 0.46;
    else if (weatherCondition === 'fog') baseWeatherAlpha = 0.20;

    const altNorm = Math.min(1, Math.max(0, playerAltitude / 240));
    const shadowAlpha = Math.max(0, baseWeatherAlpha * (1 - Math.pow(altNorm, 1.25)));
    if (shadowAlpha <= 0.01) return;

    // 4. Difusión óptica (Penumbra vs Umbra):
    // El disco solar mide ~0.53°, por lo que el haz de sombra se difumina con la distancia:
    const penumbraSpread = 1 + altNorm * 0.85;
    const shadowRadiusX = 26 * penumbraSpread * groundScale;
    const shadowRadiusY = 11 * penumbraSpread * groundScale; // Elipse perspectiva en el plano del suelo

    ctx.save();
    ctx.translate(anchorX + sunOffsetX, anchorY + shadowCenterY + sunOffsetY);

    // Tono de sombra realista: azul pizarra / slate navy (nunca negro plano)
    const shadowR = weatherCondition === 'snow' ? 24 : 15;
    const shadowG = weatherCondition === 'snow' ? 36 : 23;
    const shadowB = weatherCondition === 'snow' ? 58 : 42;

    // A. Penumbra Suave Multicapa (Gradiente radial con transparencia gradual y natural)
    ctx.save();
    ctx.scale(1, shadowRadiusY / shadowRadiusX);
    const penumbraGrad = ctx.createRadialGradient(0, 0, shadowRadiusX * 0.12, 0, 0, shadowRadiusX);
    penumbraGrad.addColorStop(0, `rgba(${shadowR}, ${shadowG}, ${shadowB}, ${(shadowAlpha * 0.85).toFixed(3)})`);
    penumbraGrad.addColorStop(0.3, `rgba(${shadowR}, ${shadowG}, ${shadowB}, ${(shadowAlpha * 0.62).toFixed(3)})`);
    penumbraGrad.addColorStop(0.6, `rgba(${shadowR}, ${shadowG}, ${shadowB}, ${(shadowAlpha * 0.30).toFixed(3)})`);
    penumbraGrad.addColorStop(0.85, `rgba(${shadowR}, ${shadowG}, ${shadowB}, ${(shadowAlpha * 0.08).toFixed(3)})`);
    penumbraGrad.addColorStop(1, `rgba(${shadowR}, ${shadowG}, ${shadowB}, 0)`);
    ctx.fillStyle = penumbraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, shadowRadiusX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // B. Silueta Proyectada del Superhéroe en el Núcleo (Visible en altitudes bajas/medias < 75m)
    if (playerAltitude < 75) {
      const silFade = (1 - playerAltitude / 75);
      const silScale = (1 - altNorm * 0.25) * groundScale;
      ctx.save();
      ctx.scale(silScale * 0.75, silScale * 0.44); // Compresión de perspectiva terrestre
      ctx.fillStyle = `rgba(${shadowR - 4}, ${shadowG - 4}, ${shadowB - 4}, ${(shadowAlpha * silFade * 0.68).toFixed(3)})`;

      ctx.beginPath();
      // Cabeza
      ctx.arc(0, -22, 6, 0, Math.PI * 2);

      // Brazos: Extendidos hacia adelante/arriba al volar (o en jarras al estar parado)
      if (flightPose > 0.25) {
        ctx.rect(-10.5, -44, 4.8, 26);
        ctx.rect(5.7, -44, 4.8, 26);
        // Puños
        ctx.arc(-8, -45, 3, 0, Math.PI * 2);
        ctx.arc(8, -45, 3, 0, Math.PI * 2);
      } else {
        ctx.rect(-18, -14, 5, 20);
        ctx.rect(13, -14, 5, 20);
      }

      // Torso y Capa con deflexión de inercia
      const capeInertiaShadow = this.capeInertiaX * 0.45;
      ctx.moveTo(-13, -14);
      ctx.lineTo(13, -14);
      ctx.lineTo(17 + capeInertiaShadow, 16);
      ctx.quadraticCurveTo(capeInertiaShadow, 19, -17 + capeInertiaShadow, 16);
      ctx.closePath();

      // Piernas y Botas
      ctx.rect(-8, 14, 5.2, 22);
      ctx.rect(2.8, 14, 5.2, 22);
      ctx.fill();
      ctx.restore();
    }

    // C. Oclusión Ambiental Nítida de Contacto (Muy cerca del suelo < 7m)
    if (playerAltitude < 7) {
      const contactAlpha = (1 - playerAltitude / 7) * 0.65;
      ctx.save();
      ctx.fillStyle = `rgba(8, 14, 24, ${contactAlpha.toFixed(3)})`;
      // Bota izquierda
      ctx.beginPath();
      ctx.ellipse(-6.5 * groundScale, -2 * groundScale, 5 * groundScale, 2.2 * groundScale, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bota derecha
      ctx.beginPath();
      ctx.ellipse(6.5 * groundScale, -2 * groundScale, 5 * groundScale, 2.2 * groundScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Renders the Cartoon/Comic Book Style Superman character seen from behind:
   * - Broad athletic shoulders in Superman Royal Blue.
   * - Red Gauntlets on forearms.
   * - Vibrant Crimson Cape billowing with comic folds (Referencia Imagen 2).
   * - Both arms punching overhead into the clouds during flight (Referencia Imagen 1).
   * - Standing heroically with hands on hips/at sides when stopped.
   * - Compact traveler backpack.
   */
  private renderCartoonSuperman(
    ctx: CanvasRenderingContext2D,
    isMoving: boolean,
    speedKmh: number,
    turnDirection: number,
    pitch: number,
    isTrekker: boolean,
    flightPose: number, // 0.0 (Parado Imagen 2) a 1.0 (Vuelo Imagen 1)
    playerAltitude: number = 42,
    weatherCondition: WeatherCondition = 'clear',
  ) {
    const isHighSpeed = isMoving && speedKmh > 55;

    // Cálculo avanzado de Rebotes de Luz (Ground Bounce / Albedo Reflection):
    // A menor altitud, la luz reflejada desde las calles, edificios, agua o nieve es intensa y cálida
    const groundBounceAlpha = Math.max(0.22, 0.72 - Math.pow(playerAltitude / 90, 0.7) * 0.48);

    // Paleta de Rebote de Luz y Reflejos según el entorno y clima:
    let bounceColorWarm = (a: number) => `rgba(251, 146, 60, ${(groundBounceAlpha * a).toFixed(2)})`;
    let bounceColorGolden = (a: number) => `rgba(254, 215, 170, ${(groundBounceAlpha * a).toFixed(2)})`;
    let skyRimColor = 'rgba(186, 230, 253, 0.85)';
    let sunDirectHighlight = '#fef08a';

    if (weatherCondition === 'snow') {
      bounceColorWarm = (a: number) => `rgba(224, 242, 254, ${(groundBounceAlpha * a * 1.25).toFixed(2)})`;
      bounceColorGolden = (a: number) => `rgba(191, 219, 254, ${(groundBounceAlpha * a).toFixed(2)})`;
      skyRimColor = 'rgba(219, 234, 254, 0.95)';
      sunDirectHighlight = '#ffffff';
    } else if (weatherCondition === 'rain') {
      bounceColorWarm = (a: number) => `rgba(203, 213, 225, ${(groundBounceAlpha * a * 0.85).toFixed(2)})`;
      bounceColorGolden = (a: number) => `rgba(226, 232, 240, ${(groundBounceAlpha * a * 0.8).toFixed(2)})`;
      skyRimColor = 'rgba(148, 163, 184, 0.75)';
      sunDirectHighlight = '#f1f5f9';
    } else if (weatherCondition === 'fog') {
      bounceColorWarm = (a: number) => `rgba(241, 245, 249, ${(groundBounceAlpha * a * 0.65).toFixed(2)})`;
      bounceColorGolden = (a: number) => `rgba(248, 250, 252, ${(groundBounceAlpha * a * 0.6).toFixed(2)})`;
      skyRimColor = 'rgba(203, 213, 225, 0.65)';
      sunDirectHighlight = '#f8fafc';
    }

    // Breathing and spinal airflow
    const spineUndulate = Math.sin(this.flightPhase * 1.5) * (1.5 * flightPose + 0.5);
    const legFlutterLeft = Math.sin(this.flightPhase * 2) * (4.0 * flightPose);
    const legFlutterRight = -Math.sin(this.flightPhase * 2) * (4.0 * flightPose);
    const pitchStretch = 1 + pitch * 0.15;

    // ========================================================
    // 1. CINTURÓN Y CADERA (EJE CENTRAL DEL PERSONAJE: y = 0)
    // ========================================================
    ctx.save();
    ctx.translate(0, spineUndulate * 0.25);

    // Comic Red Trunks / Hips (y = 0 a +9) con volumen e iluminación 3D
    const trunkGrad = ctx.createLinearGradient(0, -1, 0, 10);
    trunkGrad.addColorStop(0, '#991b1b');
    trunkGrad.addColorStop(0.3, '#dc2626');
    trunkGrad.addColorStop(0.7, '#b91c1c');
    trunkGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = trunkGrad;
    ctx.beginPath();
    ctx.roundRect(-10.5, 0, 21, 10, 2.5);
    ctx.fill();

    // Rebote de luz cálida del suelo en la base de los trunks
    ctx.fillStyle = bounceColorWarm(0.82);
    ctx.fillRect(-10.5, 7.5, 21, 2.5);

    // Golden Metallic Champion Belt (Cintura y = -3 a +3) con brillo especular
    const beltGrad = ctx.createLinearGradient(-11, 0, 11, 0);
    beltGrad.addColorStop(0, '#713f12');
    beltGrad.addColorStop(0.2, '#ca8a04');
    beltGrad.addColorStop(0.45, '#fef9c3'); // destello especular de luz
    beltGrad.addColorStop(0.7, '#eab308');
    beltGrad.addColorStop(1, '#854d0e');
    ctx.fillStyle = beltGrad;
    ctx.fillRect(-11, -3, 22, 5.5);

    // Rebote de luz inferior en el borde bajo del cinturón
    ctx.fillStyle = bounceColorGolden(0.65);
    ctx.fillRect(-11, 1.8, 22, 0.7);

    // Belt Buckle (Hebilla dorada con bisel 3D y brillo)
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-3, -4, 6, 7.5);
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -4, 6, 7.5);

    // Destello de brillo especular dinámico en la hebilla
    const sweepPhase = (this.flightPhase * 1.5) % (Math.PI * 2);
    if (Math.sin(sweepPhase) > 0.82) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0.5, -0.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // ========================================================
    // 2. PIERNAS Y BOTAS ROJAS (Debajo de la cintura: y = 8 a +36)
    // ========================================================
    ctx.save();
    const legsY = (8 + spineUndulate * 0.3) * pitchStretch;
    ctx.translate(0, legsY);

    // Left Leg
    ctx.save();
    const leftAngle = ((-2.5 * (1 - flightPose) + (-8 + legFlutterLeft) * flightPose) * Math.PI) / 180;
    ctx.translate(-6.5, 0);
    ctx.rotate(leftAngle);
    this.drawCartoonLeg(ctx, 7, 28, '#1d4ed8', '#1e40af', groundBounceAlpha, bounceColorGolden);
    this.drawCartoonRedBoot(ctx, 0, 26, flightPose, groundBounceAlpha, bounceColorWarm, bounceColorGolden);
    ctx.restore();

    // Right Leg
    ctx.save();
    const rightAngle = ((2.5 * (1 - flightPose) + (8 + legFlutterRight) * flightPose) * Math.PI) / 180;
    ctx.translate(6.5, 0);
    ctx.rotate(rightAngle);
    this.drawCartoonLeg(ctx, 7, 28, '#2563eb', '#1d4ed8', groundBounceAlpha, bounceColorGolden);
    this.drawCartoonRedBoot(ctx, 0, 26, flightPose, groundBounceAlpha, bounceColorWarm, bounceColorGolden);
    ctx.restore();

    ctx.restore();

    // ========================================================
    // 3. CAPA ROJA VIBRANTE (Sale de los hombros y cae pasando la cintura)
    // ========================================================
    this.drawCartoonCape(ctx, isMoving, speedKmh, pitch, flightPose, groundBounceAlpha, bounceColorGolden, skyRimColor);

    // ========================================================
    // 4. TORSO (Triángulo muscular que sube desde la cintura y=0 a hombros y=-24)
    // ========================================================
    ctx.save();
    ctx.translate(0, spineUndulate * 0.4);

    // Superman Royal Blue Suit con Iluminación Direccional 3D y Reflejos
    const suitGrad = ctx.createLinearGradient(-14, -12, 14, 0);
    suitGrad.addColorStop(0, '#172554'); // Sombra izquierda/borde
    suitGrad.addColorStop(0.20, '#1d4ed8');
    suitGrad.addColorStop(0.46, '#60a5fa'); // Cresta muscular iluminada por el sol directo
    suitGrad.addColorStop(0.72, '#2563eb');
    suitGrad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = suitGrad;
    ctx.beginPath();
    // Torso en V desde cintura (y=0) hasta hombros (y=-24)
    ctx.moveTo(-14, -24); // Hombro izquierdo
    ctx.lineTo(14, -24);  // Hombro derecho
    ctx.lineTo(9.5, 0);   // Cintura derecha
    ctx.lineTo(-9.5, 0);  // Cintura izquierda
    ctx.closePath();
    ctx.fill();

    // Comic Muscle Inking & Spine Crease
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, -2);
    // Latissimus curves
    ctx.moveTo(-8, -16);
    ctx.quadraticCurveTo(-4, -10, -2, -3);
    ctx.moveTo(8, -16);
    ctx.quadraticCurveTo(4, -10, 2, -3);
    ctx.stroke();

    // Brillo Especular Direccional en hombro y trapecio (Luz Principal)
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(13.5, -23.5);
    ctx.lineTo(9, -2);
    ctx.stroke();

    // Luz Cenital del Cielo (Sky Rim Light) en la cresta superior de los hombros
    ctx.strokeStyle = skyRimColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-13.5, -24);
    ctx.lineTo(13.5, -24);
    ctx.stroke();

    // Rebote de luz del suelo en los laterales de la cintura y dorsales
    ctx.strokeStyle = bounceColorGolden(0.92);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-9.5, 0);
    ctx.lineTo(-9.5, -9);
    ctx.moveTo(9.5, 0);
    ctx.lineTo(9.5, -9);
    ctx.stroke();

    ctx.restore();

    // ========================================================
    // 5. MOCHILITA DE VIAJERO (En la espalda media: y = -14)
    // ========================================================
    ctx.save();
    ctx.translate(0, -14 + spineUndulate * 0.4);
    if (isTrekker) {
      this.drawCartoonTrekkerPack(ctx);
    } else {
      this.drawCartoonTravelerBackpack(ctx, isMoving, speedKmh, groundBounceAlpha, bounceColorGolden, sunDirectHighlight);
    }
    ctx.restore();

    // ========================================================
    // 6. BRAZOS Y GUANTES ROJOS (Manos en jarra sobre la cintura en parado)
    // ========================================================
    ctx.save();
    ctx.translate(0, spineUndulate * 0.4);
    // Right Arm
    this.drawCartoonArm(ctx, true, flightPose, isHighSpeed, pitch, groundBounceAlpha, bounceColorWarm, bounceColorGolden, skyRimColor, sunDirectHighlight);
    // Left Arm
    this.drawCartoonArm(ctx, false, flightPose, isHighSpeed, pitch, groundBounceAlpha, bounceColorWarm, bounceColorGolden, skyRimColor, sunDirectHighlight);
    ctx.restore();

    // ========================================================
    // 7. CUELLO, CABEZA Y PEINADO COMIC (Arriba de los hombros: y = -34)
    // ========================================================
    ctx.save();
    const headReachOffset = (pitch < 0 ? -6 : 0) * flightPose;
    ctx.translate(0, -32 + spineUndulate * 0.4 + headReachOffset * 0.5);
    // La cabeza lidera la rotación axial en su eje primero
    ctx.rotate(this.bodyYaw * 0.65 + turnDirection * 0.1 * flightPose);

    // Muscular Neck with Warm Skin Tone y sombreado
    const neckGrad = ctx.createLinearGradient(-4, 0, 4, 0);
    neckGrad.addColorStop(0, '#b45309');
    neckGrad.addColorStop(0.4, '#f59e0b');
    neckGrad.addColorStop(0.8, '#d97706');
    neckGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(-4, 2);
    ctx.lineTo(4, 2);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();

    // Rebote de luz ascendente bajo la mandíbula
    ctx.strokeStyle = bounceColorGolden(0.72);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-4, 6);
    ctx.quadraticCurveTo(0, 7.5, 4, 6);
    ctx.stroke();

    // Stylized Comic Hair (Black with crisp cyan sky specular highlight)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, -1, 10.5, 0, Math.PI * 2);
    ctx.fill();

    // Comic Hair wave with sky reflection
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-2, -3, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // Specular glossy hair curl reflecting the sky
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-2, -4, 5.5, Math.PI * 0.8, Math.PI * 1.6);
    ctx.stroke();

    // Destello de sol directo en el mechón
    ctx.fillStyle = sunDirectHighlight;
    ctx.beginPath();
    ctx.arc(-3.5, -7, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(-2, -12); // Comic hair peak
    ctx.lineTo(3, -9);
    ctx.lineTo(7, -7);
    ctx.closePath();
    ctx.fill();

    // Cape Clasps on Shoulders with gleaming gold reflection
    this.drawMetallicClasp(ctx, -12, 8);
    this.drawMetallicClasp(ctx, 12, 8);

    ctx.restore();

    // Mach sonic shockwave cone when flying at high speed
    if (isHighSpeed && flightPose > 0.8) {
      this.drawSonicRings(ctx, spineUndulate);
    }
  }

  /**
   * Draws a Cartoon Comic Arm with Red Gauntlet Gloves:
   * - Flying Pose: Overhead reach punching skyward.
   * - Standing Pose: Hands on hips resting firmly on the waist belt (y = 0).
   * - Key lighting with specular ridges & ground bounce reflection.
   */
  private drawCartoonArm(
    ctx: CanvasRenderingContext2D,
    isRight: boolean,
    flightPose: number,
    isHighSpeed: boolean,
    pitch: number,
    groundBounceAlpha: number = 0.3,
    bounceColorWarm: (a: number) => string = (a) => `rgba(251, 146, 60, ${(0.3 * a).toFixed(2)})`,
    bounceColorGolden: (a: number) => string = (a) => `rgba(254, 215, 170, ${(0.3 * a).toFixed(2)})`,
    skyRimColor: string = 'rgba(186, 230, 253, 0.85)',
    sunDirectHighlight: string = '#fef08a',
  ) {
    const side = isRight ? 1 : -1;
    const shoulderX = side * 13;
    const shoulderY = -23; // Altura de los hombros

    // 1. Akimbo / Stance (Referencia Imagen 2):
    // Puños firmes sobre la cintura (y = 0) con los codos abiertos hacia afuera
    const akimboElbowX = side * 19;
    const akimboElbowY = -12;
    const akimboHandX = side * 10.5;
    const akimboHandY = -0.5; // Apoyados exactamente en el cinturón (y = 0)

    // 2. Flying Overhead Punch (Referencia Imagen 1):
    const reachOffset = pitch < 0 ? -6 : 0;
    const flightElbowX = side * 8;
    const flightElbowY = -38 + reachOffset * 0.6;
    const flightHandX = side * 5;
    const flightHandY = -58 + reachOffset; // Alto vuelo frontal

    // Interpolation between Stance and Flying
    const elbowX = akimboElbowX + (flightElbowX - akimboElbowX) * flightPose;
    const elbowY = akimboElbowY + (flightElbowY - akimboElbowY) * flightPose;
    const handX = akimboHandX + (flightHandX - akimboHandX) * flightPose;
    const handY = akimboHandY + (flightHandY - akimboHandY) * flightPose;

    ctx.save();

    // --- Upper Arm (Shoulder -> Elbow in Blue Suit) ---
    const upperGrad = ctx.createLinearGradient(shoulderX, shoulderY, elbowX, elbowY);
    upperGrad.addColorStop(0, '#172554');
    upperGrad.addColorStop(0.35, '#2563eb');
    upperGrad.addColorStop(0.68, '#60a5fa'); // Reflejo de luz cenital
    upperGrad.addColorStop(1, '#1e3a8a');
    ctx.strokeStyle = upperGrad;
    ctx.lineWidth = 7.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.stroke();

    // Comic contour stroke
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Specular Key Light Line on upper arm bicep (Luz directa)
    ctx.strokeStyle = skyRimColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(shoulderX + side * 1, shoulderY - 1);
    ctx.lineTo(elbowX + side * 1.5, elbowY);
    ctx.stroke();

    // Rebote de luz del suelo en la cara inferior del bíceps
    ctx.strokeStyle = bounceColorGolden(0.75);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(shoulderX - side * 1.2, shoulderY + 2);
    ctx.lineTo(elbowX - side * 1.5, elbowY + 1);
    ctx.stroke();

    // --- Forearm & Red Gauntlet Glove (Elbow -> Fist) ---
    const gloveStartX = elbowX + (handX - elbowX) * 0.25;
    const gloveStartY = elbowY + (handY - elbowY) * 0.25;

    // Blue forearm sleeve
    ctx.strokeStyle = upperGrad;
    ctx.lineWidth = 6.2;
    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(gloveStartX, gloveStartY);
    ctx.stroke();

    // Vibrant Red Gauntlet Glove con cresta especular de luz
    const gloveGrad = ctx.createLinearGradient(gloveStartX, gloveStartY, handX, handY);
    gloveGrad.addColorStop(0, '#7f1d1d');
    gloveGrad.addColorStop(0.28, '#dc2626');
    gloveGrad.addColorStop(0.62, '#fca5a5'); // Cresta especular brillante
    gloveGrad.addColorStop(0.85, '#ef4444');
    gloveGrad.addColorStop(1, '#991b1b');
    ctx.strokeStyle = gloveGrad;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(gloveStartX, gloveStartY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Rebote de luz cálida del suelo en la parte inferior del antebrazo
    ctx.strokeStyle = bounceColorWarm(0.88);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(gloveStartX - side * 2.2, gloveStartY);
    ctx.lineTo(handX - side * 1.5, handY);
    ctx.stroke();

    // Gauntlet gold trim ring at cuff with intense metallic gleam
    ctx.strokeStyle = sunDirectHighlight;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(gloveStartX, gloveStartY, 3.8, 0, Math.PI * 2);
    ctx.stroke();

    // Rebote de luz en el borde inferior del anillo dorado
    ctx.strokeStyle = bounceColorWarm(0.85);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(gloveStartX, gloveStartY + 1, 3.8, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();

    // --- Clenched Superhero Fist ---
    ctx.save();
    ctx.translate(handX, handY);

    if (flightPose > 0.4) {
      // Clenched fist punching skyward con volumen
      const fistGrad = ctx.createRadialGradient(0, -1, 0.5, 0, 0, 5);
      fistGrad.addColorStop(0, '#fca5a5');
      fistGrad.addColorStop(0.35, '#ef4444');
      fistGrad.addColorStop(0.85, '#b91c1c');
      fistGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = fistGrad;
      ctx.beginPath();
      ctx.roundRect(-4, -5.5, 8, 7.5, 2.5);
      ctx.fill();

      // Knuckle inking lines & specular dots
      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2.5, -4);
      ctx.lineTo(-2.5, -1);
      ctx.moveTo(0, -4.5);
      ctx.lineTo(0, -1);
      ctx.moveTo(2.5, -4);
      ctx.lineTo(2.5, -1);
      ctx.stroke();

      // Specular highlight on knuckles (luz del sol)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -4.5, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Rebote de luz en la palma inferior del puño
      ctx.strokeStyle = bounceColorWarm(0.82);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-3, 1.5);
      ctx.lineTo(3, 1.5);
      ctx.stroke();

      if (isHighSpeed) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.arc(0, -7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Clenched fist on hip (waist y = 0)
      const fistGrad = ctx.createRadialGradient(-side * 1, -1, 0.5, 0, 0, 4.5);
      fistGrad.addColorStop(0, '#fecaca');
      fistGrad.addColorStop(0.3, '#f87171');
      fistGrad.addColorStop(0.7, '#dc2626');
      fistGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = fistGrad;
      ctx.beginPath();
      ctx.roundRect(-side * 3, -3, 6, 6, 2.5);
      ctx.fill();

      // Rebote de luz en los nudillos
      ctx.strokeStyle = bounceColorWarm(0.85);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-side * 3, -3, 6, 6);
    }

    ctx.restore();
    ctx.restore();
  }

  /**
   * Cartoon / Comic Book Style Cape:
   * Bold, vibrant red cape with sweeping curves, attached at shoulders (y = -22).
   * Leyes básicas de la inercia:
   * La tela se mueve de derecha a izquierda según lo opuesto al doblar o girar el personaje.
   * Iluminación 3D y rebotes de luz del terreno en el dobladillo inferior.
   */
  private drawCartoonCape(
    ctx: CanvasRenderingContext2D,
    isMoving: boolean,
    speedKmh: number,
    pitch: number,
    flightPose: number,
    groundBounceAlpha: number = 0.3,
    bounceColorGolden: (a: number) => string = (a) => `rgba(254, 215, 170, ${(0.3 * a).toFixed(2)})`,
    skyRimColor: string = 'rgba(186, 230, 253, 0.85)',
  ) {
    ctx.save();
    ctx.translate(0, -22); // Sale directamente desde los hombros

    const wave = this.capePhase;
    const flapAmp = (isMoving ? 7 + Math.min(13, speedKmh / 15) : 3.2) * (0.4 + 0.6 * flightPose);
    const capeLength = isMoving ? 56 + (12 + Math.min(24, speedKmh / 7)) * flightPose : 52;
    const pitchLift = pitch * 12 * flightPose;

    // Desplazamiento por inercia física:
    // Los hombros están fijos. A medida que bajamos por la capa, el latigazo de inercia aumenta.
    const lag1 = this.capeInertiaX * 0.35; // Tercio superior
    const lag2 = this.capeInertiaX * 0.75; // Mitad de la capa
    const lag3 = this.capeInertiaX * 1.30; // Punta inferior (vuelo libre con máxima inercia)

    const w1 = Math.sin(wave) * (flapAmp * 0.65);
    const w2 = Math.sin(wave + 1.2) * (flapAmp * 1.15);
    const w3 = Math.sin(wave + 2.4) * flapAmp;

    // Vibrant Comic Red Gradient con orientación de inercia
    const capeGrad = ctx.createLinearGradient(0, -6, lag2, capeLength);
    capeGrad.addColorStop(0, '#7f1d1d');
    capeGrad.addColorStop(0.22, '#991b1b');
    capeGrad.addColorStop(0.48, '#dc2626');
    capeGrad.addColorStop(0.75, '#ef4444');
    capeGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = capeGrad;

    // Outer Cape Outline
    ctx.beginPath();
    ctx.moveTo(-13, 0); // Hombro izquierdo
    ctx.lineTo(13, 0);  // Hombro derecho

    // Borde derecho (ondulación simétrica + inercia hacia izquierda/derecha)
    ctx.bezierCurveTo(
      17 + w1 * 0.4 + lag1,
      capeLength * 0.35 - pitchLift * 0.4,
      22 + w2 + lag2,
      capeLength * 0.7 - pitchLift * 0.8,
      20 + w3 + lag3,
      capeLength - pitchLift,
    );

    // Borde inferior con caída central curvada
    ctx.quadraticCurveTo(
      lag3 * 1.05,
      capeLength + 4 + w2 * 0.3 - pitchLift,
      -20 + w3 + lag3,
      capeLength - pitchLift,
    );

    // Borde izquierdo (ondulación simétrica + inercia hacia izquierda/derecha)
    ctx.bezierCurveTo(
      -22 + w2 + lag2,
      capeLength * 0.7 - pitchLift * 0.8,
      -17 + w1 * 0.4 + lag1,
      capeLength * 0.35 - pitchLift * 0.4,
      -13,
      0,
    );
    ctx.closePath();
    ctx.fill();

    // Rebote de luz cálida del suelo en el dobladillo inferior de la capa (Ground Light Bounce)
    const bounceGrad = ctx.createLinearGradient(0, capeLength - 22, 0, capeLength);
    bounceGrad.addColorStop(0, 'rgba(251, 146, 60, 0)');
    bounceGrad.addColorStop(1, bounceColorGolden(0.88));
    ctx.fillStyle = bounceGrad;
    ctx.fill();

    // Reflejo de luz cenital (Key Light) a lo largo del hombro derecho
    ctx.strokeStyle = 'rgba(254, 202, 202, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.bezierCurveTo(16 + lag1, capeLength * 0.25, 20 + lag2, capeLength * 0.45, 16 + lag3, capeLength * 0.65);
    ctx.stroke();

    // Luz de contorno celeste cielo en el borde izquierdo
    ctx.strokeStyle = skyRimColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.bezierCurveTo(-16 + lag1, capeLength * 0.25, -20 + lag2, capeLength * 0.45, -16 + lag3, capeLength * 0.65);
    ctx.stroke();

    // Pliegues y arrugas de tensión cómic según la inercia de la tela
    ctx.strokeStyle = 'rgba(69, 10, 10, 0.48)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    // Pliegue central que se curva con la inercia
    ctx.moveTo(0, 4);
    ctx.quadraticCurveTo(lag2 * 0.7, capeLength * 0.5, lag3 * 0.9, capeLength - 4 - pitchLift);
    // Pliegues laterales
    ctx.moveTo(-6, 2);
    ctx.quadraticCurveTo(-8 + lag2 * 0.8, capeLength * 0.55, -10 + lag3, capeLength - 7 - pitchLift);
    ctx.moveTo(6, 2);
    ctx.quadraticCurveTo(8 + lag2 * 0.8, capeLength * 0.55, 10 + lag3, capeLength - 7 - pitchLift);
    ctx.stroke();

    // Comic edge outline
    ctx.strokeStyle = 'rgba(69, 10, 10, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Cartoon Traveler Backpack with leather straps, bedroll & canteen
   */
  private drawCartoonTravelerBackpack(
    ctx: CanvasRenderingContext2D,
    isMoving: boolean,
    speedKmh: number,
    groundBounceAlpha: number = 0.3,
    bounceColorGolden: (a: number) => string = (a) => `rgba(254, 215, 170, ${(0.3 * a).toFixed(2)})`,
    sunDirectHighlight: string = '#fef08a',
  ) {
    // Shoulder Harness with Buckles
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-10, -12, 3.5, 16);
    ctx.fillRect(6.5, -12, 3.5, 16);

    ctx.fillStyle = sunDirectHighlight; // Gold buckles with shine
    ctx.fillRect(-10, -2, 3.5, 2.5);
    ctx.fillRect(6.5, -2, 3.5, 2.5);

    // Main Backpack Body (Canvas with Comic Inking)
    const packGrad = ctx.createLinearGradient(-9, -8, 9, 12);
    packGrad.addColorStop(0, '#047857');
    packGrad.addColorStop(0.35, '#10b981'); // light highlight
    packGrad.addColorStop(0.7, '#059669');
    packGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = packGrad;
    ctx.beginPath();
    ctx.roundRect(-9, -8, 18, 20, 4);
    ctx.fill();

    // Rebote de luz en la base de la mochila
    ctx.fillStyle = bounceColorGolden(0.72);
    ctx.fillRect(-9, 10, 18, 2.2);

    // Comic outline
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Front pocket with brass zipper
    ctx.fillStyle = '#047857';
    ctx.beginPath();
    ctx.roundRect(-7, 1, 14, 10, 2.5);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, 4.5);
    ctx.lineTo(5, 4.5);
    ctx.stroke();

    // Top Rolled Leather Sleeping Pad (Petate de cuero) con luz superior
    const rollGrad = ctx.createLinearGradient(-10, -13, 10, -7);
    rollGrad.addColorStop(0, '#78350f');
    rollGrad.addColorStop(0.35, sunDirectHighlight); // specular leather gleam
    rollGrad.addColorStop(0.7, '#d97706');
    rollGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = rollGrad;
    ctx.beginPath();
    ctx.roundRect(-10, -13, 20, 6.5, 2.5);
    ctx.fill();

    // Leather straps
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-6.5, -14, 2, 8);
    ctx.fillRect(4.5, -14, 2, 8);

    // Brushed steel travel canteen with metallic gloss streak + bottom bounce
    const flaskGrad = ctx.createLinearGradient(7, -2, 11, -2);
    flaskGrad.addColorStop(0, '#64748b');
    flaskGrad.addColorStop(0.35, '#ffffff'); // metallic specular streak
    flaskGrad.addColorStop(0.7, '#94a3b8');
    flaskGrad.addColorStop(1, '#334155');
    ctx.fillStyle = flaskGrad;
    ctx.beginPath();
    ctx.roundRect(7.5, -2, 3.5, 11, 1.5);
    ctx.fill();

    // Rebote de luz en la base de la cantimplora
    ctx.fillStyle = bounceColorGolden(0.7);
    ctx.fillRect(7.5, 7.5, 3.5, 1.5);
  }

  private drawCartoonTrekkerPack(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-9, -9, 18, 22, 3.5);
    ctx.fill();
    const orbGrad = ctx.createRadialGradient(-2, -16, 1, 0, -15, 8);
    orbGrad.addColorStop(0, '#93c5fd');
    orbGrad.addColorStop(0.5, '#2563eb');
    orbGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(0, -15, 7.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCartoonLeg(
    ctx: CanvasRenderingContext2D,
    width: number,
    length: number,
    colorTop: string,
    colorBottom: string,
    groundBounceAlpha: number = 0.3,
    bounceColorGolden: (a: number) => string = (a) => `rgba(254, 215, 170, ${(0.3 * a).toFixed(2)})`,
  ) {
    const grad = ctx.createLinearGradient(-width / 2, 0, width / 2, length);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(0.4, '#60a5fa'); // key light volume
    grad.addColorStop(0.75, colorBottom);
    grad.addColorStop(1, '#172554');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-width / 2, 0, width, length, 3);
    ctx.fill();

    // Rebote de luz cálida del suelo en la cara interna/inferior
    ctx.fillStyle = bounceColorGolden(0.68);
    ctx.beginPath();
    ctx.rect(-width / 2 + 1, length * 0.38, width - 2, length * 0.58);
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  private drawCartoonRedBoot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    flightPose: number,
    groundBounceAlpha: number = 0.3,
    bounceColorWarm: (a: number) => string = (a) => `rgba(251, 146, 60, ${(0.3 * a).toFixed(2)})`,
    bounceColorGolden: (a: number) => string = (a) => `rgba(254, 215, 170, ${(0.3 * a).toFixed(2)})`,
  ) {
    ctx.save();
    ctx.translate(x, y);

    // Comic Red Superhero Boot (Imagen 2) con cresta de luz brillante
    const bootGrad = ctx.createLinearGradient(-4, 0, 4, 0);
    bootGrad.addColorStop(0, '#7f1d1d');
    bootGrad.addColorStop(0.25, '#dc2626');
    bootGrad.addColorStop(0.55, '#fca5a5'); // destello brillante de charol/cuero
    bootGrad.addColorStop(0.85, '#ef4444');
    bootGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = bootGrad;
    ctx.beginPath();
    ctx.roundRect(-4, 0, 8, 12, 2.5);
    ctx.fill();

    // Rebote de luz cálida del suelo en la base de la bota
    ctx.fillStyle = bounceColorWarm(0.88);
    ctx.fillRect(-4, 8.5, 8, 3.5);

    // Metallic Golden Trim Cuff con gradiente brillante
    const cuffGrad = ctx.createLinearGradient(-4, 0, 4, 0);
    cuffGrad.addColorStop(0, '#ca8a04');
    cuffGrad.addColorStop(0.5, '#fef08a');
    cuffGrad.addColorStop(1, '#a16207');
    ctx.fillStyle = cuffGrad;
    ctx.fillRect(-4, 0, 8, 2.2);

    // Rebote de luz en el borde inferior del ribete
    ctx.fillStyle = bounceColorGolden(0.7);
    ctx.fillRect(-4, 1.6, 8, 0.6);

    // Sole profile (flat heel when standing on ground)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-4.5, 11, 9, 2);

    ctx.restore();
  }

  private drawMetallicClasp(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    const claspGrad = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 3.5);
    claspGrad.addColorStop(0, '#fef08a');
    claspGrad.addColorStop(0.5, '#eab308');
    claspGrad.addColorStop(1, '#854d0e');
    ctx.fillStyle = claspGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSonicRings(ctx: CanvasRenderingContext2D, spineUndulate: number) {
    ctx.save();
    ctx.translate(0, -42 + spineUndulate);
    const pulse = (Date.now() * 0.008) % 1;
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.85 - pulse * 0.85})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24 + pulse * 32, 8 + pulse * 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private updateAndRenderContrails(
    ctx: CanvasRenderingContext2D,
    anchorX: number,
    anchorY: number,
    scale: number,
    speedKmh: number,
    isMoving: boolean,
    deltaTime: number,
  ) {
    if (isMoving && speedKmh > 35) {
      const bootOffsetY = 36 * scale;
      const bootOffsetX = 8 * scale;
      this.contrailsLeft.push({
        x: anchorX - bootOffsetX,
        y: anchorY + bootOffsetY,
        alpha: 0.65,
        width: 3.5 * scale,
      });
      this.contrailsRight.push({
        x: anchorX + bootOffsetX,
        y: anchorY + bootOffsetY,
        alpha: 0.65,
        width: 3.5 * scale,
      });
    }

    const renderTrailList = (list: ContrailPoint[]) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const pt = list[i];
        pt.y += 3.8 * (speedKmh / 40);
        pt.alpha -= deltaTime * 1.8;
        pt.width += deltaTime * 7;
        if (pt.alpha <= 0) {
          list.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${pt.alpha})`;
        ctx.lineWidth = pt.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x, pt.y + 12);
        ctx.stroke();
        ctx.restore();
      }
    };

    renderTrailList(this.contrailsLeft);
    renderTrailList(this.contrailsRight);
  }

  private renderWindTrails(
    ctx: CanvasRenderingContext2D,
    anchorX: number,
    anchorY: number,
    scale: number,
    speedKmh: number,
    deltaTime: number,
  ) {
    const speedRatio = Math.min(2.5, speedKmh / 50);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2 * scale;
    ctx.lineCap = 'round';

    for (const p of this.windParticles) {
      p.y += p.speed * speedRatio * 1.8;
      if (p.y > 140) {
        p.y = -140;
        p.x = (Math.random() - 0.5) * 280;
      }

      ctx.beginPath();
      ctx.moveTo(anchorX + p.x * scale, anchorY + p.y * scale);
      ctx.lineTo(anchorX + p.x * scale, anchorY + (p.y + p.length * speedRatio) * scale);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderStreetViewCar(
    ctx: CanvasRenderingContext2D,
    isMoving: boolean,
    speedKmh: number,
    turnDir: number,
  ) {
    ctx.save();
    ctx.translate(0, 0);

    const carGrad = ctx.createLinearGradient(-18, 0, 18, 0);
    carGrad.addColorStop(0, '#0284c7');
    carGrad.addColorStop(0.5, '#38bdf8');
    carGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = carGrad;
    ctx.beginPath();
    ctx.roundRect(-18, -14, 36, 28, 6);
    ctx.fill();

    // Camera Rig Tower
    ctx.fillStyle = '#334155';
    ctx.fillRect(-3, -24, 6, 12);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -26, 6, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-20, -12, 4, 8);
    ctx.fillRect(16, -12, 4, 8);
    ctx.fillRect(-20, 6, 4, 8);
    ctx.fillRect(16, 6, 4, 8);

    ctx.restore();
  }
}
