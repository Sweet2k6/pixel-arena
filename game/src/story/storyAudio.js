// =====================================================================================
//  ÂM THANH KINH DỊ (chế độ Cốt Truyện) — tổng hợp hoàn toàn bằng Web Audio, không cần file
//
//    nền: MƯA rả rích (to / nhỏ theo phòng) · ù ù trầm rợn người (drone) · đèn tuýp rè rè
//    sự kiện: SẤM · TIM ĐẬP (zombie lại gần / sắp chết) · cửa KẼO KẸT · cửa KHÓA lạch cạch · JUMP SCARE (tiếng rít chói)
//             tiếng gõ chữ hội thoại · lật giấy · nhặt đồ · lưu game · cửa sắt kéo
//  StoryRun gọi update(sound, mix) mỗi khung hình. Ngừng gọi (rời chế độ cốt truyện) -> tự nhỏ dần rồi tắt.
//  >>> CHỈNH ÂM LƯỢNG: STORY_VOLUME
// =====================================================================================

export const STORY_VOLUME = { master: 0.7, rain: 0.8, drone: 0.7, sfx: 1 };

const NOISE = new WeakMap();
function noiseBuf(ctx) {
  let b = NOISE.get(ctx);
  if (b) return b;
  const len = Math.floor(ctx.sampleRate * 3);
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.18) * 0.9; }
  NOISE.set(ctx, b);
  return b;
}
const rnd = (a, b) => a + Math.random() * (b - a);

export class StoryAudio {
  constructor() { this.n = null; this.beatT = 0; this.buzzT = 0; }

  live(sound) {
    const ctx = sound?.ctx;
    if (!ctx || ctx.state === "closed") return false;
    if (this.n && this.n.ctx !== ctx) this.stop();
    if (!this.n) this.build(ctx);
    return true;
  }
  ok(sound) { return this.live(sound) && !sound.muted; }

