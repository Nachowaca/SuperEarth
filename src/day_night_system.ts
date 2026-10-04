/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DayNightPeriod = 'sunrise' | 'day' | 'sunset' | 'night';

export interface DayNightState {
  localHour: number; // 0.0 to 24.0
  period: DayNightPeriod;
  periodLabel: string;
  periodIcon: string;
  sunAltitudeDeg: number; // -90 to +90
  sunAzimuthDeg: number;
  lightFactor: number; // 0.15 (deep night) to 1.0 (noon)
  ambientTintRgba: string;
  overlayBlendMode: string;
  overlayCss: string;
  cityWindowLightAlpha: number; // 0 (day) to 0.85 (night)
  isAutoLocalTime: boolean;
  timeString: string;
  timeZoneOffsetHours: number;
}

/**
 * Calculates solar day-night cycle, astronomical sun angles, and 3D architectural lighting
 * based on the real destination coordinates and current time, with Time-Shift capabilities.
 */
export class DayNightSystem {
  private isAuto: boolean = true;
  private manualHour: number = 14.5; // 2:30 PM default when manual
  private currentLat: number = -34.6037;
  private currentLng: number = -58.3816;

  constructor() {
    this.update(-34.6037, -58.3816);
  }

  public setAutoLocalTime(auto: boolean) {
    this.isAuto = auto;
  }

  public getIsAuto(): boolean {
    return this.isAuto;
  }

  public setManualHour(hour: number) {
    this.isAuto = false;
    this.manualHour = Math.max(0, Math.min(23.99, hour));
  }

  public getManualHour(): number {
    return this.manualHour;
  }

  /**
   * Calculates local solar / timezone time for coordinates
   */
  public getLocalHourForCoordinates(lat: number, lng: number): number {
    if (!this.isAuto) {
      return this.manualHour;
    }
    const now = new Date();
    // UTC time in fractional hours
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    // Offset in hours based on longitude (15 degrees = 1 hour)
    const offsetHours = lng / 15.0;
    let localHours = (utcHours + offsetHours) % 24;
    if (localHours < 0) localHours += 24;
    return localHours;
  }

  public update(lat: number, lng: number): DayNightState {
    this.currentLat = lat;
    this.currentLng = lng;

    const localHour = this.getLocalHourForCoordinates(lat, lng);
    const hoursInt = Math.floor(localHour);
    const minutesInt = Math.floor((localHour - hoursInt) * 60);
    const timeString = `${hoursInt.toString().padStart(2, '0')}:${minutesInt.toString().padStart(2, '0')}`;
    const timeZoneOffsetHours = Math.round((lng / 15.0) * 10) / 10;

    // Period classification
    let period: DayNightPeriod = 'day';
    let periodLabel = 'Día';
    let periodIcon = '☀️';

    // Solar altitude estimation (simplified solar arc based on local hour and latitude)
    // Noon is hour 12 (sun highest), midnight is hour 0/24 (sun lowest)
    const solarHourAngle = ((localHour - 12) / 12) * Math.PI; // -PI to +PI
    const maxSunAlt = 90 - Math.abs(lat) * 0.5; // Approximation of midday solar peak
    const sunAltitudeDeg = Math.sin(solarHourAngle + Math.PI / 2) * maxSunAlt;
    const sunAzimuthDeg = (localHour / 24) * 360;

    let lightFactor = 1.0;
    let overlayCss = 'transparent';
    let overlayBlendMode = 'normal';
    let ambientTintRgba = 'rgba(255, 255, 255, 1)';
    let cityWindowLightAlpha = 0;

    if (localHour >= 5.5 && localHour < 8.5) {
      // AMANECER / SUNRISE
      period = 'sunrise';
      periodLabel = 'Amanecer';
      periodIcon = '🌅';
      const progress = (localHour - 5.5) / 3.0; // 0 to 1
      lightFactor = 0.4 + progress * 0.45;
      cityWindowLightAlpha = (1 - progress) * 0.4;
      overlayBlendMode = 'color-burn';
      overlayCss = `linear-gradient(180deg, rgba(244, 114, 182, ${0.28 - progress * 0.18}) 0%, rgba(251, 146, 60, ${0.32 - progress * 0.2}) 60%, rgba(14, 165, 233, 0.1) 100%)`;
      ambientTintRgba = `rgba(253, 230, 138, ${lightFactor})`;
    } else if (localHour >= 8.5 && localHour < 17.5) {
      // DÍA / DAY
      period = 'day';
      periodLabel = 'Día';
      periodIcon = '☀️';
      lightFactor = 1.0;
      cityWindowLightAlpha = 0;
      overlayBlendMode = 'normal';
      overlayCss = 'transparent';
      ambientTintRgba = 'rgba(255, 255, 255, 1)';
    } else if (localHour >= 17.5 && localHour < 20.5) {
      // ATARDECER / GOLDEN HOUR & SUNSET
      period = 'sunset';
      periodLabel = 'Atardecer';
      periodIcon = '🌇';
      const progress = (localHour - 17.5) / 3.0; // 0 to 1
      lightFactor = 0.85 - progress * 0.55; // 0.85 down to 0.3
      cityWindowLightAlpha = progress * 0.65;
      overlayBlendMode = 'hard-light';
      overlayCss = `linear-gradient(180deg, rgba(76, 29, 149, ${0.25 + progress * 0.25}) 0%, rgba(234, 88, 12, ${0.38 - progress * 0.1}) 50%, rgba(245, 158, 11, 0.2) 100%)`;
      ambientTintRgba = `rgba(251, 146, 60, ${lightFactor})`;
    } else {
      // NOCHE / NIGHT
      period = 'night';
      periodLabel = 'Noche';
      periodIcon = '🌙';
      // Deepest darkness between 23:00 and 04:00
      lightFactor = 0.22;
      cityWindowLightAlpha = 0.85;
      overlayBlendMode = 'multiply';
      // Deep midnight indigo that naturally darkens the 3D photorealistic buildings and terrain
      overlayCss = `linear-gradient(180deg, rgba(6, 11, 32, 0.68) 0%, rgba(8, 15, 42, 0.58) 55%, rgba(10, 18, 50, 0.52) 100%)`;
      ambientTintRgba = 'rgba(147, 197, 253, 0.35)'; // Cool moonlight
    }

    return {
      localHour,
      period,
      periodLabel,
      periodIcon,
      sunAltitudeDeg,
      sunAzimuthDeg,
      lightFactor,
      ambientTintRgba,
      overlayBlendMode,
      overlayCss,
      cityWindowLightAlpha,
      isAutoLocalTime: this.isAuto,
      timeString,
      timeZoneOffsetHours,
    };
  }

  public getTimeDisplay(): { timeString: string; periodLabel: string; icon: string; isAuto: boolean } {
    const s = this.update(this.currentLat, this.currentLng);
    return {
      timeString: s.timeString,
      periodLabel: s.periodLabel,
      icon: s.periodIcon,
      isAuto: s.isAutoLocalTime,
    };
  }
}
