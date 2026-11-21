// =====================================================================================
//  ÂM THANH KHOANG MÁY BAY — tổng hợp hoàn toàn bằng Web Audio (không cần file âm thanh)
//
//    ĐỘNG CƠ   : 4 động cơ cánh quạt ù ù + nhịp "phập phập" của cánh quạt + tiếng rít tua-bin
//    GIÓ       : gió rít ngoài vỏ máy bay, giật từng cơn; mở cửa nhảy / rơi tự do thì gào lên
//    CÒI       : còi báo động phòng không (cảnh lên máy bay ở sân bay)
//    TIẾNG NỔ  : pháo phòng không / bom xa (ầm trầm, vang) hoặc gần (đanh, mảnh văng lách cách)
//    SẤM       : sấm rền kéo dài sau tia chớp
//    KHUNG MÁY : rung lách cách, kẽo kẹt khi nhiễu động · còi báo nhảy khi đèn chuyển xanh
//
//  Cabin gọi update(sound, mix) MỖI KHUNG HÌNH với các mức 0..1. Ngừng gọi (rời khoang, đổi tab)
//  -> tự nhỏ dần rồi tắt hẳn sau vài giây, không bao giờ kêu sót. Nút Tắt tiếng của game được tôn trọng.
//
//  >>> CHỈNH ÂM LƯỢNG: sửa CABIN_VOLUME bên dưới (1 = mặc định).
// =====================================================================================

export const CABIN_VOLUME = {
  master: 0.6,     // tổng
  engine: 1,       // động cơ
  wind: 1,         // gió
  siren: 1,        // còi báo động
  boom: 1,         // tiếng nổ + sấm
  rattle: 1,       // lách cách / kẽo kẹt / còi nhảy
};

const NOISE = new WeakMap();   // mỗi AudioContext 1 bộ đệm tiếng ồn
function noiseBuf(ctx) {
  let b = NOISE.get(ctx);
  if (b) return b;
  const len = Math.floor(ctx.sampleRate * 3);
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;   // tiếng ồn hồng (ấm hơn ồn trắng)
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  NOISE.set(ctx, b);
  return b;
}
/** Vang của khoang/bầu trời (đuôi tiếng nổ, sấm) */
function reverbBuf(ctx, sec = 2.4) {
  const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  return b;
}

const rnd = (a, b) => a + Math.random() * (b - a);

export class CabinAudio {
  constructor() { this.n = null; this.lastWall = 0; this.lastSet = -1; this.timer = 0; }

  /** Đã mở khóa âm thanh chưa (cần 1 lần bấm/chạm)? Dựng mạch âm lần đầu. */
  live(sound) {
    const ctx = sound?.ctx;
    if (!ctx || ctx.state === "closed") return false;
    if (this.n && this.n.ctx !== ctx) this.stop();
    if (!this.n) this.build(ctx);
    return true;
  }