  build(ctx) {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
    const src = (loop = true) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = loop; return s; };
    // MƯA: tiếng ồn lọc cao + lộp độp
    const rain = src(), rf = ctx.createBiquadFilter(), rg = ctx.createGain();
    rf.type = "bandpass"; rf.frequency.value = 2400; rf.Q.value = 0.5; rg.gain.value = 0;
    rain.connect(rf).connect(rg).connect(out); rain.start();
    const rain2 = src(), rf2 = ctx.createBiquadFilter(), rg2 = ctx.createGain();
    rf2.type = "lowpass"; rf2.frequency.value = 500; rg2.gain.value = 0;
    rain2.connect(rf2).connect(rg2).connect(out); rain2.start(0, 1.3);
    // DRONE: 2 sóng trầm lệch tần số + tiếng ồn rất trầm
    const dg = ctx.createGain(); dg.gain.value = 0; dg.connect(out);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), df = ctx.createBiquadFilter();
    o1.type = "sawtooth"; o1.frequency.value = 43.6; o2.type = "sawtooth"; o2.frequency.value = 44.4;
    df.type = "lowpass"; df.frequency.value = 160; df.Q.value = 4;
    o1.connect(df); o2.connect(df); df.connect(dg); o1.start(); o2.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 60; lfo.connect(lg).connect(df.frequency); lfo.start();
    // ĐÈN TUÝP RÈ RÈ (100 Hz + bội)
    const bz = ctx.createOscillator(), bf = ctx.createBiquadFilter(), bg = ctx.createGain();
    bz.type = "square"; bz.frequency.value = 100; bf.type = "bandpass"; bf.frequency.value = 1200; bf.Q.value = 3; bg.gain.value = 0;
    bz.connect(bf).connect(bg).connect(out); bz.start();
    this.n = { ctx, out, rg, rg2, dg, bg, df };
  }

  /** mix: { rain 0..1, drone 0..1, buzz 0..1, heart 0..1 (nhịp tim nhanh dần) } */
  update(sound, mix, dt) {
    if (!this.live(sound)) return;
    const n = this.n, t = n.ctx.currentTime, M = STORY_VOLUME;
    n.out.gain.setTargetAtTime(sound.muted ? 0 : M.master, t, 0.3);
    n.rg.gain.setTargetAtTime((mix.rain ?? 0) * 0.5 * M.rain, t, 0.5);
    n.rg2.gain.setTargetAtTime((mix.rain ?? 0) * 0.35 * M.rain, t, 0.5);
    n.dg.gain.setTargetAtTime((mix.drone ?? 0) * 0.16 * M.drone, t, 0.8);
    n.bg.gain.setTargetAtTime((mix.buzz ?? 0) * 0.012, t, 0.05);
    // tim đập: nhịp theo mức căng thẳng
    const h = mix.heart ?? 0;
    if (h > 0.05) {
      this.beatT -= dt;
      if (this.beatT <= 0) { this.beatT = 1.1 - h * 0.65; this.heartbeat(sound, 0.4 + h * 0.6); }
    } else this.beatT = 0;
  }

  // ---------------------------------------------------------------- hiệu ứng ngắn
  tone(freq, dur, type = "sine", vol = 0.2, delay = 0, slide = 0) {
    const n = this.n, ctx = n.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * STORY_VOLUME.sfx, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(n.out); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, filter = "lowpass", f0 = 800, f1 = 0, delay = 0, q = 0.7) {
    const n = this.n, ctx = n.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf(ctx); f.type = filter; f.frequency.setValueAtTime(f0, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * STORY_VOLUME.sfx, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(n.out); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  heartbeat(sound, k = 0.6) { if (!this.ok(sound)) return; this.tone(52, 0.18, "sine", 0.5 * k, 0, 0.6); this.tone(48, 0.2, "sine", 0.38 * k, 0.17, 0.6); }
  thunder(sound, delay = 0.6) {
    if (!this.ok(sound)) return;
    this.noise(0.25, 0.5, "lowpass", 2400, 300, delay);
    this.noise(2.8, 0.75, "lowpass", 380, 60, delay + 0.08, 1.2);
    this.noise(1.6, 0.35, "lowpass", 220, 50, delay + 0.9);
  }
  door(sound) {   // cửa gỗ kẽo kẹt + đóng cạch
    if (!this.ok(sound)) return;
    const n = this.n, ctx = n.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(180, t);
    for (let i = 0; i < 6; i++) o.frequency.linearRampToValueAtTime(rnd(160, 330), t + 0.08 + i * 0.07);
    f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(f).connect(g).connect(n.out); o.start(t); o.stop(t + 0.55);
    this.noise(0.12, 0.5, "lowpass", 600, 120, 0.5);
  }
  locked(sound) { if (!this.ok(sound)) return; for (let i = 0; i < 3; i++) { this.noise(0.05, 0.35, "bandpass", 2200, 0, i * 0.09, 4); this.tone(320, 0.04, "square", 0.04, i * 0.09); } }
  gate(sound) { if (!this.ok(sound)) return; this.noise(0.9, 0.35, "bandpass", 1800, 600, 0, 3); for (let i = 0; i < 6; i++) this.noise(0.04, 0.25, "highpass", 3000, 0, i * 0.12); }
  scare(sound) {   // JUMP SCARE: tiếng rít chói + đập trầm
    if (!this.ok(sound)) return;
    this.noise(0.15, 1, "lowpass", 300, 80);
    this.tone(1180, 0.9, "sawtooth", 0.16, 0, 0.75); this.tone(1243, 0.9, "sawtooth", 0.14, 0, 0.78); this.tone(1660, 0.7, "square", 0.06, 0.02, 0.8);
    this.noise(0.8, 0.35, "highpass", 3000, 1200);
  }
  sting(sound) { if (!this.ok(sound)) return; this.tone(98, 1.8, "sawtooth", 0.12, 0, 0.5); this.tone(103.8, 1.8, "sawtooth", 0.1, 0, 0.5); this.noise(1.2, 0.25, "lowpass", 900, 100); }
  blip(sound) { if (!this.ok(sound)) return; this.tone(rnd(520, 600), 0.03, "square", 0.025); }
  page(sound) { if (!this.ok(sound)) return; this.noise(0.18, 0.25, "highpass", 2500, 5000); this.noise(0.12, 0.18, "highpass", 3000, 0, 0.12); }
  item(sound) { if (!this.ok(sound)) return; this.tone(660, 0.12, "triangle", 0.12); this.tone(990, 0.2, "triangle", 0.1, 0.09); }
  save(sound) { if (!this.ok(sound)) return; [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, "sine", 0.08, i * 0.12)); }
  growl(sound, vol = 0.5) {
    if (!this.ok(sound)) return;
    const n = this.n, ctx = n.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(rnd(70, 95), t); o.frequency.linearRampToValueAtTime(rnd(55, 70), t + 1);
    lfo.frequency.value = rnd(16, 24); lg.gain.value = 18; lfo.connect(lg).connect(o.frequency);
    f.type = "bandpass"; f.frequency.value = 420; f.Q.value = 2.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(f).connect(g).connect(n.out); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
  }
  bang(sound) { if (!this.ok(sound)) return; this.noise(0.18, 0.9, "lowpass", 500, 90); this.tone(70, 0.25, "sine", 0.4, 0, 0.5); }

  stop() {
    const n = this.n;
    this.n = null;
    if (!n) return;
    try { n.out.gain.setTargetAtTime(0, n.ctx.currentTime, 0.2); setTimeout(() => { try { n.out.disconnect(); } catch { /* đã ngắt */ } }, 1500); } catch { /* bỏ qua */ }
  }
}
