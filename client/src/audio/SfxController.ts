export class SfxController {
  private context: AudioContext | null = null;

  resume(): void {
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  fire(): void {
    this.play(210, 0.035, "triangle", 0.02);
  }

  surge(): void {
    this.play(120, 0.16, "sawtooth", 0.05, 520);
  }

  upgrade(): void {
    this.play(480, 0.08, "sine", 0.03, 760);
  }

  hit(): void {
    this.play(170, 0.06, "square", 0.04, 110);
  }

  blastDirect(): void {
    this.play(195, 0.085, "square", 0.055, 105);
  }

  blastNear(): void {
    this.play(135, 0.065, "triangle", 0.038, 88);
  }

  flagStolen(): void {
    this.play(420, 0.11, "sine", 0.042, 680);
  }

  /** Neutral flag picked up from the ring (not a steal). */
  flagPickup(): void {
    this.play(360, 0.08, "triangle", 0.038, 520);
  }

  danger(): void {
    this.play(260, 0.12, "sawtooth", 0.05, 150);
  }

  private play(startFrequency: number, duration: number, type: OscillatorType, gainValue: number, endFrequency?: number): void {
    this.context ??= new AudioContext();
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
