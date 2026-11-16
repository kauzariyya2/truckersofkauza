/**
 * Zero-dependency Web Audio API procedural sound engine for heavy diesel trucks,
 * sport coupe petrol engines, manual gear clunks, air-brake hiss, horn, and parking chimes.
 */
export class ProceduralVehicleAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private turboGain: GainNode | null = null;
  private muted = false;
  private running = false;

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.35;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 1.6;

    const eGain = ctx.createGain();
    eGain.gain.value = 0.0;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 38;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 76;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(eGain);
    eGain.connect(master);

    // Subtle diesel turbo spool whistle
    const tOsc = ctx.createOscillator();
    tOsc.type = 'sine';
    tOsc.frequency.value = 1400;
    const tGain = ctx.createGain();
    tGain.gain.value = 0;
    tOsc.connect(tGain);
    tGain.connect(master);

    osc1.start();
    osc2.start();
    tOsc.start();

    this.ctx = ctx;
    this.masterGain = master;
    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.turboOsc = tOsc;
    this.engineFilter = filter;
    this.engineGain = eGain;
    this.turboGain = tGain;
    this.running = true;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.35, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateEngine(
    rpm: number,
    idleRpm: number,
    maxRpm: number,
    baseHz: number,
    throttle: number,
    stalled: boolean,
    isHeavyDiesel: boolean,
    active: boolean,
  ): void {
    if (!this.ctx || !this.running || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain || !this.turboOsc || !this.turboGain) {
      return;
    }

    const now = this.ctx.currentTime;
    if (!active || stalled) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.turboGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }

    const norm = Math.max(0, Math.min(1, (rpm - idleRpm * 0.5) / Math.max(1, maxRpm - idleRpm * 0.5)));
    const freq = baseHz * (0.85 + norm * 2.15);

    this.engineOsc1.frequency.setTargetAtTime(freq, now, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(freq * (isHeavyDiesel ? 1.5 : 2.0), now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(
      (isHeavyDiesel ? 180 : 320) + norm * (isHeavyDiesel ? 420 : 980) + throttle * 260,
      now,
      0.05,
    );
    this.engineGain.gain.setTargetAtTime(0.14 + throttle * 0.14 + norm * 0.08, now, 0.05);

    if (isHeavyDiesel) {
      this.turboOsc.frequency.setTargetAtTime(1100 + norm * 1650 + throttle * 350, now, 0.08);
      this.turboGain.gain.setTargetAtTime(Math.max(0, (norm - 0.32) * throttle * 0.025), now, 0.08);
    } else {
      this.turboGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  public playGearShift(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.065);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playAirBrakeHiss(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(now);
  }

  public playHorn(isTruck: boolean): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = isTruck ? [185, 233] : [410, 515];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isTruck ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.setValueAtTime(0.11, now + 0.24);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  public playCollision(strength: number): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.4, 0.08 + strength * 0.035);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playParkLockChime(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((n, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n, now + idx * 0.075);
      gain.gain.setValueAtTime(0.12, now + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.26);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.28);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.running = false;
  }
}
