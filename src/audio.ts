export class GameAudio {
  private context: AudioContext | null = null;
  unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Áudio é opcional em navegadores sem Web Audio. */ }
  }
  play(kind: 'hit' | 'goal' | 'kickoff', volume: number) {
    const context = this.context;
    if (!context || context.state !== 'running' || !volume) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const duration = kind === 'goal' ? 0.65 : 0.15;
    oscillator.type = kind === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(kind === 'goal' ? 440 : kind === 'kickoff' ? 600 : 150, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'goal' ? 880 : 60, now + duration);
    gain.gain.setValueAtTime(volume * 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  dispose() { void this.context?.close().catch(() => {}); }
}