  build(ctx) {
    const n = { ctx, srcs: [] };
    const G = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const F = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const O = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); n.srcs.push(o); return o; };
    const N = (off = 0) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true; s.start(0, off); n.srcs.push(s); return s; };

    // tổng: master -> nén (chống vỡ tiếng khi nhiều tiếng nổ chồng nhau) -> loa
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -9; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.3;
    n.master = G(0); n.master.connect(comp); comp.connect(ctx.destination);
    // bus hiệu ứng có vang (tiếng nổ, sấm)
    n.fx = G(CABIN_VOLUME.boom); n.fx.connect(n.master);
    const verb = ctx.createConvolver(); verb.buffer = reverbBuf(ctx); const wet = G(0.55);
    n.fx.connect(verb); verb.connect(wet); wet.connect(n.master);

    // ---- ĐỘNG CƠ: răng cưa trầm lệch nhau (4 máy không đồng tốc) -> lọc thấp -> nhịp cánh quạt
    n.eng = G(0); n.eng.connect(n.master);
    const engLP = F("lowpass", 480, 0.9), thrum = G(0.62);
    engLP.connect(thrum); thrum.connect(n.eng);
    n.blade = O("sine", 21); const bladeAmt = G(0.34); n.blade.connect(bladeAmt); bladeAmt.connect(thrum.gain);
    n.engOsc = [[27.6, 0.36], [55, 0.3], [55.7, 0.26], [82.8, 0.15], [110.4, 0.12]].map(([f, g]) => {
      const o = O("sawtooth", f), gg = G(g * 0.14); o.connect(gg); gg.connect(engLP); return { o, f };
    });
    const rum = N(0.4), rumLP = F("lowpass", 150), rumG = G(0.8); rum.connect(rumLP); rumLP.connect(rumG); rumG.connect(n.eng);
    n.whine = [O("sine", 1420), O("sine", 1428)]; const whG = G(0.008); for (const w of n.whine) w.connect(whG); whG.connect(n.eng);

    // ---- GIÓ: ồn hồng qua lọc dải, tần số + độ lớn trôi chậm (giật từng cơn)
    n.wind = G(0); n.wind.connect(n.master);
    const wsrc = N(1.3); n.windBP = F("bandpass", 620, 0.55); n.windAmp = G(1);
    wsrc.connect(n.windBP); n.windBP.connect(n.windAmp); n.windAmp.connect(n.wind);
    const gust = O("sine", 0.17), gustAmt = G(240); gust.connect(gustAmt); gustAmt.connect(n.windBP.frequency);
    const gust2 = O("sine", 0.41); n.gustAmt = G(0); gust2.connect(n.gustAmt); n.gustAmt.connect(n.windAmp.gain);
    // gió rít cao (mở cửa / rơi tự do)
    const hsrc = N(2.1), hissHP = F("highpass", 2000, 0.5); n.hiss = G(0); hsrc.connect(hissHP); hissHP.connect(n.hiss); n.hiss.connect(n.master);

    // ---- CÒI BÁO ĐỘNG PHÒNG KHÔNG: 2 sóng tam giác trượt lên xuống chậm
    n.siren = G(0); const sirLP = F("lowpass", 1700); sirLP.connect(n.siren); n.siren.connect(n.master);
    const sLfo = O("sine", 0.15);
    for (const [f, amt] of [[470, 210], [592, 265]]) {
      const o = O("triangle", f), a = G(amt); sLfo.connect(a); a.connect(o.frequency); o.connect(sirLP);
    }

    this.n = n;
    this.lastSet = -1;
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (performance.now() - this.lastWall > 3000) this.stop(); }, 1000);   // không ai gọi nữa -> tắt hẳn
  }

  /**
   * Gọi mỗi khung hình. mix = { level, engine, pitch, wind, gust, hiss, siren } (0..1, pitch quanh 1)
   */
  update(sound, mix) {
    if (!this.live(sound)) return;
    const n = this.n, now = n.ctx.currentTime, V = CABIN_VOLUME;
    this.lastWall = performance.now();
    // master bám mức hiện tại + "công tắc an toàn": không được gọi tiếp thì tự nhỏ dần về 0
    const g = n.master.gain, target = sound.muted ? 0 : (mix.level ?? 1) * V.master;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + 0.12); g.linearRampToValueAtTime(0, now + 0.9);
    if (now - this.lastSet < 0.08) return;   // các tham số còn lại: ~12 lần/giây là đủ mượt
    this.lastSet = now;
    const T = (p, v, tc = 0.15) => p.setTargetAtTime(v, now, tc);
    const pitch = mix.pitch ?? 1;
    T(n.eng.gain, (mix.engine ?? 0) * V.engine, 0.3);
    for (const e of n.engOsc) T(e.o.frequency, e.f * pitch, 0.5);
    T(n.blade.frequency, 21 * pitch, 0.5);
    n.whine.forEach((w, i) => T(w.frequency, (1420 + i * 8) * (0.6 + 0.4 * pitch), 0.6));
    const wind = (mix.wind ?? 0) * V.wind, hiss = mix.hiss ?? 0;
    T(n.wind.gain, wind * 1.25, 0.25);
    T(n.gustAmt.gain, 0.45 * (mix.gust ?? 0.5), 0.4);
    T(n.windBP.frequency, 560 + hiss * 1100, 0.3);
    T(n.hiss.gain, hiss * 0.34 * V.wind, 0.2);
    T(n.siren.gain, (mix.siren ?? 0) * 0.075 * V.siren, 0.35);
  }

  /** Nguồn ồn 1 lần (cắt từ bộ đệm), tự hủy */
  shot(t, dur) {
    const s = this.n.ctx.createBufferSource(); s.buffer = noiseBuf(this.n.ctx);
    s.start(t, Math.random() * 2, dur); return s;
  }
  ok(sound) { return this.live(sound) && !sound.muted; }

  /** TIẾNG NỔ — near 0 (bom rất xa: ầm trầm) .. 1 (pháo nổ sát thân máy bay: đanh + mảnh văng) · delay giây */
  boom(sound, near = 0.3, delay = 0) {
    if (!this.ok(sound)) return;
    const ctx = this.n.ctx, t = ctx.currentTime + delay, len = 1.3 + (1 - near) * 1.4;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(260 + near * 1700, t); lp.frequency.exponentialRampToValueAtTime(70, t + len);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.5 + near * 1.1, t + 0.012 + (1 - near) * 0.05);
    env.gain.exponentialRampToValueAtTime(0.0008, t + len);
    this.shot(t, len + 0.1).connect(lp); lp.connect(env); env.connect(this.n.fx);
    // "thịch" trầm
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(62 + near * 40, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.55 * (0.4 + near), t + 0.01); og.gain.exponentialRampToValueAtTime(0.0008, t + 0.75);
    o.connect(og); og.connect(this.n.fx); o.start(t); o.stop(t + 0.8);
    if (near > 0.6) {   // gần: tiếng đanh + mảnh văng gõ vào vỏ
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400;
      const cg = ctx.createGain(); cg.gain.setValueAtTime(0.5, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      this.shot(t, 0.16).connect(hp); hp.connect(cg); cg.connect(this.n.fx);
      this.rattle(sound, 0.9, delay + 0.08);
    }
  }

  /** SẤM — rền nhiều đợt, kéo dài ~3 giây */
  thunder(sound, delay = 0.8) {
    if (!this.ok(sound)) return;
    const ctx = this.n.ctx, t = ctx.currentTime + delay, len = 3.2;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 240; lp.Q.value = 0.5;
    const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.55, t + 0.12);
    let k = t + 0.12;
    for (let i = 0; i < 4; i++) { k += rnd(0.25, 0.6); env.gain.linearRampToValueAtTime(rnd(0.15, 0.5) * (1 - i * 0.18), k); }
    env.gain.exponentialRampToValueAtTime(0.0008, t + len);
    this.shot(t, len + 0.1).connect(lp); lp.connect(env); env.connect(this.n.fx);
  }

  /** LÁCH CÁCH + KẼO KẸT của khung máy bay khi rung mạnh */
  rattle(sound, amount = 0.6, delay = 0) {
    if (!this.ok(sound)) return;
    const ctx = this.n.ctx, t0 = ctx.currentTime + delay, v = CABIN_VOLUME.rattle * amount;
    const count = 6 + Math.floor(amount * 8);
    for (let i = 0; i < count; i++) {
      const t = t0 + Math.random() * 0.9;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = rnd(1800, 4200); bp.Q.value = 7;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.32 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + rnd(0.02, 0.05));
      this.shot(t, 0.06).connect(bp); bp.connect(g); g.connect(this.n.master);
    }
    // kẽo kẹt kim loại
    const t = t0 + rnd(0.05, 0.3), o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(rnd(78, 96), t); o.frequency.linearRampToValueAtTime(rnd(52, 64), t + 0.55);
    bp.type = "bandpass"; bp.frequency.value = rnd(600, 900); bp.Q.value = 9;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(bp); bp.connect(g); g.connect(this.n.master); o.start(t); o.stop(t + 0.65);
  }

  /** CÒI BÁO NHẢY — 2 hồi "bíp" trầm (đèn xanh / mở cửa) */
  horn(sound, times = 2) {
    if (!this.ok(sound)) return;
    const ctx = this.n.ctx, v = CABIN_VOLUME.rattle;
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + 0.05 + i * 0.55, lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = 1300;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13 * v, t + 0.02); g.gain.setValueAtTime(0.13 * v, t + 0.34); g.gain.linearRampToValueAtTime(0.0001, t + 0.4);
      for (const f of [233, 349]) { const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 0.42); }
      lp.connect(g); g.connect(this.n.master);
    }
  }

  /** BỘ ĐÀM: tiếng rè lúc lên lúc xuống + 2 tiếng bíp (~1.4 giây) */
  radio(sound) {
    if (!this.ok(sound)) return;
    const ctx = this.n.ctx, t = ctx.currentTime + 0.02, v = CABIN_VOLUME.rattle, len = 1.4;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < 14; k++) g.gain.linearRampToValueAtTime((0.05 + Math.random() * 0.12) * v, t + 0.05 + k * 0.095);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    this.shot(t, len + 0.1).connect(bp); bp.connect(g); g.connect(this.n.master);
    for (const [dt, f] of [[0, 1320], [0.12, 990]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "square"; o.frequency.value = f;
      og.gain.setValueAtTime(0.05 * v, t + dt); og.gain.setValueAtTime(0.0001, t + dt + 0.08);
      o.connect(og); og.connect(this.n.master); o.start(t + dt); o.stop(t + dt + 0.1);
    }
  }

  stop() {
    clearInterval(this.timer); this.timer = 0;
    const n = this.n; this.n = null;
    if (!n) return;
    for (const s of n.srcs) { try { s.stop(); } catch { /* đã dừng */ } }
    try { n.master.disconnect(); } catch { /* bỏ qua */ }
  }
}
