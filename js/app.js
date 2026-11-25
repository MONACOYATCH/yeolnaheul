/* 열나흘 — 화면 진행 */
(function () {
  'use strict';
  var E = Engine, D = DATA, $app = document.getElementById('app');
  var SAVE = 'yeolnaheul.save.v1', PLAN = 'yeolnaheul.plan.v1', HIST = 'yeolnaheul.hist.v1', PROMISE = 'yeolnaheul.promise.v1';
  var S = { screen: 'cover', g: null, ui: null, guess: {}, tab: 'memo', plan: null, minCond: 100 };
  var SLOT_NAME = { 0: '낮', 1: '저녁', 2: '심야' };
  var SLOT_ASK = { 0: '낮 시간, 어디에 쓸까?', 1: '저녁 시간, 어디에 쓸까?', 2: '새벽 1시. 한 칸 더.' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장이 안 돼도 진행은 됨 */ } }
  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save() { if (S.g && !S.g.over) store(SAVE, { g: S.g, ui: S.ui, minCond: S.minCond }); }
  function course(id) { return E.COURSES.filter(function (c) { return c.id === id; })[0]; }
  function pct(v) { return Math.round(v * 100); }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1800); }
  function go(screen) { S.screen = screen; render(); window.scrollTo(0, 0); var h = $app.querySelector('h1,h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }

  /* ---------- 표지 ---------- */
  function vCover() {
    var saved = load(SAVE);
    return '<section class="cover fade">' +
      '<div class="eyebrow">기말고사 D-14 · 공부법 실험실</div>' +
      '<h1 class="big">열나흘<svg viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true"><path d="M12 76C8 30 80 8 160 10s136 24 128 66-70 58-150 56S20 118 12 76c-2-22 14-40 40-50"/></svg></h1>' +
      '<p class="sub">시험까지 14일, 하루 두 칸.</p>' +
      '<p class="pen memo">아는 것 같은 느낌 ≠ 아는 것</p>' +
      '<div class="box"><p class="lead">가상의 기말고사 2주를 내 방식대로 살아 봅니다. 평소 하던 대로 고르세요. 끝나면 <span class="hl">성적표와 해설, 그리고 진짜 내 기말 계획표</span>를 받아 갑니다.</p>' +
      '<ol class="ruleList"><li>하루에 <b>낮·저녁 두 칸</b>. 과목과 공부 방법을 고른다.</li><li>화면에 보이는 건 <b>‘아는 느낌’</b>뿐. 진짜 실력은 시험 날 공개된다.</li><li>밤을 새우면 한 칸이 더 생긴다. 공짜는 아니다.</li></ol></div>' +
      '<div class="sticky stack">' +
      (saved && saved.g && !saved.g.over ? '<button class="btn wide" data-act="resume">이어서 하기 (D-' + (15 - saved.g.day) + ')</button><button class="btn ghost wide" data-act="start">처음부터</button>' : '<button class="btn wide" data-act="start">14일 시작하기</button>') +
      '</div>' +
      '<div class="row" style="margin-top:6px"><button class="link" data-act="plan">게임 없이 계획표만 만들기</button><span class="sp"></span><button class="link" data-act="credits">근거·출처</button></div>' +
      '<div class="meta"><span>5–7분</span><span>소리 있음(오른쪽 아래)</span><span>기록은 이 기기에만 저장</span></div>' +
      '</section>';
  }

  /* ---------- 준비 ---------- */
  function vBrief() {
    return '<section class="fade stack"><div class="eyebrow">시험 범위</div><h2>이번 학기, 세 과목</h2>' +
      '<p>과목마다 범위는 8조각. 색이 찬 동그라미는 <b>수업에서 한 번 들은 부분</b>입니다. 들은 지 오래돼서 가물가물합니다.</p>' +
      '<div class="courses">' + E.COURSES.map(function (c) { return courseCard(c, false); }).join('') + '</div>' +
      '<div class="box"><h3>공부 방법 여섯 가지</h3><p class="muted" style="margin:4px 0 10px">어떤 건 하고 나면 뿌듯하고, 어떤 건 하고 나면 찜찜합니다. 그 기분이 실력과 같은 방향인지는 직접 확인해 보세요.</p>' +
      '<div class="methods">' + methodButtons(true) + '</div></div>' +
      '<div class="sticky"><button class="btn wide" data-act="day1">D-14, 첫날 시작</button></div></section>';
  }

  function courseCard(c, asButton, sel) {
    var g = S.g || E.newGame(), cs = E.courseOf(g, c.id), f = pct(E.felt(g, c.id));
    var dots = cs.chunks.map(function (ch) { return '<i class="' + (ch.learned ? 'on' : '') + '"></i>'; }).join('');
    var seen = cs.chunks.filter(function (ch) { return ch.learned; }).length;
    var inner = '<span class="tag">' + c.short + '</span><span class="nm">' + c.name + '</span><span class="dots" role="img" aria-label="범위 8조각 가운데 ' + seen + '조각을 본 적 있음">' + dots + '</span>' + (asButton ? '' : '<span class="ds">' + c.desc + '</span>') +
      '<span class="feel"><span>아는 느낌</span><span class="bar"><b style="width:' + f + '%"></b></span><span class="num">' + f + '%</span></span>';
    return asButton ? '<button class="course compact' + (sel ? ' sel' : '') + '" data-c="' + c.id + '" data-act="course" data-id="' + c.id + '" aria-pressed="' + (sel ? 'true' : 'false') + '">' + inner + '</button>'
      : '<div class="course" data-c="' + c.id + '">' + inner + '</div>';
  }
  function methodButtons(preview) {
    var out = '', ids = ['read', 'summary', 'recall', 'practice', 'teach', 'rest'];
    ids.forEach(function (id) {
      var m = E.METHODS[id], dis = !preview && id !== 'rest' && !S.ui.sel;
      var tag = preview ? 'div' : 'button';
      out += '<' + tag + ' class="method' + (id === 'rest' ? ' rest' : '') + '"' + (preview ? '' : ' data-act="method" data-id="' + id + '"' + (dis ? ' disabled' : '')) + '>' + D.ICONS[id] + '<span><b>' + m.name + '</b><span>' + m.sub + '</span></span></' + tag + '>';
    });
    return out;
  }

  /* ---------- 하루 ---------- */
  function topBar() {
    var g = S.g, cal = '';
    for (var d = 1; d <= E.DAYS; d++) {
      var cls = d < g.day ? (S.ui.ups[d] ? 'done up' : 'done') : d === g.day ? 'now' : '';
      cal += '<i class="' + cls + '"></i>';
    }
    var low = g.cond < 45;
    return '<div class="top"><div class="dday"><small>' + g.day + '일째 · ' + SLOT_NAME[Math.min(g.slot, 2)] + '</small>D-' + (15 - g.day) + '</div><div class="cal" role="img" aria-label="14일 가운데 ' + g.day + '일째">' + cal + '</div></div>' +
      '<p class="diary">' + esc(D.DIARY[g.day] || '') + '</p><div class="cond' + (low ? ' low' : '') + '"><span>컨디션</span><span class="bar"><b style="width:' + g.cond + '%"></b></span><span class="num">' + Math.round(g.cond) + '</span></div>';
  }
  function noteHtml() {
    var n = S.ui.note; if (!n) return '';
    var c = n.course ? course(n.course) : null;
    return '<div class="note" style="--cc:var(--c-' + (c ? c.id : 'x') + ', var(--ink))"><span class="who">' + esc(n.who) + '</span>' + (n.marks || '') + '<span class="pen blue">' + esc(n.text) + '</span>' + (n.extra ? '<span class="muted">' + esc(n.extra) + '</span>' : '') + (n.tip ? '<span class="pen tip">' + esc(n.tip) + '</span>' : '') + '</div>';
  }
  function vDay() {
    var g = S.g, ui = S.ui, body;
    if (ui.phase === 'event') body = eventHtml();
    else if (ui.phase === 'after') body = '<div class="slip fade"><h3>' + esc(ui.ev.title) + '</h3><p>' + esc(ui.after) + '</p><div class="choices"><button class="btn sm" data-act="evok">계속</button></div></div>';
    else if (ui.phase === 'night') {
      var last = g.day === E.DAYS;
      body = noteHtml() + '<div class="box fade" style="margin-top:16px"><div class="eyebrow">밤 11시 30분</div><h3 style="margin:4px 0 6px">' + (last ? '내일 아침이 시험이다.' : '오늘 두 칸을 다 썼다.') + '</h3>' +
        '<p class="muted">자면 오늘 공부한 것이 굳고 컨디션이 돌아온다. 밤을 새우면 한 칸이 더 생기지만 내일이 흐려진다.</p>' +
        '<div class="choices"><button class="choice" data-act="sleep">잔다<small>오늘 본 것 저장 · 컨디션 회복</small></button><button class="choice" data-act="stayup">밤샘해서 한 칸 더<small>칸 +1 · 저장 안 됨 · 내일 컨디션 하락</small></button></div></div>';
    } else {
      body = noteHtml() + '<div class="slotHead"><h3>' + SLOT_ASK[g.slot] + '</h3><span class="step">' + (g.slot === 2 ? '밤샘' : '오늘 ' + (g.slot + 1) + '/2') + '</span></div>' +
        (ui.last && !ui.sel ? '<button class="again" data-act="repeat">방금처럼 · ' + course(ui.last.c).short + ' ' + E.METHODS[ui.last.m].name + '</button>' : '') +
        '<div class="courses">' + E.COURSES.map(function (c) { return courseCard(c, true, ui.sel === c.id); }).join('') + '</div>' +
        '<div class="slotHead"><h3 style="font-size:17px">' + (ui.sel ? course(ui.sel).name + ', 어떻게?' : '과목을 먼저 고르세요') + '</h3></div>' +
        '<div class="methods">' + methodButtons(false) + '</div>';
    }
    return '<section>' + topBar() + body + '</section>';
  }

  function eventHtml() {
    var ev = S.ui.ev;
    return '<div class="slip fade"><div class="eyebrow">D-' + (15 - S.g.day) + ' 아침</div><h3>' + esc(ev.title) + '</h3><p>' + esc(ev.text) + '</p><div class="choices">' +
      ev.choices.map(function (c, i) { return '<button class="choice" data-act="choice" data-i="' + i + '">' + esc(c.label) + (c.small ? '<small>' + esc(c.small) + '</small>' : '') + '</button>'; }).join('') + '</div></div>';
  }
  function startDay() {
    var g = S.g, ui = S.ui, ev = D.EVENTS[g.day];
    ui.sel = null; ui.blocked = {}; ui.phase = 'slot';
    Sound.setMood(g.day >= 12 ? 'tense' : 'calm');
    if (ev) {
      ev = { title: ev.title, text: ev.text, choices: ev.choices, dynamic: ev.dynamic };
      if (ev.dynamic === 'body') {
        if (g.allNighters >= 1 || g.cond < 50) { ev.text = '목이 칼칼하고 눈이 뻑뻑하다. 그동안 밀린 잠이 한꺼번에 청구서를 보냈다.'; ev.choices = [{ label: '버틴다', small: '컨디션 −18', effect: { cond: -18 }, after: '따뜻한 물을 마시고 책상에 앉았다. 글자가 조금 흔들린다.' }]; }
        else { ev.text = '아침에 눈이 저절로 떠졌다. 잠을 지킨 덕에 몸이 가볍다.'; ev.choices = [{ label: '좋다', small: '컨디션 +8', effect: { cond: 8 }, after: '' }]; }
      }
      if (ev.dynamic === 'quiz') {
        var worst = E.COURSES.map(function (c) { return { c: c, f: pct(E.felt(g, c.id)), a: pct(E.actual(g, c.id)) }; }).sort(function (x, y) { return (y.f - y.a) - (x.f - x.a); })[0];
        ev.text = worst.c.name + ' 수업, 교수님이 A4 반 장을 나눠 준다. "지난 범위에서 다섯 문제. 성적에는 안 들어갑니다."';
        ev.choices = [{ label: '풀어 본다', small: '', effect: {}, after: (worst.f - worst.a >= 10 ? '아는 느낌은 ' + worst.f + '%였는데, 실제로 쓴 건 ' + worst.a + '%였다. 읽을 땐 분명 다 알았는데.' : '아는 느낌 ' + worst.f + '%, 실제로 쓴 것 ' + worst.a + '%. 느낌과 실제가 거의 같다. 꺼내 본 만큼만 믿은 덕이다.') + ' 덮고 써 봐야 진짜 실력이 보인다.' }];
        ui.quiz = { id: worst.c.id, f: worst.f, a: worst.a };
      }
      ui.ev = ev; ui.phase = 'event';
    }
    save(); render(); window.scrollTo(0, 0);
  }
  function applyChoice(i) {
    var g = S.g, ui = S.ui, c = ui.ev.choices[i], ef = c.effect || {};
    if (ef.cond) g.cond = Math.max(0, Math.min(100, g.cond + ef.cond));
    if (ef.block) ui.blocked[ef.block] = ui.ev.title;
    if (ef.feel) g.courses.forEach(function (cs) { cs.chunks.forEach(function (ch) { ch.feel = Math.min(1, ch.feel + ef.feel); }); });
    Sound.sfx('page');
    if (c.after) { ui.after = c.after; ui.phase = 'after'; } else ui.phase = 'slot';
    save(); render();
  }

  function pickLine(entry, n, k) {
    var L = D.LINES, m = entry.method, seed = entry.day * 3 + entry.slot, arr;
    if (m === 'read') arr = entry.fresh >= 2 ? L.readFresh : L.read;
    else if (m === 'summary') arr = L.summary;
    else if (m === 'rest') arr = L.rest;
    else {
      var r = k / n, base = m === 'teach' ? 'teach' : m;
      arr = r >= 0.67 ? L[base + 'Good'] : (r >= 0.34 || m === 'teach') ? L[base + 'Mid'] : L[base + 'Bad'];
    }
    return arr[seed % arr.length];
  }
  function doMethod(id) {
    var g = S.g, ui = S.ui;
    if (id !== 'rest' && !ui.sel) return;
    var cid = id === 'rest' ? (ui.sel || 'memo') : ui.sel, m = E.METHODS[id];
    var tired = g.cond < 35 && id !== 'rest';
    var e = E.study(g, cid, id);
    S.minCond = Math.min(S.minCond, g.cond);
    var note = { who: 'D-' + (15 - g.day) + ' ' + SLOT_NAME[g.slot] + ' · ' + (id === 'rest' ? '쉬기' : course(cid).name + ' · ' + m.name), course: id === 'rest' ? null : cid };
    if (m.retrieval) {
      var n = m.cover, k = Math.max(0, Math.min(n, Math.round(n - e.missed))), marks = '';
      for (var i = 0; i < n; i++) marks += '<i class="' + (i < k ? '' : 'x') + '"></i>';
      note.marks = '<span class="marks" role="img" aria-label="' + n + '개 가운데 ' + k + '개 떠올림">' + marks + '</span>';
      note.text = pickLine(e, n, k);
      note.extra = n + '개 가운데 ' + k + '개를 떠올렸다.';
      Sound.sfx(k / n >= 0.67 ? 'good' : 'pen');
    } else { note.text = pickLine(e, 1, 1); Sound.sfx(id === 'rest' ? 'bell' : 'page'); }
    if (tired) note.extra = (note.extra ? note.extra + ' ' : '') + D.LINES.tired;
    var tips = ui.tips || (ui.tips = {}), tip = null;
    function once(k) { if (tips[k]) return false; tips[k] = 1; tip = D.TIPS[k]; return true; }
    tips.reads = (tips.reads || 0) + (id === 'read' ? 1 : 0);
    var sameDay = g.log.filter(function (x) { return x.day === g.day && x.course === cid && x.method === id; }).length >= 2;
    if (m.retrieval) once('firstPull');
    if (!tip && id === 'read' && tips.reads >= 3) once('thirdRead');
    if (!tip && sameDay && id !== 'rest') once('sameDay');
    if (!tip && g.cond < 30) once('lowCond');
    note.tip = tip;
    ui.note = note; ui.sel = null; if (id !== 'rest') ui.last = { c: cid, m: id };
    advance();
  }
  function advance() {
    var g = S.g, ui = S.ui;
    if (g.slot === 2) return closeDay(true);
    if (g.slot === 0) {
      g.slot = 1;
      if (ui.blocked.eve) { ui.note = { who: 'D-' + (15 - g.day) + ' 저녁', text: ui.blocked.eve + '에 저녁을 썼다.', extra: ui.note ? '(낮: ' + ui.note.text + ')' : '' }; ui.phase = 'night'; }
    } else ui.phase = 'night';
    save(); render();
  }
  function closeDay(stayUp) {
    var g = S.g, ui = S.ui;
    if (stayUp) ui.ups[g.day] = 1;
    E.endDay(g, stayUp);
    ui.note = stayUp ? { who: '새벽', text: '창밖이 밝아 온다. 머리가 솜 같다.', tip: (ui.tips = ui.tips || {}).firstUp ? null : (ui.tips.firstUp = 1, D.TIPS.firstUp) } : null;
    if (g.over) { store(SAVE, null); Sound.setMood('exam'); return go('guess'); }
    Sound.sfx('tick');
    startDay();
  }

  /* ---------- 예상 성적 ---------- */
  function vGuess() {
    var grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
    var ready = E.COURSES.every(function (c) { return S.guess[c.id]; });
    return '<section class="fade stack"><div class="eyebrow">시험장 가는 길</div><h2>몇 점 나올 것 같아?</h2><p>시험지를 받기 전에, 지금 느낌대로 예상 성적을 적어 두세요. 나중에 실제와 비교합니다.</p>' +
      E.COURSES.map(function (c) {
        return '<div class="box" style="--cc:var(--c-' + c.id + ')"><div class="row"><b>' + c.name + '</b><span class="sp"></span><span class="muted">아는 느낌 <span class="num">' + pct(E.felt(S.g, c.id)) + '%</span></span></div><div class="guess" role="group" aria-label="' + c.name + ' 예상 성적">' +
          grades.map(function (gr) { return '<button data-act="guess" data-id="' + c.id + '" data-g="' + gr + '" class="' + (S.guess[c.id] === gr ? 'on' : '') + '" aria-pressed="' + (S.guess[c.id] === gr) + '">' + gr + '</button>'; }).join('') + '</div></div>';
      }).join('') +
      '<div class="sticky"><button class="btn wide" data-act="exam"' + (ready ? '' : ' disabled') + '>시험지 받기</button></div></section>';
  }

  /* ---------- 시험 ---------- */
  var EXAM_LINES = ['시험지가 넘어온다.', '1번. 분명히 본 문제다.', '봤다는 건 기억나는데, 답이 기억나지 않는다.', '…', '종이 울렸다.'];
  function vExam() { return '<section class="exam"><div><div class="eyebrow">15일째 · 오전 9:00</div><div class="clock" id="clk">09:00</div><p id="exl">' + EXAM_LINES[0] + '</p><button class="link" data-act="skipexam">건너뛰기</button></div></section>'; }
  var examTimer = null;
  function runExam() {
    var i = 0, good = S.g.result.avg >= 77;
    var lines = good ? ['시험지가 넘어온다.', '1번. 본 문제다.', '덮고 써 봤던 그 내용이다. 손이 먼저 움직인다.', '…', '종이 울렸다.'] : EXAM_LINES;
    clearInterval(examTimer);
    examTimer = setInterval(function () {
      i++; var c = document.getElementById('clk'), l = document.getElementById('exl');
      if (!c || i >= lines.length) { clearInterval(examTimer); if (c) showResult(); return; }
      c.textContent = ['09:00', '09:12', '09:31', '09:48', '10:15'][i]; l.textContent = lines[i]; Sound.sfx('tick');
    }, 1500);
  }
  function showResult() { clearInterval(examTimer); var h = load(HIST) || []; S.prev = h.length ? h[h.length - 1] : null; h.push({ avg: S.g.result.avg, type: S.g.result.type }); store(HIST, h.slice(-10)); Sound.setMood('after'); Sound.sfx('stamp'); go('result'); }

  /* ---------- 성적표 ---------- */
  function refRun() {
    // 같은 28칸을 "읽고 → 간격 두고 꺼내 보기"로 썼을 때 (비교용)
    var g = E.newGame(), ids = ['memo', 'calc', 'essay'];
    function m(c, d) { return c === 'calc' ? 'practice' : c === 'essay' ? (d % 2 ? 'teach' : 'recall') : 'recall'; }
    while (!g.over) {
      var d = g.day, a = ids[d % 3], b = ids[(d + 1) % 3];
      g.slot = 0; E.study(g, a, d <= 5 ? 'read' : m(a, d));
      g.slot = 1; E.study(g, b, d <= 5 ? (d >= 3 ? m(b, d) : 'summary') : (d % 5 === 0 ? 'rest' : m(b, d)));
      E.endDay(g, false);
    }
    return g.result;
  }
  function chart(id) {
    var H = S.g.history, W = 320, Ht = 170, L = 30, R = 8, T = 10, B = 24, w = W - L - R, h = Ht - T - B;
    function x(d) { return L + w * d / 14; } function y(v) { return T + h * (1 - v); }
    function path(key) { return H.map(function (r, i) { return (i ? 'L' : 'M') + x(r.day).toFixed(1) + ' ' + y(r[key][id]).toFixed(1); }).join(' '); }
    var grid = '';
    [0, 0.5, 1].forEach(function (v) { grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#D6CCB6" stroke-width="1"/><text x="' + (L - 5) + '" y="' + (y(v) + 4) + '" font-size="10" text-anchor="end" fill="#55607A" font-family="IBM Plex Mono,monospace">' + (v * 100) + '</text>'; });
    [1, 7, 14].forEach(function (d) { grid += '<text x="' + x(d) + '" y="' + (Ht - 7) + '" font-size="10" text-anchor="middle" fill="#55607A" font-family="IBM Plex Mono,monospace">' + (d === 14 ? '시험' : 'D-' + (15 - d)) + '</text>'; });
    var ups = ''; Object.keys(S.ui ? S.ui.ups : {}).forEach(function (d) { ups += '<rect x="' + (x(+d) - 4) + '" y="' + T + '" width="8" height="' + h + '" fill="#E5482D" opacity=".12"/>'; });
    var last = H[H.length - 1], col = 'var(--c-' + id + ')';
    var cs = S.g.result.courses.filter(function (c) { return c.id === id; })[0];
    return '<svg viewBox="0 0 ' + W + ' ' + Ht + '" role="img" aria-label="' + course(id).name + ': 14일 동안의 아는 느낌과 실제 기억. 마지막 날 느낌 ' + cs.felt + ', 실제 점수 ' + cs.score + '">' + grid + ups +
      '<path d="' + path('felt') + '" fill="none" stroke="#D99A00" stroke-width="2.5" stroke-dasharray="5 4" stroke-linecap="round"/>' +
      '<path d="' + path('actual') + '" fill="none" stroke="' + col + '" style="stroke:' + col + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + x(14) + '" cy="' + y(last.actual[id]) + '" r="4.5" style="fill:' + col + '"/><circle cx="' + x(14) + '" cy="' + y(last.felt[id]) + '" r="4" fill="#fff" stroke="#D99A00" stroke-width="2"/></svg>';
  }
  function vResult() {
    var r = S.g.result, t = D.TYPES[r.type], ref = refRun(), prev = S.prev;
    var rows = r.courses.map(function (c) {
      return '<tr><td><b>' + course(c.id).name + '</b></td><td>' + (S.guess[c.id] || '–') + '</td><td>' + c.felt + '%</td><td>' + c.score + '</td><td><span class="gr">' + c.grade + '</span></td></tr>';
    }).join('');
    var over = r.courses.filter(function (c) { return c.gap >= 12; }).length;
    var verdict = over >= 2 ? '느낌이 실제보다 한참 높았다. 그 차이가 이 게임의 주제다.' : r.avg >= 80 ? '느낌에 속지 않았다. 꺼내 본 만큼만 믿었다.' : '느낌과 실제가 크게 다르진 않았다. 이제 실제를 올릴 차례.';
    var keep = r.courses.map(function (c) { return '<div class="k" style="--cc:var(--c-' + c.id + ')"><span>' + course(c.id).short + '</span><span class="bar"><b style="width:' + c.score + '%"></b><u style="width:' + c.after2w + '%"></u></span><span class="num">' + c.after2w + '%</span></div>'; }).join('');
    return '<section class="stack fade"><div class="eyebrow">2학기 기말고사 · 성적표</div><h2>결과</h2>' +
      '<div class="report"><div class="avgRow"><span class="muted">세 과목</span><span class="avgWrap"><svg class="circle" viewBox="0 0 120 74" preserveAspectRatio="none" aria-hidden="true"><path d="M8 40C4 14 40 4 70 6s46 14 42 34-30 30-58 28S10 58 8 40"/></svg><span class="avg">평균 ' + r.avg + '</span></span></div>' +
      '<table><thead><tr><th>과목</th><th>내 예상</th><th>아는 느낌</th><th>점수</th><th>성적</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="pen" style="transform:rotate(-1deg)">' + verdict + '</p>' +
      '<div class="typeCard"><div class="eyebrow">나의 14일 유형</div><h2>' + t.name + '</h2><p><b>' + t.line + '</b></p><p style="margin-top:8px">' + t.body + '</p></div>' +
      '<div><h3 style="margin-bottom:8px">느낌과 실제, 14일의 기록</h3><div class="tabs" role="tablist">' + E.COURSES.map(function (c) { return '<button role="tab" data-act="tab" data-id="' + c.id + '" aria-selected="' + (S.tab === c.id) + '" class="' + (S.tab === c.id ? 'on' : '') + '" style="--cc:var(--c-' + c.id + ')">' + c.short + '</button>'; }).join('') + '</div>' +
      '<div class="chartWrap">' + chart(S.tab) + '<div class="legend"><span><i class="f"></i>아는 느낌</span><span><i style="border-color:var(--c-' + S.tab + ')"></i>실제로 떠올릴 수 있는 정도</span>' + (r.allNighters ? '<span style="color:var(--red)">붉은 띠 = 밤샘</span>' : '') + '</div></div></div>' +
      '<div class="box"><h3>종강 2주 뒤에도 남는 것</h3><p class="muted" style="margin:4px 0 10px">옅은 막대는 시험 점수, 진한 막대는 2주 뒤에도 떠올릴 수 있는 양입니다.</p><div class="keep">' + keep + '</div></div>' +
      '<div class="box"><h3>같은 28칸, 다른 방법이었다면</h3><p style="margin-top:6px">초반에 훑고, 간격을 두고 꺼내 보고, 매일 잤다면: <b class="num">평균 ' + ref.avg + '점</b> (' + ref.courses.map(function (c) { return course(c.id).short + ' ' + c.grade; }).join(' · ') + '). 내 결과는 <b class="num">' + r.avg + '점</b>.</p></div>' +
      (prev ? '<div class="box"><h3>지난 판과 비교</h3><p style="margin-top:6px">지난 판 <b class="num">' + prev.avg + '점</b> (' + esc(D.TYPES[prev.type].name) + ') → 이번 판 <b class="num">' + r.avg + '점</b>. ' + (r.avg > prev.avg ? '<span class="hl">' + (r.avg - prev.avg) + '점 올랐다.</span> 시간은 똑같이 28칸이었다.' : r.avg < prev.avg ? (prev.avg - r.avg) + '점 내려갔다. 무엇이 달랐는지 그래프에서 찾아보자.' : '점수가 같다.') + '</p></div>' : '') +
      '<div class="stack"><button class="btn wide" data-act="lessons">왜 이렇게 됐는지 보기</button></div>' +
      '<div class="row"><button class="link" data-act="again">다른 방법으로 한 번 더</button><span class="sp"></span><button class="link" data-act="share">결과 글로 복사</button></div></section>';
  }

  /* ---------- 해설 ---------- */
  function youLine(id) {
    var g = S.g, r = g.result, u = r.usage, n = Math.max(1, u.total);
    if (id === 'retrieval') return '공부한 ' + u.total + '칸 가운데 꺼내 보기 ' + u.retrieval + '칸, 읽기·정리 ' + u.passive + '칸.';
    if (id === 'spacing') return '공부한 칸의 ' + Math.round(u.lastThree / n * 100) + '%가 마지막 사흘에, ' + Math.round(u.firstHalf / n * 100) + '%가 첫 일주일에 있었다.';
    if (id === 'illusion') { var w = r.courses.slice().sort(function (a, b) { return b.gap - a.gap; })[0]; return course(w.id).name + ': 아는 느낌 ' + w.felt + '% → 실제 ' + w.score + '점.' + (S.guess[w.id] ? ' 내 예상은 ' + S.guess[w.id] + ', 결과는 ' + w.grade + '.' : ''); }
    if (id === 'sleep') return r.allNighters ? '밤샘 ' + r.allNighters + '번.' + (r.examEff < 1 ? ' 시험 당일, 아는 것의 ' + Math.round((1 - r.examEff) * 100) + '%가 머리에서 나오지 않았다.' : '') : '14일 내내 잤다. 공부한 날마다 저장이 됐다.';
    if (id === 'fit') { var ap = E.courseOf(g, 'calc').chunks.filter(function (c) { return c.applied; }).length, og = E.courseOf(g, 'essay').chunks.filter(function (c) { return c.organized; }).length; return '전공 8조각 가운데 문제로 풀어 본 건 ' + ap + '조각, 서술 8조각 가운데 내 말로 엮어 본 건 ' + og + '조각.'; }
    if (id === 'rest') return '쉬는 칸 ' + u.rest + '번. 컨디션이 가장 낮았을 때 ' + Math.round(S.minCond) + '.';
    return '';
  }
  function vLessons() {
    return '<section class="stack fade"><div class="eyebrow">해설지</div><h2>왜 이렇게 됐을까</h2><p>게임 규칙은 학습 연구에서 반복해서 확인된 결과의 <b>방향</b>을 옮긴 것입니다. 숫자 자체는 단순화한 값입니다.</p>' +
      D.LESSONS.map(function (l, i) { return '<article class="lesson"><div class="n">0' + (i + 1) + '</div><h3>' + l.title + '</h3><p>' + l.body + '</p><div class="you"><span class="muted">나의 14일</span><br>' + esc(youLine(l.id)) + '</div><p class="try">→ ' + l.tryIt + '</p><cite>' + l.cite + '</cite></article>'; }).join('') +
      '<div class="sticky"><button class="btn wide" data-act="check">덮고 답해 보기 (3문제)</button></div><div class="row"><button class="link" data-act="again">한 번 더 해 보기</button><span class="sp"></span><button class="link" data-act="plan">바로 계획표 만들기</button></div></section>';
  }

  /* ---------- 덮고 답해 보기 ---------- */
  function vCheck() {
    var A = S.quiz || (S.quiz = {}), done = D.QUIZ.every(function (q, i) { return A[i] != null; });
    var right = D.QUIZ.filter(function (q, i) { return A[i] === q.ok; }).length;
    var promise = load(PROMISE);
    return '<section class="stack fade"><div class="eyebrow">해설지는 덮었습니다</div><h2>덮고 답해 보기</h2><p>방금 읽은 내용을 보지 않고 답해 보세요. 이게 바로 <span class="hl">백지 복습</span>입니다.</p>' +
      D.QUIZ.map(function (q, i) {
        var picked = A[i];
        return '<div class="box"><div class="n num" style="color:var(--red);font-size:12px">Q' + (i + 1) + '</div><h3 style="margin:2px 0 10px;font-size:18px">' + q.q + '</h3><div class="choices" role="group" aria-label="' + (i + 1) + '번 보기">' +
          q.a.map(function (t, j) {
            var cls = picked == null ? '' : j === q.ok ? ' right' : j === picked ? ' wrong' : ' dim';
            return '<button class="choice qa' + cls + '" data-act="answer" data-i="' + i + '" data-j="' + j + '"' + (picked != null ? ' disabled' : '') + '>' + t + '</button>';
          }).join('') + '</div>' + (picked != null ? '<p class="pen" style="margin-top:10px">' + (picked === q.ok ? '○ ' : '✕ ') + q.why + '</p>' : '') + '</div>';
      }).join('') +
      (done ? '<div class="typeCard"><div class="eyebrow">' + right + ' / ' + D.QUIZ.length + '</div><h2 style="font-size:24px">' + (right === D.QUIZ.length ? '읽고, 덮고, 꺼냈다.' : '틀린 문제가 가장 오래 남는다.') + '</h2><p>방금 30초가 해설을 한 번 더 읽는 것보다 오래갑니다. 실제 공부에서도 똑같이 하면 됩니다.</p></div>' +
        '<div class="box"><h3>다음 시험에서 바꿔 볼 것 하나</h3><p class="muted" style="margin:4px 0 10px">하나만 고르세요. 계획표 맨 위에 적어 둡니다.</p><div class="choices">' +
        D.PROMISES.map(function (t, k) { return '<button class="choice' + (promise === t ? ' picked' : '') + '" data-act="promise" data-i="' + k + '" aria-pressed="' + (promise === t) + '">' + t + '</button>'; }).join('') + '</div></div>' +
        '<button class="btn wide" data-act="plan">진짜 내 기말 계획표 만들기</button>' : '') + '</section>';
  }

  /* ---------- 진짜 계획표 ---------- */
  function planState() {
    if (!S.plan) {
      S.plan = load(PLAN) || { today: Plan.iso(new Date()), subjects: [{ name: '', date: '', kind: 'memo' }, { name: '', date: '', kind: 'calc' }, { name: '', date: '', kind: 'essay' }], done: {}, built: false };
      if (!S.plan.built) S.plan.today = Plan.iso(new Date());
    }
    return S.plan;
  }
  function vPlan() {
    var p = planState(), out = '', promise = load(PROMISE);
    var form = p.subjects.map(function (s, i) {
      return '<div class="subj"><label class="field">과목 ' + (i + 1) + '<input type="text" maxlength="30" placeholder="예: 미시경제학" data-f="name" data-i="' + i + '" value="' + esc(s.name) + '"></label>' +
        '<label class="field">시험 날짜<input type="date" data-f="date" data-i="' + i + '" value="' + esc(s.date) + '"></label>' +
        '<label class="field">시험 유형<select data-f="kind" data-i="' + i + '">' + ['memo', 'calc', 'essay'].map(function (k) { return '<option value="' + k + '"' + (s.kind === k ? ' selected' : '') + '>' + Plan.KIND[k].label + '</option>'; }).join('') + '</select></label>' +
        (p.subjects.length > 1 ? '<button class="del" data-act="delsubj" data-i="' + i + '" aria-label="과목 ' + (i + 1) + ' 지우기">지우기</button>' : '') + '</div>';
    }).join('');
    if (p.built) {
      var plan = Plan.build(p.today, p.subjects), w = ['일', '월', '화', '수', '목', '금', '토'];
      if (!plan.days.length) out = '<p class="pen">과목 이름과 시험 날짜를 하나 이상 넣어 주세요.</p>';
      else out = '<div class="box plan" id="planOut"><h3>내 기말 계획표</h3><p class="muted">하루 최대 3개. 체크는 이 기기에 저장됩니다.</p>' +
        plan.days.map(function (d) {
          var dt = Plan.parse(d.date), key = d.date;
          return '<div class="dayrow' + (d.exams.length ? ' examrow' : '') + '"><div class="date">' + (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + w[dt.getDay()] + '<small>' + (d.left === 0 ? '오늘' : d.left + '일 뒤') + '</small></div><div>' +
            d.exams.map(function (x) { return '<div><span class="chip" style="background:var(--red)">시험</span><b>' + esc(x) + '</b></div>'; }).join('') +
            d.tasks.map(function (t, j) { var id = key + '|' + t.subj + '|' + j; return '<label><input type="checkbox" data-done="' + esc(id) + '"' + (p.done[id] ? ' checked' : '') + '><span><span class="chip" style="background:var(--c-' + t.kind + ')">' + esc(t.subj) + '</span>' + esc(t.text) + '</span></label>'; }).join('') + '</div></div>';
        }).join('') +
        (plan.warnings.length ? '<p class="muted" style="margin-top:10px">' + plan.warnings.map(esc).join('<br>') + '</p>' : '') + '</div>' +
        '<div class="row noprint" style="flex-wrap:wrap"><button class="btn sm ghost" data-act="copyplan">글로 복사</button><button class="btn sm ghost" data-act="ics">캘린더 파일(.ics)</button><button class="btn sm ghost" data-act="print">인쇄</button></div>';
    }
    return '<section class="stack fade"><div class="eyebrow">가져가는 것</div><h2>진짜 내 기말 계획표</h2><p>과목과 시험 날짜를 넣으면, 방금 본 원리(훑기 → 간격 두고 꺼내 보기 → 전날은 자기)대로 날짜별 할 일을 짜 드립니다. 입력한 내용은 <b>이 기기 밖으로 나가지 않습니다.</b></p>' +
      (promise ? '<p class="pen" style="transform:rotate(-1deg)">나와의 약속: ' + esc(promise) + '</p>' : '') + '<p class="muted">' + esc(D.EXAM_HINT) + '</p><div class="noprint stack"><label class="field">오늘 날짜<input type="date" data-f="today" value="' + esc(p.today) + '"></label>' + form +
      '<div class="row"><button class="btn sm ghost" data-act="addsubj"' + (p.subjects.length >= 7 ? ' disabled' : '') + '>과목 추가</button><span class="sp"></span><button class="btn sm" data-act="build">계획표 만들기</button></div></div>' + out +
      '<hr class="dash"><div class="noprint stack"><h3>생성형 AI를 ‘꺼내 보기 상대’로 쓰기</h3><p>AI에게 요약을 받아 읽는 건 ‘남의 요약본 훑기’와 같습니다. 반대로 <b>AI가 묻고 내가 답하게</b> 하면 백지 복습이 됩니다. 아래 문장을 복사해 쓰던 AI에 붙여 넣으세요.</p>' +
      D.PROMPTS.map(function (pr, i) { return '<div><div class="row" style="margin-bottom:6px"><b>' + pr.title + '</b><span class="sp"></span><button class="btn sm ghost" data-act="copyprompt" data-i="' + i + '">복사</button></div><div class="prompt">' + esc(pr.text) + '</div></div>'; }).join('') +
      '<p class="muted">AI의 채점과 설명은 틀릴 수 있습니다. 교재·강의자료로 다시 확인하세요. 과제나 시험에서의 AI 사용은 과목별 지침을 따르세요.</p>' +
      (D.DKU.length ? '<hr class="dash"><h3>단국대에서 바로 쓸 수 있는 것</h3>' + (D.DKU_NOTE ? '<p class="muted">' + D.DKU_NOTE + '</p>' : '') + D.DKU.map(function (r) { return '<a class="res" href="' + esc(r.url) + '" target="_blank" rel="noopener"><span class="use">' + esc(r.use) + '</span><b>' + esc(r.name) + '</b><span>' + esc(r.desc) + '</span><em>' + esc(r.where) + '</em></a>'; }).join('') : '') +
      '<div class="row"><button class="link" data-act="again">14일 다시 해 보기</button><span class="sp"></span><button class="link" data-act="credits">근거·출처</button></div></div></section>';
  }
  function download(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copy(text, msg) {
    function fb() { var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast(msg); } catch (e) { toast('복사하지 못했습니다. 길게 눌러 직접 복사해 주세요.'); } t.remove(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(msg); }, fb); else fb();
  }

  /* ---------- 근거·출처 ---------- */
  function vCredits() {
    return '<section class="stack fade"><div class="eyebrow">근거 · 출처 · 만든 방법</div><h2>이 콘텐츠에 대하여</h2>' +
      '<div class="box"><h3>무엇을 풀려고 했나</h3><p style="margin-top:6px">시험 기간에 가장 많이 쓰는 공부법(다시 읽기, 형광펜, 벼락치기, 밤샘)은 ‘열심히 한 느낌’은 크지만 효과가 낮다고 알려져 있습니다. 글로 읽으면 다 아는 이야기 같아서 행동이 바뀌지 않습니다. 그래서 14일을 직접 살아 보고 자기 선택의 결과를 보게 했습니다.</p></div>' +
      '<div class="box"><h3>기억 모델</h3><p style="margin-top:6px">조각마다 안정도 S를 두고 떠올릴 확률을 R = e<sup>−t/S</sup>로 계산합니다. 꺼내 보기는 R이 낮을 때 할수록 S가 크게 늘고, 자면 그날 본 조각의 S가 늘어납니다. 실제 사람의 점수를 예측하는 모델이 아니라, 연구 결과의 방향을 보여 주는 교육용 단순화입니다.</p></div>' +
      '<div class="box"><h3>참고한 연구</h3><p class="muted" style="margin-top:6px">' + D.LESSONS.map(function (l) { return l.cite; }).join('<br><br>') + '</p></div>' +
      '<div class="box"><h3>생성형 AI 활용</h3><p style="margin-top:6px">기획, 자료 조사와 정리, 기억 모델 설계와 균형 조정, 화면 디자인과 코드, 배경음악 합성 코드까지 생성형 AI(Claude)와 대화하며 만들었습니다. 배경음악과 효과음은 음원 파일 없이 브라우저에서 직접 합성합니다.</p></div>' +
      '<div class="row"><button class="link" data-act="home">처음으로</button></div></section>';
  }

  /* ---------- 그리기와 입력 ---------- */
  function render() {
    var v = { cover: vCover, brief: vBrief, day: vDay, guess: vGuess, exam: vExam, result: vResult, lessons: vLessons, check: vCheck, plan: vPlan, credits: vCredits }[S.screen];
    try { $app.innerHTML = v(); }
    catch (err) { store(SAVE, null); $app.innerHTML = '<section class="stack"><h2>문제가 생겼습니다</h2><p>진행 기록을 지우고 처음부터 다시 시작합니다.</p><button class="btn" onclick="location.reload()">다시 시작</button></section>'; if (window.console) console.error(err); return; }
    var live = document.getElementById('live'), nt = S.screen === 'day' && S.ui && S.ui.note;
    if (live) live.textContent = nt ? nt.who + '. ' + nt.text + ' ' + (nt.extra || '') : '';
    document.body.setAttribute('data-screen', S.screen);
    document.body.setAttribute('data-tense', S.screen === 'day' && S.g && S.g.day >= 12 ? '1' : '0');
  }
  function newRun() { S.g = E.newGame(); S.ui = { sel: null, note: null, blocked: {}, ups: {}, phase: 'slot' }; S.guess = {}; S.tab = 'memo'; S.minCond = 100; store(SAVE, null); Sound.setMood('calm'); }

  $app.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-act'), id = b.getAttribute('data-id'), i = +b.getAttribute('data-i'), p;
    switch (a) {
      case 'start': newRun(); Sound.sfx('page'); go('brief'); break;
      case 'resume': var sv = load(SAVE); if (sv && sv.g) { S.g = sv.g; S.ui = sv.ui; S.minCond = sv.minCond || 100; S.guess = {}; Sound.setMood(S.g.day >= 12 ? 'tense' : 'calm'); go('day'); } else { newRun(); go('brief'); } break;
      case 'day1': S.screen = 'day'; startDay(); break;
      case 'course': S.ui.sel = id; Sound.sfx('tick'); render(); break;
      case 'method': doMethod(id); break;
      case 'repeat': S.ui.sel = S.ui.last.c; doMethod(S.ui.last.m); break;
      case 'choice': applyChoice(i); break;
      case 'evok': S.ui.phase = 'slot'; save(); render(); break;
      case 'sleep': Sound.sfx('bell'); closeDay(false); break;
      case 'stayup': S.g.slot = 2; S.ui.phase = 'slot'; S.ui.note = { who: '밤 11시 30분', text: '커피를 한 잔 더 탔다.' }; save(); render(); break;
      case 'guess': S.guess[id] = b.getAttribute('data-g'); Sound.sfx('pen'); render(); break;
      case 'exam': go('exam'); runExam(); break;
      case 'skipexam': showResult(); break;
      case 'tab': S.tab = id; render(); break;
      case 'lessons': go('lessons'); break;
      case 'check': S.quiz = {}; go('check'); break;
      case 'answer': S.quiz[i] = +b.getAttribute('data-j'); Sound.sfx(S.quiz[i] === D.QUIZ[i].ok ? 'good' : 'bad'); render(); break;
      case 'promise': store(PROMISE, D.PROMISES[i]); Sound.sfx('pen'); render(); break;
      case 'share': var rr = S.g.result; copy('[열나흘] 기말 D-14 공부법 실험 결과\n나의 유형: ' + D.TYPES[rr.type].name + ' — ' + D.TYPES[rr.type].line + '\n' + rr.courses.map(function (c) { return course(c.id).name + ': 아는 느낌 ' + c.felt + '% → ' + c.score + '점(' + c.grade + ')'; }).join('\n') + '\n평균 ' + rr.avg + '점 · 밤샘 ' + rr.allNighters + '번\n' + location.href.split('?')[0], '결과를 복사했습니다.'); break;
      case 'again': newRun(); go('brief'); break;
      case 'plan': go('plan'); break;
      case 'credits': go('credits'); break;
      case 'home': go('cover'); break;
      case 'addsubj': p = planState(); if (p.subjects.length < 7) p.subjects.push({ name: '', date: '', kind: 'memo' }); store(PLAN, p); render(); break;
      case 'delsubj': p = planState(); p.subjects.splice(i, 1); store(PLAN, p); render(); break;
      case 'build': p = planState(); p.built = true; store(PLAN, p); render(); var o = document.getElementById('planOut'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); Sound.sfx('good'); break;
      case 'copyplan': p = planState(); copy(Plan.toText(Plan.build(p.today, p.subjects)), '계획표를 복사했습니다.'); break;
      case 'ics': p = planState(); download('열나흘-기말계획.ics', Plan.toICS(Plan.build(p.today, p.subjects)), 'text/calendar;charset=utf-8'); break;
      case 'print': window.print(); break;
      case 'copyprompt': copy(D.PROMPTS[i].text, '복사했습니다. AI에 붙여 넣으세요.'); break;
    }
  });
  $app.addEventListener('change', function (ev) {
    var t = ev.target, p;
    if (t.hasAttribute('data-f')) { p = planState(); var f = t.getAttribute('data-f'); if (f === 'today') p.today = t.value || Plan.iso(new Date()); else p.subjects[+t.getAttribute('data-i')][f] = t.value; store(PLAN, p); if (p.built && t.tagName !== 'INPUT') render(); }
    if (t.hasAttribute('data-done')) { p = planState(); p.done[t.getAttribute('data-done')] = t.checked; store(PLAN, p); if (t.checked) Sound.sfx('pen'); }
  });

  var snd = document.getElementById('snd');
  snd.addEventListener('click', function () {
    var on = !Sound.isOn();
    if (on) { if (!Sound.start()) { toast('이 브라우저에서는 소리를 낼 수 없습니다.'); on = false; } } else Sound.stop();
    snd.setAttribute('aria-pressed', on ? 'true' : 'false'); snd.setAttribute('aria-label', on ? '배경음악 끄기' : '배경음악 켜기');
  });

  window.__yn = { S: S, render: render }; // 자동 점검용
  render();
})();
