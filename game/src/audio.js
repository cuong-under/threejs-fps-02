// Synthesized sound: every effect is built from oscillators and filtered
// noise at runtime, so the game ships no audio files. One AudioContext,
// created on the first user gesture; shot mode never needs it.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const length = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      return false;
    }
    return true;
  }

  function noise(when, duration, filterType, frequency, gain, quality = 1) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = quality;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, when);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + duration);
    source.connect(filter).connect(envelope).connect(master);
    source.start(when);
    source.stop(when + duration + 0.02);
  }

  function tone(when, duration, type, fromFreq, toFreq, gain) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), when + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, when);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(envelope).connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  // Volume falls with distance from the listener; 1.0 is at the listener.
  function attenuate(distance) {
    return 1 / (1 + distance * 0.09);
  }

  return {
    unlock() { ensure(); },
    shoot(kind, distance = 0) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const v = attenuate(distance);
      noise(t, 0.14, 'lowpass', kind === 'longshot' ? 900 : 1600, 0.9 * v);
      noise(t, 0.05, 'highpass', 2400, 0.4 * v);
      tone(t, 0.09, 'triangle', 160, 50, 0.5 * v);
    },
    dryFire() {
      if (!ensure()) return;
      tone(ctx.currentTime, 0.05, 'square', 1200, 900, 0.12);
    },
    reload() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      tone(t, 0.05, 'square', 700, 500, 0.14);
      tone(t + 0.35, 0.05, 'square', 500, 380, 0.14);
      tone(t + 0.7, 0.06, 'square', 900, 650, 0.16);
    },
    hit(head) {
      if (!ensure()) return;
      tone(ctx.currentTime, 0.07, 'sine', head ? 1500 : 1050, head ? 1300 : 900, 0.25);
    },
    kill() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      tone(t, 0.09, 'sine', 880, 880, 0.22);
      tone(t + 0.09, 0.14, 'sine', 1320, 1320, 0.22);
    },
    hurt() {
      if (!ensure()) return;
      tone(ctx.currentTime, 0.12, 'sawtooth', 220, 90, 0.2);
    },
    explosion(distance = 0) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const v = attenuate(distance);
      noise(t, 1.1, 'lowpass', 500, 1.0 * v);
      tone(t, 0.9, 'sine', 120, 28, 0.9 * v);
      noise(t + 0.05, 0.4, 'bandpass', 300, 0.5 * v, 0.7);
    },
    beep(fast) {
      if (!ensure()) return;
      tone(ctx.currentTime, fast ? 0.06 : 0.1, 'square', 1900, 1900, 0.12);
    },
    plantTick() {
      if (!ensure()) return;
      tone(ctx.currentTime, 0.05, 'sine', 660, 660, 0.15);
    },
    buy() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      tone(t, 0.08, 'sine', 740, 740, 0.18);
      tone(t + 0.08, 0.1, 'sine', 1108, 1108, 0.18);
    },
    denied() {
      if (!ensure()) return;
      tone(ctx.currentTime, 0.12, 'square', 220, 180, 0.14);
    },
    roundWin() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [523, 659, 784].forEach((f, i) => tone(t + i * 0.11, 0.16, 'triangle', f, f, 0.2));
    },
    roundLose() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [392, 330, 262].forEach((f, i) => tone(t + i * 0.11, 0.16, 'triangle', f, f, 0.2));
    },
    bounce(distance = 0) {
      if (!ensure()) return;
      tone(ctx.currentTime, 0.05, 'sine', 320, 180, 0.14 * attenuate(distance));
    },
    flashRing() {
      if (!ensure()) return;
      tone(ctx.currentTime, 1.2, 'sine', 3200, 3100, 0.1);
    },
    step(distance = 0) {
      if (!ensure()) return;
      noise(ctx.currentTime, 0.05, 'lowpass', 500, 0.08 * attenuate(distance));
    },
  };
}
