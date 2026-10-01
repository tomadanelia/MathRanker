// Unlock during a game interaction so the result can play after an async update.
let context: AudioContext | undefined;

export function prepareRankingSound() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Audio is optional on browsers without Web Audio support.
  }
}

export function playRankingSound(up: boolean, durationMs: number) {
  if (!context || context.state !== "running") return () => {};
  const audio = context;
  const notes = up ? [392, 440, 523.25, 587.33, 659.25, 783.99] : [523.25, 493.88, 440, 392];
  const voices = notes.map((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + (index / (notes.length - 1)) * durationMs / 1000;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.045, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.75);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    return oscillator;
  });
  return () => voices.forEach((voice) => { try { voice.stop(); } catch {} });
}
