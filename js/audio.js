/* 열나흘 — 배경음악과 효과음. 음원 파일 없이 WebAudio 로 직접 합성 (저작권 걱정 없음)
 * 느린 로파이: 일렉트릭 피아노풍 코드 + 낮은 베이스 + 부드러운 드럼 + 종이 긁는 잡음.
 * mood: 'calm'(평소) · 'tense'(D-3 이후, 조금 빨라지고 밝아짐) · 'exam'(시험: 드럼 빠지고 시계 소리) · 'after'(결과: 느리고 따뜻하게)
 */
var Sound = (function () {
  'use strict';
  var ctx = null, master, musicBus, lp, on = false, timer = null, step = 0, nextT = 0, mood = 'calm', noiseBuf = null, wob;

  // Fmaj7 – Em7 – Dm9 – Cmaj7 / Am7 – Dm7 – Gsus – Cmaj7  (다장조, 편안한 진행)
  var PROG = [
    [[53, 57, 60, 64], 41], [[52, 55, 59, 62], 40], [[50, 53, 57, 64], 38], [[48, 52, 55, 59], 36],
    [[57, 60, 64, 67], 45], [[50, 53, 57, 60], 38], [[55, 60, 62, 65], 43], [[48, 52, 55, 59], 36]
  ];
  var MELODY = [72, null, 76, 74, null, 72, 69, null, 67, null, 69, 72, null, null, 74, null];
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function init() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.4;
    musicBus = ctx.createGain(); musicBus.gain.value = 0.9; musicBus.connect(lp); lp.connect(master);
    // 테이프가 살짝 우는 느낌
    wob = ctx.createOscillator(); wob.frequency.value = 0.35; var wg = ctx.createGain(); wg.gain.value = 4; wob.connect(wg); wob._g = wg; wob.start();
    var len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(freq, t, dur, vol, type, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq; wob._g.connect(o.detune);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, freq, q, type) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  function kick(t, v) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
  }

  function bpm() { return mood === 'tense' ? 84 : mood === 'after' ? 66 : mood === 'exam' ? 60 : 74; }

  /* 16분음표 한 칸씩 예약. 한 마디 = 16칸, 코드 하나가 한 마디 */
  function schedule() {
    if (!on) return;
    var sp = 60 / bpm() / 4;
    while (nextT < ctx.currentTime + 0.25) {
      var bar = Math.floor(step / 16) % PROG.length, s = step % 16, ch = PROG[bar], t = nextT + (s % 2 ? sp * 0.18 : 0); // 살짝 뒤로 미는 스윙
      if (mood === 'exam') {
        if (s % 4 === 0) noise(t, 0.03, s % 8 === 0 ? 0.10 : 0.06, 2600, 6); // 시계 초침
        if (s === 0) ch[0].slice(0, 2).forEach(function (n) { tone(hz(n - 12), t, sp * 15, 0.05, 'sine'); });
      } else {
        if (s === 0 || s === 10) ch[0].forEach(function (n, i) { tone(hz(n), t + i * 0.018, sp * (s === 0 ? 9 : 5), 0.055, 'triangle'); tone(hz(n) * 2, t + i * 0.018, sp * 2, 0.012, 'sine'); });
        if (s === 0 || s === 7 || (s === 12 && bar % 2)) tone(hz(ch[1]), t, sp * 4, 0.11, 'sine');
        if (mood !== 'after') {
          if (s === 0 || s === 9) kick(t, 0.22);
          if (s === 4 || s === 12) noise(t, 0.12, 0.07, 1800, 0.8);
          if (s % 2 === 0) noise(t, 0.035, s % 4 === 2 ? 0.03 : 0.016, 7000, 1.5, 'highpass');
        }
        var m = MELODY[(step + bar * 3) % 16];
        if (m && s % 2 === 0 && (bar % 4 >= 2 || mood === 'after')) tone(hz(m), t, sp * 3.5, 0.035, 'sine');
      }
      if (s === 0) noise(t, sp * 16, 0.008, 5000, 0.3, 'highpass'); // 종이·테이프 잡음
      nextT += sp; step++;
    }
  }

  function start() {
    init(); if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    on = true; nextT = ctx.currentTime + 0.08; step = 0;
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
    clearInterval(timer); timer = setInterval(schedule, 60); schedule();
    return true;
  }
  function stop() {
    on = false; clearInterval(timer);
    if (ctx) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
  }
  function setMood(m) {
    mood = m;
    if (ctx && lp) lp.frequency.setTargetAtTime(m === 'tense' ? 2400 : m === 'exam' ? 900 : m === 'after' ? 1900 : 1500, ctx.currentTime, 0.8);
  }

  /* 효과음: 소리가 켜져 있을 때만 */
  function sfx(kind) {
    if (!on || !ctx) return;
    var t = ctx.currentTime + 0.01;
    if (kind === 'tick') noise(t, 0.05, 0.10, 3200, 3);
    else if (kind === 'page') { noise(t, 0.22, 0.09, 1400, 0.6); noise(t + 0.05, 0.18, 0.05, 4200, 0.8); }
    else if (kind === 'pen') { noise(t, 0.16, 0.08, 2600, 2.5); noise(t + 0.12, 0.1, 0.06, 3000, 2.5); }
    else if (kind === 'good') { tone(hz(72), t, 0.25, 0.09, 'sine', master); tone(hz(76), t + 0.09, 0.3, 0.09, 'sine', master); tone(hz(79), t + 0.18, 0.5, 0.09, 'sine', master); }
    else if (kind === 'bad') { tone(hz(58), t, 0.3, 0.09, 'triangle', master); tone(hz(53), t + 0.14, 0.45, 0.09, 'triangle', master); }
    else if (kind === 'stamp') { kick(t, 0.5); noise(t, 0.08, 0.14, 900, 0.7); }
    else if (kind === 'bell') { [84, 88, 91].forEach(function (n, i) { tone(hz(n), t + i * 0.03, 1.4, 0.05, 'sine', master); }); }
  }

  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (on) ctx.resume();
  });

  return { start: start, stop: stop, setMood: setMood, sfx: sfx, isOn: function () { return on; } };
})();
