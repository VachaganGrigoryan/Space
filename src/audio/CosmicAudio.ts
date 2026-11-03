/**
 * Procedural Cosmic Audio Synthesizer
 * Uses Web Audio API to synthesize ambient deep space drones, planetary resonances,
 * pulsar pulses, and warp thrusters without any external audio dependencies.
 */
export class CosmicAudioEngine {
  private static instance: CosmicAudioEngine | null = null;

  private ctx: AudioContext | null = null;
  private isMuted = true;
  private masterGain: GainNode | null = null;

  // Drone oscillators
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;

  // Resonant body oscillator
  private resonanceOsc: OscillatorNode | null = null;
  private resonanceGain: GainNode | null = null;
  private resonanceFilter: BiquadFilterNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  private constructor() {}

  public static getInstance(): CosmicAudioEngine {
    if (!this.instance) {
      this.instance = new CosmicAudioEngine();
    }
    return this.instance;
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Cosmic Drone setup
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
      this.droneFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(54.5, this.ctx.currentTime);

      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'triangle';
      this.droneOsc2.frequency.setValueAtTime(55.5, this.ctx.currentTime); // 1Hz beating drone

      this.droneOsc1.connect(this.droneFilter);
      this.droneOsc2.connect(this.droneFilter);

      this.droneOsc1.start();
      this.droneOsc2.start();

      // 2. Resonant Body Oscillator
      this.resonanceFilter = this.ctx.createBiquadFilter();
      this.resonanceFilter.type = 'bandpass';
      this.resonanceFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
      this.resonanceFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      this.resonanceGain = this.ctx.createGain();
      this.resonanceGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      this.resonanceFilter.connect(this.resonanceGain);
      this.resonanceGain.connect(this.masterGain);

      this.resonanceOsc = this.ctx.createOscillator();
      this.resonanceOsc.type = 'sine';
      this.resonanceOsc.frequency.setValueAtTime(136.1, this.ctx.currentTime);
      this.resonanceOsc.connect(this.resonanceFilter);
      this.resonanceOsc.start();

      // Pulsar LFO (low-frequency oscillator for rhythmic pulsations)
      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.lfoOsc = this.ctx.createOscillator();
      this.lfoOsc.type = 'sine';
      this.lfoOsc.frequency.setValueAtTime(4.0, this.ctx.currentTime);
      this.lfoOsc.connect(this.lfoGain);
      this.lfoGain.connect(this.resonanceGain.gain);
      this.lfoOsc.start();
    } catch (e) {
      console.warn('Web Audio init failed:', e);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!this.ctx) {
      if (!muted) this.init();
      return;
    }
    if (this.ctx.state === 'suspended' && !muted) {
      this.ctx.resume();
    }
    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.45, this.ctx.currentTime + 0.3);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Set planetary frequency signature
  public setPlanetaryResonance(baseHz: number, isPulsar = false) {
    if (!this.ctx || !this.resonanceOsc || !this.resonanceFilter) return;

    const t = this.ctx.currentTime;
    const targetHz = Math.max(40, Math.min(800, baseHz));

    this.resonanceOsc.frequency.cancelScheduledValues(t);
    this.resonanceOsc.frequency.exponentialRampToValueAtTime(targetHz, t + 1.2);

    this.resonanceFilter.frequency.cancelScheduledValues(t);
    this.resonanceFilter.frequency.exponentialRampToValueAtTime(targetHz * 1.5, t + 1.2);

    if (this.lfoGain) {
      this.lfoGain.gain.cancelScheduledValues(t);
      if (isPulsar) {
        this.lfoGain.gain.linearRampToValueAtTime(0.12, t + 0.8);
      } else {
        this.lfoGain.gain.linearRampToValueAtTime(0.015, t + 0.8);
      }
    }
  }

  // Play thruster sound during camera travel
  public playWarpEffect() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.4);
      filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(45, now + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.3);
    } catch {
      // ignore
    }
  }

  // Play UI selection chirp
  public playClickChirp() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore
    }
  }

  // Play Starship Cockpit Engine Throttle Hum
  public setEngineThrottle(throttle: number) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const targetFreq = 48 + throttle * 75; // 48 Hz to 123 Hz low rumble
      if (this.droneOsc1) {
        this.droneOsc1.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
      }
      if (this.droneFilter) {
        this.droneFilter.frequency.setTargetAtTime(120 + throttle * 280, this.ctx.currentTime, 0.1);
      }
    } catch {
      // ignore
    }
  }

  // Play Starship Hyperdrive Warp Spool & Boom
  public playHyperdriveJump() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      // High-pitched warp spool oscillator
      const spoolOsc = this.ctx.createOscillator();
      const spoolGain = this.ctx.createGain();

      spoolOsc.type = 'sawtooth';
      spoolOsc.frequency.setValueAtTime(220, now);
      spoolOsc.frequency.exponentialRampToValueAtTime(1400, now + 0.6);
      spoolOsc.frequency.exponentialRampToValueAtTime(120, now + 1.4);

      spoolGain.gain.setValueAtTime(0.0, now);
      spoolGain.gain.linearRampToValueAtTime(0.18, now + 0.5);
      spoolGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      spoolOsc.connect(spoolGain);
      spoolGain.connect(this.masterGain);

      spoolOsc.start(now);
      spoolOsc.stop(now + 1.5);

      // Low boom impact
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boomOsc.type = 'triangle';
      boomOsc.frequency.setValueAtTime(95, now + 0.55);
      boomOsc.frequency.exponentialRampToValueAtTime(32, now + 1.6);

      boomGain.gain.setValueAtTime(0.0, now + 0.55);
      boomGain.gain.linearRampToValueAtTime(0.25, now + 0.6);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

      boomOsc.connect(boomGain);
      boomGain.connect(this.masterGain);

      boomOsc.start(now + 0.55);
      boomOsc.stop(now + 1.7);
    } catch {
      // ignore
    }
  }

  // Play Tactical HUD Target Lock Beep
  public playTargetLockSound() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.setValueAtTime(0.05, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      // ignore
    }
  }
}

