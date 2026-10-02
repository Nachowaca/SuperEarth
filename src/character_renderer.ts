/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AvatarMode } from './game_types';
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
    cameraRangeMeters: number = 220,
    cameraMode: string = 'third_person',
    deltaTime: number = 0.016,
    verticalIntent: number = 0,
  ) {
    const w = this.canvas.width / (Math.min(window.devicePixelRatio || 1, 2.5));
    const h = this.canvas.height / (Math.min(window.devicePixelRatio || 1, 2.5));
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    if (cameraMode === 'first_person') {
      this.pose.visible = false;
      return;
    }

    // Dynamic Scale according to camera distance
    let viewScale = 1.0;
    if (cameraRangeMeters < 20) {
      viewScale = 1.85; // Close-up: prominent comic cape, backpack, arms
    } else if (cameraRangeMeters > 100) {
      // Sky view standard: clean readable cartoon silhouette
      const droneRatio = Math.max(0.42, 1 - (cameraRangeMeters - 70) / 220);
      viewScale = Math.max(0.42, Math.min(0.68, droneRatio));
    } else {
      viewScale = 1.45 - (cameraRangeMeters - 20) * 0.009;
      viewScale = Math.max(0.7, Math.min(1.45, viewScale));
    }

    // Pivot axis at exact center of body
    const anchorX = w / 2;
    const anchorY = h * 0.50;

    // Elegant Transition between Stand (Imagen 2) and Flying Overhead (Imagen 1)
    const targetPose = isMoving && speedKmh > 1.2 ? 1.0 : 0.0;
    const poseSpeed = targetPose > this.flightPoseProgress ? 4.8 : 3.6;
    this.flightPoseProgress += (targetPose - this.flightPoseProgress) * Math.min(1, poseSpeed * deltaTime);
    const t = Math.max(0, Math.min(1, this.flightPoseProgress));
    const smoothFlightPose = t * t * (3 - 2 * t);

    // Flight kinematics
    const flightSpeedFactor = Math.min(2.8, Math.max(0.7, speedKmh / 22));
    this.flightPhase += deltaTime * (isMoving ? 4.8 * flightSpeedFactor : 1.8);
    this.capePhase += deltaTime * (isMoving ? 16 * flightSpeedFactor : 4.5);

    // Levitation hover bobbing
    this.hoverBob = Math.sin(this.flightPhase) * (isMoving ? 2.2 : 3.8);

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

    // Centrifugal cape lag during turns
    const targetCentrifugal = -turnDirection * (isMoving ? 16 : 5) * smoothFlightPose;
    this.turnCentrifugal += (targetCentrifugal - this.turnCentrifugal) * Math.min(1, 7 * deltaTime);

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
    // SOMBRA CON SILUETA DE SUPERHÉROE SEGÚN DISTANCIA (Referencia Imagen 1)
    // ========================================================
    this.renderSuperheroProjectedShadow(
      ctx,
      anchorX,
      anchorY,
      viewScale,
      cameraRangeMeters,
      smoothFlightPose,
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
   * Renders the dynamic ground shadow with the superhero silhouette (Referencia Imagen 1):
   * - Close/Ground: Crisp, dark silhouette of the hero with cape and outstretched arms.
   * - Sky/High Altitude: Soft diffused penumbra that expands and fades with atmospheric scattering.
   */
  private renderSuperheroProjectedShadow(
    ctx: CanvasRenderingContext2D,
    anchorX: number,
    anchorY: number,
    viewScale: number,
    cameraRangeMeters: number,
    flightPose: number,
  ) {
    const altitudeNorm =
      Math.min(1, Math.max(0, (cameraRangeMeters - 14) / 160)) +
      Math.min(0.5, Math.abs(this.altitudeBoost) / 30);

    const shadowDistY = (40 + altitudeNorm * 80) * viewScale;
    const shadowRadiusX = (22 + altitudeNorm * 42) * viewScale;
    const shadowRadiusY = (9 + altitudeNorm * 18) * viewScale;
    const shadowAlpha = Math.max(0.08, 0.60 - altitudeNorm * 0.42);
    const shadowOffsetX = -8 * (1 + altitudeNorm * 0.5) * viewScale;

    ctx.save();
    ctx.translate(anchorX + shadowOffsetX, anchorY + shadowDistY);

    // Soft outer penumbra
    ctx.save();
    ctx.scale(1, shadowRadiusY / shadowRadiusX);
    const penumbraGrad = ctx.createRadialGradient(0, 0, shadowRadiusX * 0.2, 0, 0, shadowRadiusX);
    penumbraGrad.addColorStop(0, `rgba(15, 23, 42, ${shadowAlpha * 0.75})`);
    penumbraGrad.addColorStop(0.4, `rgba(15, 23, 42, ${shadowAlpha * 0.45})`);
    penumbraGrad.addColorStop(0.75, `rgba(15, 23, 42, ${shadowAlpha * 0.16})`);
    penumbraGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = penumbraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, shadowRadiusX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Projected superhero silhouette core (Referencia Imagen 1: brazos alzados + capa + torso + piernas)
    if (altitudeNorm < 0.8) {
      const silScale = (1 - altitudeNorm * 0.45) * viewScale;
      ctx.save();
      ctx.scale(silScale * 0.65, silScale * 0.45);
      ctx.fillStyle = `rgba(10, 18, 36, ${shadowAlpha * 0.85})`;

      ctx.beginPath();
      // Head
      ctx.arc(0, -22, 6, 0, Math.PI * 2);

      // Arms: When flying, projected overhead fists (Imagen 1)
      if (flightPose > 0.3) {
        ctx.rect(-10, -42, 4.5, 24);
        ctx.rect(5.5, -42, 4.5, 24);
      } else {
        ctx.rect(-18, -14, 5, 20);
        ctx.rect(13, -14, 5, 20);
      }

      // Torso & Cape flare
      ctx.moveTo(-12, -14);
      ctx.lineTo(12, -14);
      ctx.lineTo(16, 12);
      ctx.lineTo(-16, 12);
      ctx.closePath();

      // Legs
      ctx.rect(-8, 12, 5, 22);
      ctx.rect(3, 12, 5, 22);
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
  ) {
    const isHighSpeed = isMoving && speedKmh > 55;

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

    // Comic Red Trunks / Hips (y = 0 a +9)
    const trunkGrad = ctx.createLinearGradient(0, -1, 0, 10);
    trunkGrad.addColorStop(0, '#b91c1c');
    trunkGrad.addColorStop(0.5, '#dc2626');
    trunkGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = trunkGrad;
    ctx.beginPath();
    ctx.roundRect(-10.5, 0, 21, 10, 2.5);
    ctx.fill();

    // Golden Metallic Champion Belt (Exactamente en la cintura: y = -3 a +3)
    const beltGrad = ctx.createLinearGradient(-11, 0, 11, 0);
    beltGrad.addColorStop(0, '#ca8a04');
    beltGrad.addColorStop(0.3, '#fef08a');
    beltGrad.addColorStop(0.6, '#eab308');
    beltGrad.addColorStop(1, '#a16207');
    ctx.fillStyle = beltGrad;
    ctx.fillRect(-11, -3, 22, 5.5);

    // Belt Buckle (Hebilla dorada en el ombligo 0,0)
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-3, -4, 6, 7.5);
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -4, 6, 7.5);

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
    this.drawCartoonLeg(ctx, 7, 28, '#1d4ed8', '#1e40af');
    this.drawCartoonRedBoot(ctx, 0, 26, flightPose);
    ctx.restore();

    // Right Leg
    ctx.save();
    const rightAngle = ((2.5 * (1 - flightPose) + (8 + legFlutterRight) * flightPose) * Math.PI) / 180;
    ctx.translate(6.5, 0);
    ctx.rotate(rightAngle);
    this.drawCartoonLeg(ctx, 7, 28, '#2563eb', '#1d4ed8');
    this.drawCartoonRedBoot(ctx, 0, 26, flightPose);
    ctx.restore();

    ctx.restore();

    // ========================================================
    // 3. CAPA ROJA VIBRANTE (Sale de los hombros y cae pasando la cintura)
    // ========================================================
    this.drawCartoonCape(ctx, isMoving, speedKmh, this.turnCentrifugal, pitch, flightPose);

    // ========================================================
    // 4. TORSO (Triángulo muscular que sube desde la cintura y=0 a hombros y=-24)
    // ========================================================
    ctx.save();
    ctx.translate(0, spineUndulate * 0.4);

    // Comic Suit Gradients
    const suitGrad = ctx.createLinearGradient(-14, 0, 14, 0);
    suitGrad.addColorStop(0, '#1e3a8a');
    suitGrad.addColorStop(0.25, '#1d4ed8');
    suitGrad.addColorStop(0.5, '#2563eb');
    suitGrad.addColorStop(0.75, '#1d4ed8');
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
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
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

    // Rim highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(13, -22);
    ctx.lineTo(9, -2);
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
      this.drawCartoonTravelerBackpack(ctx, isMoving, speedKmh);
    }
    ctx.restore();

    // ========================================================
    // 6. BRAZOS Y GUANTES ROJOS (Manos en jarra sobre la cintura en parado)
    // ========================================================
    ctx.save();
    ctx.translate(0, spineUndulate * 0.4);
    // Right Arm
    this.drawCartoonArm(ctx, true, flightPose, isHighSpeed, pitch);
    // Left Arm
    this.drawCartoonArm(ctx, false, flightPose, isHighSpeed, pitch);
    ctx.restore();

    // ========================================================
    // 7. CUELLO, CABEZA Y PEINADO COMIC (Arriba de los hombros: y = -34)
    // ========================================================
    ctx.save();
    const headReachOffset = (pitch < 0 ? -6 : 0) * flightPose;
    ctx.translate(0, -32 + spineUndulate * 0.4 + headReachOffset * 0.5);
    // La cabeza lidera la rotación axial en su eje primero
    ctx.rotate(this.bodyYaw * 0.65 + turnDirection * 0.1 * flightPose);

    // Muscular Neck with Warm Skin Tone
    const neckGrad = ctx.createLinearGradient(-4, 0, 4, 0);
    neckGrad.addColorStop(0, '#d97706');
    neckGrad.addColorStop(0.5, '#f59e0b');
    neckGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(-4, 2);
    ctx.lineTo(4, 2);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();

    // Stylized Comic Hair (Black with crisp comic quiff - Imagen 2)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, -1, 10.5, 0, Math.PI * 2);
    ctx.fill();

    // Classic Comic Hair Wave & Silhouette
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-2, -3, 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(-2, -12); // Comic hair peak
    ctx.lineTo(3, -9);
    ctx.lineTo(7, -7);
    ctx.closePath();
    ctx.fill();

    // Cape Clasps on Shoulders
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
   */
  private drawCartoonArm(
    ctx: CanvasRenderingContext2D,
    isRight: boolean,
    flightPose: number,
    isHighSpeed: boolean,
    pitch: number,
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
    upperGrad.addColorStop(0, '#1e3a8a');
    upperGrad.addColorStop(0.5, '#2563eb');
    upperGrad.addColorStop(1, '#1d4ed8');
    ctx.strokeStyle = upperGrad;
    ctx.lineWidth = 7.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.stroke();

    // Comic contour stroke
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.lineWidth = 1;
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

    // Vibrant Red Gauntlet Glove
    const gloveGrad = ctx.createLinearGradient(gloveStartX, gloveStartY, handX, handY);
    gloveGrad.addColorStop(0, '#b91c1c');
    gloveGrad.addColorStop(0.4, '#dc2626');
    gloveGrad.addColorStop(0.8, '#ef4444');
    gloveGrad.addColorStop(1, '#991b1b');
    ctx.strokeStyle = gloveGrad;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(gloveStartX, gloveStartY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Gauntlet gold/leather trim ring at cuff
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(gloveStartX, gloveStartY, 3.8, 0, Math.PI * 2);
    ctx.stroke();

    // --- Clenched Superhero Fist ---
    ctx.save();
    ctx.translate(handX, handY);

    if (flightPose > 0.4) {
      // Clenched fist punching skyward
      const fistGrad = ctx.createRadialGradient(0, -1, 0.5, 0, 0, 5);
      fistGrad.addColorStop(0, '#f87171');
      fistGrad.addColorStop(0.4, '#ef4444');
      fistGrad.addColorStop(1, '#991b1b');
      ctx.fillStyle = fistGrad;
      ctx.beginPath();
      ctx.roundRect(-4, -5.5, 8, 7.5, 2.5);
      ctx.fill();

      // Knuckle inking lines
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

      if (isHighSpeed) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(0, -7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Clenched fist on hip (waist y = 0)
      const fistGrad = ctx.createRadialGradient(-side * 1, -1, 0.5, 0, 0, 4.5);
      fistGrad.addColorStop(0, '#f87171');
      fistGrad.addColorStop(0.5, '#dc2626');
      fistGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = fistGrad;
      ctx.beginPath();
      ctx.roundRect(-side * 3, -3, 6, 6, 2.5);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }

  /**
   * Cartoon / Comic Book Style Cape:
   * Bold, vibrant red cape with sweeping curves, attached at shoulders (y = -22).
   */
  private drawCartoonCape(
    ctx: CanvasRenderingContext2D,
    isMoving: boolean,
    speedKmh: number,
    turnCentrifugal: number,
    pitch: number,
    flightPose: number,
  ) {
    ctx.save();
    ctx.translate(0, -22); // Sale directamente desde los hombros

    const wave = this.capePhase;
    const sideBillow = (1 - flightPose) * 14 + turnCentrifugal * 0.8;
    const flapAmp = (isMoving ? 8 + Math.min(14, speedKmh / 16) : 3.0) * (0.35 + 0.65 * flightPose);
    const capeLength = isMoving ? 56 + (12 + Math.min(24, speedKmh / 7)) * flightPose : 52;
    const pitchLift = pitch * 12 * flightPose;

    const w1 = Math.sin(wave) * flapAmp + sideBillow * 0.4;
    const w2 = Math.sin(wave + 1.2) * (flapAmp * 1.2) + sideBillow * 0.7;
    const w3 = Math.sin(wave + 2.4) * flapAmp + sideBillow;

    // Vibrant Comic Red Gradient
    const capeGrad = ctx.createLinearGradient(0, -6, sideBillow * 0.5, capeLength);
    capeGrad.addColorStop(0, '#991b1b');
    capeGrad.addColorStop(0.3, '#dc2626');
    capeGrad.addColorStop(0.65, '#ef4444');
    capeGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = capeGrad;

    // Outer Cape Outline
    ctx.beginPath();
    ctx.moveTo(-13, 0); // Left shoulder
    ctx.lineTo(13, 0); // Right shoulder
    // Right billow edge
    ctx.bezierCurveTo(
      18 + w1 * 0.5,
      capeLength * 0.35 - pitchLift * 0.4,
      24 + w2 + sideBillow * 0.8,
      capeLength * 0.7 - pitchLift * 0.8,
      22 + w3 + sideBillow,
      capeLength - pitchLift,
    );
    // Bottom cape edge
    ctx.quadraticCurveTo(0, capeLength + w2 * 0.3 - pitchLift, -12 + w1, capeLength * 0.95 - pitchLift);
    // Left billow edge
    ctx.bezierCurveTo(
      -18 + w1 * 0.3,
      capeLength * 0.7 - pitchLift * 0.7,
      -16,
      capeLength * 0.35 - pitchLift * 0.3,
      -13,
      0,
    );
    ctx.closePath();
    ctx.fill();

    // Comic edge outline
    ctx.strokeStyle = 'rgba(69, 10, 10, 0.4)';
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
  ) {
    // Shoulder Harness with Buckles
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-10, -12, 3.5, 16);
    ctx.fillRect(6.5, -12, 3.5, 16);

    ctx.fillStyle = '#eab308'; // Gold buckles
    ctx.fillRect(-10, -2, 3.5, 2.5);
    ctx.fillRect(6.5, -2, 3.5, 2.5);

    // Main Backpack Body (Canvas with Comic Inking)
    const packGrad = ctx.createLinearGradient(-9, 0, 9, 0);
    packGrad.addColorStop(0, '#065f46');
    packGrad.addColorStop(0.4, '#059669');
    packGrad.addColorStop(1, '#047857');
    ctx.fillStyle = packGrad;
    ctx.beginPath();
    ctx.roundRect(-9, -8, 18, 20, 4);
    ctx.fill();

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

    // Top Rolled Leather Sleeping Pad (Petate de cuero)
    const rollGrad = ctx.createLinearGradient(-10, -12, 10, -12);
    rollGrad.addColorStop(0, '#92400e');
    rollGrad.addColorStop(0.5, '#d97706');
    rollGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = rollGrad;
    ctx.beginPath();
    ctx.roundRect(-10, -13, 20, 6.5, 2.5);
    ctx.fill();

    // Leather straps
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-6.5, -14, 2, 8);
    ctx.fillRect(4.5, -14, 2, 8);

    // Brushed steel travel canteen
    const flaskGrad = ctx.createLinearGradient(7, -2, 11, -2);
    flaskGrad.addColorStop(0, '#94a3b8');
    flaskGrad.addColorStop(0.4, '#f8fafc');
    flaskGrad.addColorStop(1, '#475569');
    ctx.fillStyle = flaskGrad;
    ctx.beginPath();
    ctx.roundRect(7.5, -2, 3.5, 11, 1.5);
    ctx.fill();
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
  ) {
    const grad = ctx.createLinearGradient(0, 0, 0, length);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(0.7, colorBottom);
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-width / 2, 0, width, length, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawCartoonRedBoot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    flightPose: number,
  ) {
    ctx.save();
    ctx.translate(x, y);

    // Comic Red Superhero Boot (Imagen 2)
    const bootGrad = ctx.createLinearGradient(-4, 0, 4, 0);
    bootGrad.addColorStop(0, '#b91c1c');
    bootGrad.addColorStop(0.4, '#ef4444');
    bootGrad.addColorStop(0.8, '#dc2626');
    bootGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = bootGrad;
    ctx.beginPath();
    ctx.roundRect(-4, 0, 8, 12, 2.5);
    ctx.fill();

    // Metallic Golden Trim Cuff
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-4, 0, 8, 2.2);

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
