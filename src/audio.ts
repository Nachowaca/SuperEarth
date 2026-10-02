/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Web Audio API synthesizer for Street View Open World game sound effects.
 * Requires zero external audio file downloads.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  constructor() {
    // Sound engine is initialized on first user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Superhero collision impact sound (hit building or hard ground landing)
   */
  public playImpact() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // 1. Heavy low-frequency punch / thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.22);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);

    // 2. Metallic / comic crunch noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(250, t + 0.18);
    filter.Q.setValueAtTime(2.5, t);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
  }

  /**
   * Ring Pass chime (harmonic bell chime for acrobatic flight rings)
   */
  public playRingPassed(combo: number = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const baseNote = 440 * Math.pow(2, (Math.min(combo, 5) - 1) * 0.16); // Scales with combo!
    const harmonics = [baseNote, baseNote * 1.25, baseNote * 1.5, baseNote * 2.0];
    const t = this.ctx.currentTime;

    harmonics.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.04);

      gain.gain.setValueAtTime(0, t + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.04 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.42);
    });
  }

  /**
   * Sonic Boom / Turbo Dash sound effect
   */
  public playTurboBoost() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Sub-bass boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(180, t);
    subOsc.frequency.exponentialRampToValueAtTime(45, t + 0.35);
    subGain.gain.setValueAtTime(0.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.42);

    // Jet whoosh rush
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.45);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3500, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.45);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.46);
  }

  /**
   * Acrobatic Stunt / Barrel Roll swirl whoosh
   */
  public playStuntSpin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.linearRampToValueAtTime(580, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.38);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(1400, t + 0.18);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.38);
    filter.Q.setValueAtTime(1.8, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  /**
   * Sound of a footsteps on pavement / asphalt
   */
  public playStep(isLeft: boolean = true) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isLeft ? 85 : 75, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  /**
   * Camera shutter click + flash sound when Street View captures a photo
   */
  public playCameraShutter() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Click 1 (Mirror flip)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(1400, t);
    osc1.frequency.exponentialRampToValueAtTime(200, t + 0.04);
    gain1.gain.setValueAtTime(0.25, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.05);

    // Click 2 (Shutter close)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(950, t + 0.07);
    osc2.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    gain2.gain.setValueAtTime(0.3, t + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t + 0.07);
    osc2.stop(t + 0.15);
  }

  /**
   * Pleasant chime when collecting a Street View sphere / milestone
   */
  public playCollectChime() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.06);

      gain.gain.setValueAtTime(0, this.ctx!.currentTime + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx!.currentTime + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(this.ctx!.currentTime + idx * 0.06);
      osc.stop(this.ctx!.currentTime + idx * 0.06 + 0.36);
    });
  }

  /**
   * Cosmic whoosh sound when teleporting to a new world city
   */
  public playTeleportWhoosh() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(650, t + 0.4);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.9);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(2400, t + 0.4);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.9);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 1.0);
  }

  private flightFilter: BiquadFilterNode | null = null;
  private flightNoise: AudioBufferSourceNode | null = null;
  private flightGain: GainNode | null = null;

  /**
   * Superhero wind rushing sound when flying through the sky
   */
  public updateFlightSound(speedKmh: number, isFlying: boolean) {
    if (this.isMuted || !isFlying) {
      if (this.flightGain) {
        this.flightGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      }
      return;
    }
    this.initCtx();
    if (!this.ctx) return;

    if (!this.flightGain) {
      this.flightGain = this.ctx.createGain();
      this.flightGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.flightFilter = this.ctx.createBiquadFilter();
      this.flightFilter.type = 'lowpass';
      this.flightFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

      // Procedural white noise buffer for realistic airflow/wind
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.flightNoise = this.ctx.createBufferSource();
      this.flightNoise.buffer = noiseBuffer;
      this.flightNoise.loop = true;

      this.flightNoise.connect(this.flightFilter);
      this.flightFilter.connect(this.flightGain);
      this.flightGain.connect(this.ctx.destination);
      this.flightNoise.start();
    }

    const targetCutoff = 280 + Math.min(speedKmh * 14, 1800);
    const targetVol = Math.min(0.12, 0.02 + (speedKmh / 150) * 0.08);

    this.flightFilter?.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.1);
    this.flightGain?.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
  }

  /**
   * Gentle electric hum for street car cruise
   */
  public updateEngineHum(speedKmh: number, isDrivingCar: boolean) {
    if (this.isMuted || !isDrivingCar || speedKmh < 1) {
      if (this.engineGain) {
        this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      }
      return;
    }
    this.initCtx();
    if (!this.ctx) return;

    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'triangle';
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    }

    const targetPitch = 60 + Math.min(speedKmh * 1.5, 140);
    const targetVol = Math.min(0.08, 0.02 + (speedKmh / 100) * 0.06);

    this.engineOsc.frequency.setTargetAtTime(targetPitch, this.ctx.currentTime, 0.1);
    this.engineGain?.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
  }
}

export const sound = new SoundEngine();
