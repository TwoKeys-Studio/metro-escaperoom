// Procedural sound: everything is synthesised with WebAudio, no files to download.
type V3 = [number, number, number]

class Sfx {
  ctx: AudioContext | null = null
  master!: GainNode
  ambient: { water: GainNode; hum: GainNode; drone: GainNode } | null = null
  noiseBuf!: AudioBuffer
  dripTimer = 0
  volume = 0.8

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return this.ctx
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    const comp = ctx.createDynamicsCompressor()
    this.master.connect(comp).connect(ctx.destination)
    const len = ctx.sampleRate * 2
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02 // brown-ish
      d[i] = i % 2 ? w * 0.6 : last * 3
    }
    return ctx
  }

  noise(loop = true) {
    const src = this.ctx!.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = loop
    return src
  }

  // listener follows the camera
  setListener(p: V3, fwd: V3) {
    const ctx = this.ctx
    if (!ctx) return
    const l = ctx.listener
    if (l.positionX) {
      l.positionX.value = p[0]; l.positionY.value = p[1]; l.positionZ.value = p[2]
      l.forwardX.value = fwd[0]; l.forwardY.value = fwd[1]; l.forwardZ.value = fwd[2]
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0
    }
  }

  spatial(at?: V3) {
    const ctx = this.ctx!
    if (!at) return this.master
    const p = ctx.createPanner()
    p.panningModel = 'HRTF'
    p.distanceModel = 'inverse'
    p.refDistance = 2
    p.rolloffFactor = 1.2
    p.positionX.value = at[0]; p.positionY.value = at[1]; p.positionZ.value = at[2]
    p.connect(this.master)
    return p
  }

  startAmbient() {
    const ctx = this.ensure()
    if (this.ambient) return
    // deep drone
    const drone = ctx.createGain()
    drone.gain.value = 0.18
    for (const f of [41, 43.5, 61.7]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(drone)
      o.start()
    }
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.08
    lfo.connect(lfoG).connect(drone.gain)
    lfo.start()
    drone.connect(this.master)
    // water rush
    const water = ctx.createGain()
    water.gain.value = 0.04
    const wn = this.noise()
    const wf = ctx.createBiquadFilter()
    wf.type = 'lowpass'
    wf.frequency.value = 420
    wn.connect(wf).connect(water).connect(this.master)
    wn.start()
    // neon hum
    const hum = ctx.createGain()
    hum.gain.value = 0
    const h = ctx.createOscillator()
    h.type = 'sawtooth'
    h.frequency.value = 100
    const hf = ctx.createBiquadFilter()
    hf.type = 'bandpass'
    hf.frequency.value = 200
    hf.Q.value = 6
    h.connect(hf).connect(hum).connect(this.master)
    h.start()
    this.ambient = { water, hum, drone }
  }

  update(dt: number, waterLevel01: number, power: boolean, listener: V3) {
    if (!this.ctx || !this.ambient) return
    const t = this.ctx.currentTime
    this.ambient.water.gain.setTargetAtTime(0.03 + waterLevel01 * 0.22, t, 0.5)
    this.ambient.hum.gain.setTargetAtTime(power ? 0.025 : 0, t, 0.3)
    this.dripTimer -= dt
    if (this.dripTimer <= 0) {
      this.dripTimer = 0.4 + Math.random() * 2.2
      const a = Math.random() * Math.PI * 2
      const r = 3 + Math.random() * 10
      this.drip([listener[0] + Math.cos(a) * r, listener[1] + 2, listener[2] + Math.sin(a) * r])
    }
  }

  env(g: GainNode, a: number, peak: number, d: number) {
    const t = this.ctx!.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  }

  tone(freq: number, type: OscillatorType, dur: number, vol = 0.2, at?: V3, slideTo?: number) {
    const ctx = this.ensure()
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur)
    const g = ctx.createGain()
    o.connect(g).connect(this.spatial(at))
    this.env(g, 0.005, vol, dur)
    o.start()
    o.stop(ctx.currentTime + dur + 0.05)
  }

  burst(dur: number, freq: number, vol: number, at?: V3, type: BiquadFilterType = 'lowpass', q = 1) {
    const ctx = this.ensure()
    const n = this.noise(false)
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    n.connect(f).connect(g).connect(this.spatial(at))
    this.env(g, 0.01, vol, dur)
    n.start(ctx.currentTime, Math.random())
    n.stop(ctx.currentTime + dur + 0.1)
    return f
  }

  drip(at: V3) {
    const f = 900 + Math.random() * 1400
    this.tone(f, 'sine', 0.12, 0.08, at, f * 0.55)
  }
  step(vol = 0.05, wet = false) {
    this.burst(0.07, wet ? 900 : 1600, wet ? vol * 1.6 : vol, undefined, wet ? 'bandpass' : 'lowpass', wet ? 2 : 1)
  }
  grab() { this.tone(180, 'triangle', 0.08, 0.12) }
  drop(at?: V3) { this.burst(0.18, 300, 0.25, at) }
  beep(ok = true) { this.tone(ok ? 1320 : 220, ok ? 'square' : 'sawtooth', ok ? 0.08 : 0.35, 0.08) }
  lever(at?: V3) { this.burst(0.12, 700, 0.3, at, 'bandpass', 3); this.tone(90, 'square', 0.1, 0.1, at) }
  success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', 0.4, 0.12), i * 110)) }
  snap(at?: V3) { this.tone(110, 'square', 0.15, 0.15, at); this.burst(0.25, 3000, 0.12, at, 'highpass') }
  zap() {
    for (let i = 0; i < 6; i++) setTimeout(() => this.tone(60 + Math.random() * 900, 'sawtooth', 0.09, 0.18), i * 45)
    this.burst(0.6, 4000, 0.3, undefined, 'highpass')
  }
  rumble(dur = 2.5, vol = 0.7) { this.burst(dur, 120, vol); this.tone(38, 'sine', dur, vol * 0.6) }
  explosion() {
    this.burst(4, 90, 1.2)
    this.burst(1.2, 1200, 0.5)
    this.tone(30, 'sine', 3, 0.9, undefined, 18)
  }
  glitch() {
    for (let i = 0; i < 10; i++) setTimeout(() => this.tone(200 + Math.random() * 3000, 'square', 0.03, 0.06), i * 35)
  }
  whisper(at?: V3) {
    const ctx = this.ensure()
    for (let k = 0; k < 3; k++) {
      setTimeout(() => {
        const f = this.burst(1.4, 2200 + Math.random() * 1600, 0.35, at, 'bandpass', 8)
        f.frequency.linearRampToValueAtTime(1400 + Math.random() * 2000, ctx.currentTime + 1.2)
      }, k * 650)
    }
  }
  horn(at?: V3) {
    const ctx = this.ensure()
    for (const f of [220, 277, 330]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f * 1.06
      o.frequency.linearRampToValueAtTime(f * 0.92, ctx.currentTime + 2.6) // doppler
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1400
      const g = ctx.createGain()
      o.connect(lp).connect(g).connect(this.spatial(at))
      this.env(g, 0.08, 0.09, 2.6)
      o.start()
      o.stop(ctx.currentTime + 2.8)
    }
    this.rumble(3.5, 0.6)
  }
  siren() {
    const ctx = this.ensure()
    const o = ctx.createOscillator()
    o.type = 'square'
    const g = ctx.createGain()
    g.gain.value = 0.045
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 1.6
    const lg = ctx.createGain()
    lg.gain.value = 260
    o.frequency.value = 620
    lfo.connect(lg).connect(o.frequency)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    o.connect(lp).connect(g).connect(this.master)
    o.start()
    lfo.start()
    return () => {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
      setTimeout(() => { o.stop(); lfo.stop() }, 600)
    }
  }
  scream() {
    this.tone(880, 'sawtooth', 0.9, 0.1, undefined, 340)
    this.tone(1210, 'sawtooth', 0.9, 0.07, undefined, 400)
    this.burst(0.9, 2500, 0.25, undefined, 'bandpass', 4)
  }
  meow(at?: V3) { this.tone(700, 'triangle', 0.35, 0.15, at, 420); setTimeout(() => this.tone(950, 'sine', 0.2, 0.08, at, 700), 120) }
  ding() { this.tone(1568, 'sine', 1.2, 0.15); setTimeout(() => this.tone(1175, 'sine', 1.4, 0.15), 250) }
}

export const sfx = new Sfx()
