// Generated wind and rain (the original sound, D-6.1). Now only a fallback:
// it fills in while the recorded wind or rain bed is loading or missing, and
// fades out once the recording plays.
import { wobble } from '../scene/util.js';

function noiseBuffer(ctx, seconds, brown) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    // crossfade the loop point to avoid a click
    const f = Math.min(2048, len >> 4);
    for (let i = 0; i < f; i++) {
      const k = i / f;
      d[i] = d[i] * k + d[len - f + i] * (1 - k);
    }
  }
  return buf;
}

export class SynthFallback {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.t = 0;
    // wind: brown noise -> band-pass (moving) -> low-pass -> gain
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer(ctx, 6, true);
    windSrc.loop = true;
    this.windBand = ctx.createBiquadFilter();
    this.windBand.type = 'bandpass';
    this.windBand.frequency.value = 500;
    this.windBand.Q.value = 0.7;
    const windLow = ctx.createBiquadFilter();
    windLow.type = 'lowpass';
    windLow.frequency.value = 1800;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(this.windBand).connect(windLow).connect(this.windGain).connect(out);
    windSrc.start();

    // rain: white noise -> high-pass -> low-pass -> gain
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer(ctx, 4, false);
    rainSrc.loop = true;
    const rainHigh = ctx.createBiquadFilter();
    rainHigh.type = 'highpass';
    rainHigh.frequency.value = 900;
    const rainLow = ctx.createBiquadFilter();
    rainLow.type = 'lowpass';
    rainLow.frequency.value = 6500;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(rainHigh).connect(rainLow).connect(this.rainGain).connect(out);
    rainSrc.start();
  }

  // wind, rain: 0..1 how much of each layer the generated sound should
  // supply (0 once the recording plays). P: eased scene parameters.
  update(wind, rain, P, dt) {
    this.t += dt;
    const now = this.ctx.currentTime;
    const gust = 0.5 + 0.5 * wobble(this.t * 0.35, 3);
    this.windGain.gain.setTargetAtTime(wind * 0.45 * (0.65 + 0.35 * gust), now, 0.8);
    this.windBand.frequency.setTargetAtTime(280 + 380 * gust + (P.wind || 0) * 420, now, 0.8);
    this.rainGain.gain.setTargetAtTime(rain * 0.18, now, 1.2);
  }
}
