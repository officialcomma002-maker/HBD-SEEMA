/* Nimra Birthday Web Experience - Script Engine */
(() => {
  'use strict';

  // Helper selectors
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  // --------------------------
  // Scene Flow Navigation
  // --------------------------
  const scenes = $$('.scene');
  let sceneIndex = 0;

  function setScene(i) {
    sceneIndex = clamp(i, 0, scenes.length - 1);
    scenes.forEach(s => s.classList.remove('active'));
    
    const active = scenes.find(s => Number(s.dataset.scene) === sceneIndex);
    if (active) active.classList.add('active');

    // Canvas Intensity Tweak by Scene
    if (sceneIndex === 0) fx.setIntensity(0.05);
    if (sceneIndex === 1) fx.setIntensity(0.85);
    if (sceneIndex === 2) {
      fx.setIntensity(0.35);
      startSaturnSequence();
    }
    if (sceneIndex === 3) enterCandleScene();
    if (sceneIndex === 4) fx.setIntensity(0.3);
    if (sceneIndex === 5) {
      fx.setIntensity(0.5);
      resetCredits();
    }

    if (sceneIndex === 1) startMemoriesSequence();
  }

  function nextScene() {
    setScene(sceneIndex + 1);
  }

  // --------------------------
  // Background Audio Controller
  // --------------------------
  const bgm = $('#bgm');
  let audioStarted = false;

  function startMusic() {
    if (audioStarted) return;
    audioStarted = true;
    try {
      bgm.volume = 0.35;
      bgm.loop = true;
      const p = bgm.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          audioStarted = false;
        });
      }
    } catch {
      audioStarted = false;
    }
  }

  // --------------------------
  // Scene 1: Memory Stagger Reveal
  // --------------------------
  let memoriesStarted = false;
  function startMemoriesSequence() {
    if (memoriesStarted) return;
    memoriesStarted = true;
    const items = $$('.memory');
    items.forEach((m, idx) => {
      setTimeout(() => m.classList.add('show'), 300 + idx * 900);
    });
  }

  // --------------------------
  // Scene 2: Saturn Card Stagger Reveal
  // --------------------------
  let saturnStarted = false;
  function startSaturnSequence() {
    if (saturnStarted) return;
    saturnStarted = true;
    const cards = $$('.quote-card');
    cards.forEach((c, idx) => {
      setTimeout(() => c.classList.add('show'), 300 + idx * 800);
    });
  }

  // --------------------------
  // Scene 3: Candle Blow Logic (Mic + Fallback)
  // --------------------------
  const continueBtn = $('#continueBtn');
  const flameEl = $('#flame');
  const candleEl = $('#candle');
  const blowHint = $('#blowHint');

  let candleOut = false;

  function setCandleOut(out) {
    candleOut = out;
    if (candleOut) {
      flameEl.classList.add('off');
      continueBtn.disabled = false;
      blowHint.style.opacity = '0.5';
    } else {
      flameEl.classList.remove('off');
      continueBtn.disabled = true;
      blowHint.style.opacity = '1';
    }
  }

  // Web Audio Mic Detection
  let micRequested = false;
  let audioCtx = null;
  let analyser = null;
  let micStream = null;
  let micSource = null;
  let blowScore = 0;
  let lastMicFrame = 0;

  async function requestMicOnce() {
    if (micRequested || candleOut) return;
    micRequested = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(analyser);
      lastMicFrame = now();
      blowScore = 0;
    } catch {
      analyser = null;
      audioCtx = null;
    }
  }

  function stopMic() {
    try {
      if (micStream) micStream.getTracks().forEach(t => t.stop());
    } catch {}
    micStream = null;
  }

  function sampleMicAndDetectBlow(t) {
    if (!analyser || candleOut) return;
    const dt = (t - lastMicFrame) / 1000;
    lastMicFrame = t;

    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);

    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);

    const threshold = 0.065;
    const strong = 0.12;
    const x = clamp((rms - threshold) / (strong - threshold), 0, 1);

    blowScore += (x > 0 ? 3.0 * x : -1.8) * dt;
    blowScore = clamp(blowScore, 0, 1.2);

    if (blowScore >= 1.0) {
      extinguishCandle('mic');
    }
  }

  function extinguishCandle() {
    if (candleOut) return;
    setCandleOut(true);
    stopMic();
    fx.celebrationBurst();
  }

  // Click & Tap Fallback
  let lastTap = 0;
  function onFlameTap() {
    const t = now();
    const delta = t - lastTap;
    lastTap = t;

    const isTouch = matchMedia('(pointer: coarse)').matches;
    if (!isTouch || delta < 350) {
      extinguishCandle();
    }
  }

  function enterCandleScene() {
    fx.setIntensity(0.35);
    setCandleOut(candleOut);
    requestMicOnce();
  }

  flameEl.addEventListener('click', onFlameTap, { passive: true });
  candleEl.addEventListener('click', onFlameTap, { passive: true });

  // --------------------------
  // Scene 4: Envelope Toggle
  // --------------------------
  const envelopeBtn = $('#envelope');
  envelopeBtn.addEventListener('click', (e) => {
    if (envelopeBtn.classList.contains('open')) {
      const insideLetter = e.target && e.target.closest && e.target.closest('.letter');
      if (insideLetter) return;
    }
    envelopeBtn.classList.add('open');
  });

  // --------------------------
  // Scene 5: Credits Control
  // --------------------------
  function resetCredits() {
    const roll = $('#creditsRoll');
    roll.style.animation = 'none';
    // Trigger reflow
    void roll.offsetHeight;
    roll.style.animation = null;
  }

  // --------------------------
  // Button Event Listeners
  // --------------------------
  $('#startBtn').addEventListener('click', () => {
    startMusic();
    nextScene();
  });

  $('#memoriesNextBtn').addEventListener('click', () => nextScene());
  $('#saturnNextBtn').addEventListener('click', () => nextScene());
  
  continueBtn.addEventListener('click', () => {
    if (!candleOut) return;
    nextScene();
  });

  $('#creditsBtn').addEventListener('click', () => nextScene());

  $('#replayBtn').addEventListener('click', () => {
    setScene(0);
  });

  // --------------------------
  // Floating Particle Gifts Layer Fallback
  // --------------------------
  const giftLayer = $('#giftLayer');
  function initGiftFallback() {
    const css = document.createElement('style');
    css.textContent = `
      #giftLayer .gift {
        position: absolute;
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.28), transparent 45%),
          linear-gradient(135deg, rgba(255,63,180,0.85), rgba(138,63,252,0.85));
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: 0 18px 50px rgba(0,0,0,0.35);
        transform: translate(-50%, 0);
        animation: floatGift var(--dur) linear infinite;
      }
      @keyframes floatGift {
        0% { transform: translate(-50%, 0) translateX(0px); }
        100% { transform: translate(-50%, -140vh) translateX(var(--drift)); }
      }
    `;
    document.head.appendChild(css);

    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div');
      el.className = 'gift';
      const size = Math.random() * 22 + 16;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${100 + Math.random() * 30}%`;
      el.style.opacity = `${0.15 + Math.random() * 0.20}`;
      el.style.setProperty('--dur', `${10 + Math.random() * 10}s`);
      el.style.setProperty('--drift', `${(Math.random() * 2 - 1) * 20}px`);
      giftLayer.appendChild(el);
    }
  }
  initGiftFallback();

  // --------------------------
  // Fireworks & Starfield Canvas Engine
  // --------------------------
  const canvas = $('#fxCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });

  const fx = (() => {
    let w = 0, h = 0, dpr = 1;
    let last = now();
    const stars = [];
    const rockets = [];
    const particles = [];

    let intensity = 0.05;
    let spawnAcc = 0;

    const palette = [
      { r: 170, g: 110, b: 255 },
      { r: 110, g: 160, b: 255 },
      { r: 255, g: 110, b: 220 },
      { r: 235, g: 235, b: 255 }
    ];

    function resize() {
      dpr = Math.max(1, Math.min(2.25, window.devicePixelRatio || 1));
      w = Math.floor(window.innerWidth * dpr);
      h = Math.floor(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;

      stars.length = 0;
      const count = Math.floor(150 * (w * h) / (900 * 700));
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random(),
          r: (Math.random() * 1.2 + 0.25) * dpr,
          tw: Math.random() * Math.PI * 2,
          tws: 0.7 + Math.random() * 1.8,
          a: 0.15 + Math.random() * 0.55
        });
      }
    }

    function setIntensity(v) {
      intensity = clamp(v, 0, 1);
    }

    function launchRocket() {
      const x = (Math.random() * 0.9 + 0.05) * w;
      const y = h + 10 * dpr;
      const z = 0.35 + Math.random() * 0.65;
      const speed = (6.2 + Math.random() * 2.6) * dpr * (0.85 + 0.35 * (1 - z));
      const targetY = (Math.random() * 0.45 + 0.12) * h;
      const color = palette[(Math.random() * palette.length) | 0];

      rockets.push({ x, y, z, vx: (Math.random() * 2 - 1) * 0.6 * dpr, vy: -speed, targetY, life: 0, color });
    }

    function burst(x, y, z, baseColor) {
      const count = Math.floor(65 + Math.random() * 55);
      const spread = 2.4 + Math.random() * 1.8;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const mag = (Math.random() ** 0.45) * spread * dpr * (0.55 + 0.75 * z);
        const col = (Math.random() < 0.7) ? baseColor : palette[(Math.random() * palette.length) | 0];
        particles.push({
          x, y, z,
          vx: Math.cos(ang) * mag,
          vy: Math.sin(ang) * mag,
          drag: 0.985 - Math.random() * 0.01,
          g: (0.045 + Math.random() * 0.035) * dpr,
          life: 0,
          maxLife: (42 + Math.random() * 28) * (0.9 + 0.6 * z),
          r: (1.2 + Math.random() * 1.8) * dpr,
          col
        });
      }
    }

    function celebrationBurst() {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          burst(
            (0.2 + Math.random() * 0.6) * w,
            (0.2 + Math.random() * 0.4) * h,
            0.8,
            palette[i % palette.length]
          );
        }, i * 180);
      }
    }

    function drawStars(t) {
      ctx.save();
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(s.tw + t * 0.001 * s.tws);
        const alpha = s.a * tw;
        ctx.fillStyle = `rgba(220,230,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function tick(t) {
      const dt = clamp((t - last) / 16.6667, 0.2, 2.2);
      last = t;

      ctx.fillStyle = 'rgba(5, 3, 12, 0.2)';
      ctx.fillRect(0, 0, w, h);

      drawStars(t);

      spawnAcc += dt * (0.015 + 0.055 * intensity);
      while (spawnAcc > 1) {
        spawnAcc -= 1;
        if (intensity > 0.08) launchRocket();
      }

      // Update & Draw Rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.life += dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;

        ctx.fillStyle = `rgba(${r.color.r},${r.color.g},${r.color.b},0.8)`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();

        if (r.y <= r.targetY || r.life > 70) {
          burst(r.x, r.y, r.z, r.color);
          rockets.splice(i, 1);
        }
      }

      // Update & Draw Particles
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const fade = 1 - (p.life / p.maxLife);
        if (fade <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(${p.col.r},${p.col.g},${p.col.b},${fade})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * fade, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (sceneIndex === 3 && !candleOut) {
        sampleMicAndDetectBlow(t);
      }

      requestAnimationFrame(tick);
    }

    return { resize, tick, setIntensity, celebrationBurst };
  })();

  function boot() {
    fx.resize();
    ctx.fillStyle = 'rgba(5, 3, 12, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(fx.tick);
  }

  window.addEventListener('resize', () => fx.resize(), { passive: true });

  setScene(0);
  boot();
})();
