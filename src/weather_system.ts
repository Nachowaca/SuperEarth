/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeatherCondition = 'rain' | 'snow' | 'fog' | 'clear';

export interface WeatherInfo {
  condition: WeatherCondition;
  name: string;
  icon: string;
  description: string;
  ambientTone: string;
}

export const WEATHER_METADATA: Record<WeatherCondition, WeatherInfo> = {
  rain: {
    condition: 'rain',
    name: 'Lluvia',
    icon: '🌧️',
    description: 'Gotas dinámicas, estelas de viento y ambiente húmedo',
    ambientTone: 'Llovizna y lluvia constante',
  },
  snow: {
    condition: 'snow',
    name: 'Nieve',
    icon: '❄️',
    description: 'Copos flotantes, viento alpino y brisa helada',
    ambientTone: 'Viento gélido y susurro de nieve',
  },
  fog: {
    condition: 'fog',
    name: 'Niebla',
    icon: '🌫️',
    description: 'Bruma atmosférica volumétrica y visibilidad atenuada',
    ambientTone: 'Bruma marina y drone de baja frecuencia',
  },
  clear: {
    condition: 'clear',
    name: 'Despejado',
    icon: '☀️',
    description: 'Cielo limpio, rayos dorados y partículas solares',
    ambientTone: 'Viento suave a gran altitud',
  },
};

/**
 * Default characteristic weather for each city
 */
export const CITY_DEFAULT_WEATHER: Record<string, WeatherCondition> = {
  // Rain
  'london': 'rain',
  'londres': 'rain',
  'bogotá': 'rain',
  'bogota': 'rain',
  'paris': 'rain',
  'parís': 'rain',

  // Snow
  'santiago': 'snow',
  'tokyo': 'snow',
  'tokio': 'snow',

  // Fog / Mist
  'lima': 'fog',
  'río de janeiro': 'fog',
  'rio de janeiro': 'fog',
  'rio': 'fog',

  // Clear / Sunny
  'buenos aires': 'clear',
  'madrid': 'clear',
  'ciudad de méxico': 'clear',
  'cdmx': 'clear',
  'barcelona': 'clear',
  'roma': 'clear',
  'rome': 'clear',
  'new york': 'clear',
  'nueva york': 'clear',
  'sydney': 'clear',
};

export function getWeatherForCity(city: string): WeatherCondition {
  const normalized = (city || '').toLowerCase().trim();
  for (const [key, weather] of Object.entries(CITY_DEFAULT_WEATHER)) {
    if (normalized.includes(key)) {
      return weather;
    }
  }
  return 'clear';
}

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
  thickness: number;
  z: number;
}

interface RainSplash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface ScreenDroplet {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  life: number;
  speedY: number;
}

interface SnowFlake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  wobbleSpeed: number;
  wobblePhase: number;
  wobbleAmp: number;
  alpha: number;
}

interface FogPuff {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface SunMote {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  alpha: number;
  pulsePhase: number;
}

/**
 * Dynamic Weather Particle System
 * Simulates high-performance Rain, Snow, Fog, and Clear conditions
 * Reacts dynamically to superhero movement speed, turn velocity, and camera zoom.
 */
export class WeatherParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentCondition: WeatherCondition = 'clear';

  // Particles
  private rainDrops: RainDrop[] = [];
  private rainSplashes: RainSplash[] = [];
  private screenDroplets: ScreenDroplet[] = [];
  private snowFlakes: SnowFlake[] = [];
  private fogPuffs: FogPuff[] = [];
  private sunMotes: SunMote[] = [];

  // Wind and camera dynamics
  private windAngle: number = 0;
  private targetWindAngle: number = 0;
  private visibilityAlpha: number = 0;
  private targetVisibilityAlpha: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Could not get 2D context for WeatherParticleSystem');
    }
    this.ctx = context;
    this.resize();
    this.initParticles();
  }

  public resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
  }

  public setCondition(condition: WeatherCondition) {
    if (this.currentCondition === condition) return;
    this.currentCondition = condition;

    // Reset or reseed specific condition particles smoothly
    if (condition === 'rain' && this.rainDrops.length === 0) {
      this.initRain();
    } else if (condition === 'snow' && this.snowFlakes.length === 0) {
      this.initSnow();
    } else if (condition === 'fog' && this.fogPuffs.length === 0) {
      this.initFog();
    } else if (condition === 'clear' && this.sunMotes.length === 0) {
      this.initClear();
    }
  }

  public getCondition(): WeatherCondition {
    return this.currentCondition;
  }

  private initParticles() {
    this.initRain();
    this.initSnow();
    this.initFog();
    this.initClear();
  }

  private initRain() {
    const count = 160;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.rainDrops = [];
    for (let i = 0; i < count; i++) {
      this.rainDrops.push({
        x: Math.random() * (w + 200) - 100,
        y: Math.random() * h,
        length: 16 + Math.random() * 24,
        speed: 650 + Math.random() * 550,
        alpha: 0.35 + Math.random() * 0.45,
        thickness: 1.0 + Math.random() * 1.4,
        z: 0.5 + Math.random() * 0.5,
      });
    }
  }

  private initSnow() {
    const count = 120;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.snowFlakes = [];
    for (let i = 0; i < count; i++) {
      this.snowFlakes.push({
        x: Math.random() * (w + 100) - 50,
        y: Math.random() * h,
        radius: 1.6 + Math.random() * 3.4,
        speedY: 45 + Math.random() * 75,
        wobbleSpeed: 1.5 + Math.random() * 3.0,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 15 + Math.random() * 35,
        alpha: 0.45 + Math.random() * 0.5,
      });
    }
  }

  private initFog() {
    const count = 28;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.fogPuffs = [];
    for (let i = 0; i < count; i++) {
      this.fogPuffs.push({
        x: Math.random() * (w + 400) - 200,
        y: Math.random() * h,
        radius: 110 + Math.random() * 180,
        speedX: (Math.random() - 0.5) * 14 + 8,
        speedY: (Math.random() - 0.5) * 6,
        alpha: 0.08 + Math.random() * 0.12,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.4 + Math.random() * 0.8,
      });
    }
  }

  private initClear() {
    const count = 35;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.sunMotes = [];
    for (let i = 0; i < count; i++) {
      this.sunMotes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: 1.2 + Math.random() * 2.2,
        speedX: (Math.random() - 0.5) * 12,
        speedY: -10 - Math.random() * 18,
        alpha: 0.2 + Math.random() * 0.4,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Main simulation and render step
   */
  public updateAndRender(
    deltaTime: number,
    speedKmh: number,
    turnDirection: number,
    cameraRangeMeters: number = 220,
  ) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Dynamic Wind slant calculation based on character speed and turning
    // When flying fast, weather streaks angle backward; turning shears the rain/snow sideways
    const speedRatio = Math.min(1.5, speedKmh / 80);
    this.targetWindAngle = turnDirection * -0.32 - speedRatio * 0.22;
    this.windAngle += (this.targetWindAngle - this.windAngle) * Math.min(1, 5 * deltaTime);

    // Atmospheric Visibility Attenuation (Sutil reducción de visibilidad según clima)
    this.renderAtmosphericVisibility(ctx, w, h, deltaTime);

    // Render weather particle layer
    switch (this.currentCondition) {
      case 'rain':
        this.renderRain(ctx, w, h, deltaTime, speedKmh);
        break;
      case 'snow':
        this.renderSnow(ctx, w, h, deltaTime, speedKmh);
        break;
      case 'fog':
        this.renderFog(ctx, w, h, deltaTime);
        break;
      case 'clear':
        this.renderClear(ctx, w, h, deltaTime);
        break;
    }
  }

  /**
   * Subtle atmospheric visibility overlay (veiling haze that changes tone without blocking the map)
   */
  private renderAtmosphericVisibility(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    deltaTime: number,
  ) {
    let targetAlpha = 0;
    let overlayColor = 'rgba(15, 23, 42, 0.12)';

    if (this.currentCondition === 'rain') {
      targetAlpha = 0.22; // Soft cool gray/slate haze
      overlayColor = 'rgba(15, 23, 42, 0.18)';
    } else if (this.currentCondition === 'snow') {
      targetAlpha = 0.16; // Crisp pale-blue frost
      overlayColor = 'rgba(224, 242, 254, 0.14)';
    } else if (this.currentCondition === 'fog') {
      targetAlpha = 0.35; // Dense atmospheric mist
      overlayColor = 'rgba(215, 226, 236, 0.28)';
    } else {
      targetAlpha = 0.04; // Golden sunlight sheen
      overlayColor = 'rgba(254, 240, 138, 0.05)';
    }

    this.visibilityAlpha += (targetAlpha - this.visibilityAlpha) * Math.min(1, 3 * deltaTime);

    if (this.visibilityAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.visibilityAlpha;
      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, w, h);

      // Gradient horizon depth cue for Fog & Rain
      if (this.currentCondition === 'fog') {
        const fogHorizon = ctx.createLinearGradient(0, 0, 0, h * 0.65);
        fogHorizon.addColorStop(0, 'rgba(203, 213, 225, 0.35)');
        fogHorizon.addColorStop(0.5, 'rgba(226, 232, 240, 0.20)');
        fogHorizon.addColorStop(1, 'rgba(241, 245, 249, 0)');
        ctx.fillStyle = fogHorizon;
        ctx.fillRect(0, 0, w, h * 0.65);
      } else if (this.currentCondition === 'snow') {
        // Soft frost vignette at borders
        const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.7);
        vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
        vignette.addColorStop(1, 'rgba(224, 242, 254, 0.22)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    }
  }

  /**
   * Renders dynamic falling rain streaks, splashes, and camera lens droplets
   */
  private renderRain(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    deltaTime: number,
    speedKmh: number,
  ) {
    ctx.save();

    const slantX = Math.sin(this.windAngle) * 35;
    const speedBoost = 1 + Math.min(1.2, speedKmh / 100);

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.7)';
    ctx.lineCap = 'round';

    for (let i = 0; i < this.rainDrops.length; i++) {
      const drop = this.rainDrops[i];
      drop.y += drop.speed * speedBoost * deltaTime;
      drop.x += slantX * deltaTime * 12;

      // Wrap around screen
      if (drop.y > h + 30) {
        drop.y = -30;
        drop.x = Math.random() * (w + 200) - 100;

        // Occasional splash near bottom
        if (Math.random() < 0.2) {
          this.rainSplashes.push({
            x: drop.x,
            y: h - Math.random() * 60,
            radius: 2,
            maxRadius: 6 + Math.random() * 8,
            alpha: 0.6,
          });
        }
      }
      if (drop.x < -100) drop.x = w + 50;
      if (drop.x > w + 100) drop.x = -50;

      // Draw streak
      ctx.beginPath();
      ctx.globalAlpha = drop.alpha * drop.z;
      ctx.lineWidth = drop.thickness * drop.z;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - slantX * 0.4, drop.y - drop.length * drop.z * speedBoost * 0.6);
      ctx.stroke();
    }

    // Ground & building splashes
    for (let i = this.rainSplashes.length - 1; i >= 0; i--) {
      const splash = this.rainSplashes[i];
      splash.radius += (splash.maxRadius - splash.radius) * Math.min(1, 12 * deltaTime);
      splash.alpha -= deltaTime * 2.8;

      if (splash.alpha <= 0) {
        this.rainSplashes.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.globalAlpha = splash.alpha * 0.7;
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.8)';
      ctx.lineWidth = 1;
      ctx.ellipse(splash.x, splash.y, splash.radius, splash.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Occasional camera lens droplets (gotas en la pantalla)
    if (Math.random() < 0.03 && this.screenDroplets.length < 12) {
      this.screenDroplets.push({
        x: Math.random() * w,
        y: Math.random() * (h * 0.8),
        radius: 2.5 + Math.random() * 4,
        alpha: 0.6 + Math.random() * 0.3,
        life: 2.0 + Math.random() * 2.5,
        speedY: 8 + Math.random() * 14,
      });
    }

    for (let i = this.screenDroplets.length - 1; i >= 0; i--) {
      const drop = this.screenDroplets[i];
      drop.life -= deltaTime;
      drop.y += drop.speedY * deltaTime;
      drop.alpha = Math.min(drop.alpha, drop.life * 0.4);

      if (drop.life <= 0) {
        this.screenDroplets.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.globalAlpha = drop.alpha;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
      ctx.fill();

      // Droplet refraction rim
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Renders fluttering snowflakes with individual drift, inertia & aerodynamic wake
   */
  private renderSnow(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    deltaTime: number,
    speedKmh: number,
  ) {
    ctx.save();

    const speedBoost = 1 + Math.min(1.0, speedKmh / 120);
    const slantX = Math.sin(this.windAngle) * 45;

    for (let i = 0; i < this.snowFlakes.length; i++) {
      const flake = this.snowFlakes[i];
      flake.wobblePhase += flake.wobbleSpeed * deltaTime;
      const wobbleX = Math.sin(flake.wobblePhase) * flake.wobbleAmp * 0.2;

      flake.y += flake.speedY * speedBoost * deltaTime;
      flake.x += (slantX + wobbleX) * deltaTime * 3.5;

      if (flake.y > h + 15) {
        flake.y = -15;
        flake.x = Math.random() * (w + 100) - 50;
      }
      if (flake.x < -60) flake.x = w + 40;
      if (flake.x > w + 60) flake.x = -40;

      ctx.beginPath();
      ctx.globalAlpha = flake.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      ctx.fill();

      // Soft glow for larger flakes
      if (flake.radius > 3.0) {
        ctx.beginPath();
        ctx.globalAlpha = flake.alpha * 0.35;
        ctx.fillStyle = '#bae6fd';
        ctx.arc(flake.x, flake.y, flake.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Renders drifting volumetric fog puffs for coastal and mountain mist
   */
  private renderFog(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    deltaTime: number,
  ) {
    ctx.save();

    for (let i = 0; i < this.fogPuffs.length; i++) {
      const puff = this.fogPuffs[i];
      puff.pulsePhase += puff.pulseSpeed * deltaTime;
      const dynamicRadius = puff.radius * (0.88 + Math.sin(puff.pulsePhase) * 0.12);

      puff.x += puff.speedX * deltaTime;
      puff.y += puff.speedY * deltaTime;

      if (puff.x > w + puff.radius * 2) {
        puff.x = -puff.radius * 2;
        puff.y = Math.random() * h;
      }
      if (puff.x < -puff.radius * 2) {
        puff.x = w + puff.radius * 2;
        puff.y = Math.random() * h;
      }

      const grad = ctx.createRadialGradient(
        puff.x,
        puff.y,
        0,
        puff.x,
        puff.y,
        dynamicRadius,
      );
      grad.addColorStop(0, `rgba(226, 232, 240, ${puff.alpha * 1.4})`);
      grad.addColorStop(0.5, `rgba(241, 245, 249, ${puff.alpha * 0.8})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Renders warm sunbeam motes and clear skies atmosphere
   */
  private renderClear(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    deltaTime: number,
  ) {
    ctx.save();

    for (let i = 0; i < this.sunMotes.length; i++) {
      const mote = this.sunMotes[i];
      mote.pulsePhase += 1.8 * deltaTime;
      mote.x += mote.speedX * deltaTime;
      mote.y += mote.speedY * deltaTime;

      if (mote.y < -10) {
        mote.y = h + 10;
        mote.x = Math.random() * w;
      }
      if (mote.x < -10) mote.x = w + 10;
      if (mote.x > w + 10) mote.x = -10;

      const dynamicAlpha = mote.alpha * (0.6 + Math.sin(mote.pulsePhase) * 0.4);

      ctx.beginPath();
      ctx.globalAlpha = dynamicAlpha;
      ctx.fillStyle = '#fef08a';
      ctx.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
