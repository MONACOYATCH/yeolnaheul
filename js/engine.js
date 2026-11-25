/* 열나흘 — 기억 시뮬레이션 엔진 (화면과 분리, node 에서도 그대로 돌아감)
 *
 * 모델 요약
 *  - 과목마다 "지식 조각" 12개. 조각은 안정도 S(일)와 마지막으로 본 시각 last 를 가짐.
 *  - 지금 떠올릴 수 있는 확률 R = exp(-(지금 - last) / S)   (지수 망각)
 *  - 다시 읽기: 금방 익숙해지지만(체감↑) S 는 조금만 늘어남.
 *  - 떠올리기(백지 복습·문제 풀이·설명하기): 힘들게 느껴지지만(체감 조금) S 가 크게 늘고,
 *    조금 잊었을 때(R 이 낮을 때) 할수록 더 크게 늘어남 → 간격을 두면 유리.
 *  - 잠을 자면 그날 공부한 조각이 굳고(S 보너스), 밤을 새우면 다음 날 효율과 시험 당일 인출이 떨어짐.
 *  수치는 실제 사람의 기억을 예측하는 값이 아니라, 연구에서 확인된 "방향과 순서"를 보여 주기 위한 교육용 값임.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAYS = 14;
  var CHUNKS = 8;
  var SLOTS = ['day', 'eve', 'night']; // 낮 · 저녁 · 심야(밤샘할 때만)

  var COURSES = [
    { id: 'memo', name: '암기형 교양', short: '교양', kind: 'memo', desc: '용어와 개념이 많은 과목. 범위가 넓다.', known: 3 },
    { id: 'calc', name: '문제풀이형 전공', short: '전공', kind: 'calc', desc: '공식을 알아도 문제에 못 쓰면 0점.', known: 3 },
    { id: 'essay', name: '서술형 전공', short: '서술', kind: 'essay', desc: '개념을 내 말로 엮어 써야 한다.', known: 2 }
  ];

  /* cover: 한 번에 다루는 조각 수, feel: 체감(아는 느낌) 증가, drain: 컨디션 소모 */
  var METHODS = {
    read:     { id: 'read',     name: '다시 읽기',   sub: '교재·필기에 줄 치며 읽기',  cover: 4, feel: 0.34, drain: 9,  retrieval: false },
    summary:  { id: 'summary',  name: '요약 정리',   sub: '보면서 노트로 옮겨 적기',    cover: 3, feel: 0.26, drain: 11, retrieval: false },
    recall:   { id: 'recall',   name: '백지 복습',   sub: '덮고 빈 종이에 써 보기',     cover: 3, feel: 0.08, drain: 14, retrieval: true },
    practice: { id: 'practice', name: '문제 풀이',   sub: '기출·연습문제를 시간 재고',  cover: 3, feel: 0.10, drain: 14, retrieval: true },
    teach:    { id: 'teach',    name: '설명하기',    sub: '친구(또는 벽)에게 가르치기', cover: 2, feel: 0.12, drain: 12, retrieval: true },
    rest:     { id: 'rest',     name: '쉬기',        sub: '산책·운동·멍 때리기',        cover: 0, feel: 0,    drain: -22, retrieval: false }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function newGame() {
    var g = { day: 1, slot: 0, cond: 80, allNighters: 0, log: [], history: [], courses: [], flags: {}, over: false, result: null };
    COURSES.forEach(function (c) {
      var chunks = [];
      for (var i = 0; i < CHUNKS; i++) {
        var known = i < c.known; // 학기 중에 수업에서 한 번 들은 부분
        chunks.push({ learned: known, S: known ? 6 : 0, last: known ? -6 - i : 0, feel: known ? 0.18 : 0, applied: false, organized: false, touched: -1, reps: 0 });
      }
      g.courses.push({ id: c.id, kind: c.kind, chunks: chunks, cursor: 0 });
    });
    snapshot(g);
    return g;
  }

  function now(g) { return (g.day - 1) + g.slot / 3; }
  var EXAM_T = DAYS + 0.1; // 15일째 아침

  function retr(ch, t) { return ch.learned ? Math.exp(-Math.max(0, t - ch.last) / ch.S) : 0; }

  function courseOf(g, id) { for (var i = 0; i < g.courses.length; i++) if (g.courses[i].id === id) return g.courses[i]; return null; }

  /* 실제 기억: 지금 떠올릴 수 있는 정도(0~1) */
  function actual(g, id, t) {
    var c = courseOf(g, id), sum = 0;
    if (t === undefined) t = now(g);
    c.chunks.forEach(function (ch) { sum += retr(ch, t) * quality(c, ch); });
    return sum / CHUNKS;
  }
  /* 체감: "아는 것 같은 느낌"(0~1). 읽을수록 빨리 차고 천천히 빠짐 */
  function felt(g, id) {
    var c = courseOf(g, id), sum = 0;
    c.chunks.forEach(function (ch) { sum += ch.feel; });
    return sum / CHUNKS;
  }
  /* 과목 성격: 문제풀이형은 풀어 본 적 없으면, 서술형은 엮어 본 적 없으면 점수로 못 바꿈 */
  function quality(c, ch) {
    if (c.kind === 'calc') return ch.applied ? 1 : 0.55;
    if (c.kind === 'essay') return ch.organized ? 1 : 0.7;
    return 1;
  }

  /* 이번 칸에 다룰 조각 고르기: 읽기 계열은 진도 순서대로, 떠올리기 계열은 배운 것 중 가장 가물가물한 것부터 */
  function pick(g, c, m) {
    var t = now(g), n = m.cover, out = [], i;
    if (!m.retrieval) {
      for (i = 0; i < n; i++) { out.push(c.chunks[c.cursor % CHUNKS]); c.cursor++; }
      return out;
    }
    var learned = c.chunks.filter(function (ch) { return ch.learned; });
    learned.sort(function (a, b) { return retr(a, t) - retr(b, t); });
    // 배운 것이 웬만큼 떠오르면(또는 배운 게 없으면) 안 본 조각 하나를 맨땅에 부딪혀 봄 (틀리고 답을 확인하며 배움)
    var fresh = c.chunks.filter(function (ch) { return !ch.learned; });
    var shaky = learned.filter(function (ch) { return retr(ch, t) < 0.6; }).length;
    if (fresh.length && shaky < n) out.push(fresh[0]);
    for (i = 0; out.length < n && i < learned.length; i++) out.push(learned[i]);
    for (i = 1; out.length < n && i < fresh.length; i++) out.push(fresh[i]);
    return out;
  }

  /* 한 칸 공부. 결과 요약을 돌려줌 */
  function study(g, courseId, methodId) {
    var m = METHODS[methodId], t = now(g);
    var eff = 0.45 + 0.55 * (g.cond / 100); // 컨디션이 낮으면 같은 시간에 덜 남음
    var entry = { day: g.day, slot: g.slot, course: courseId, method: methodId, eff: eff, gained: 0, fresh: 0, missed: 0 };
    if (methodId === 'rest') {
      g.cond = clamp(g.cond - m.drain, 0, 100);
      g.log.push(entry);
      return entry;
    }
    var c = courseOf(g, courseId);
    pick(g, c, m).forEach(function (ch) {
      var before = ch.learned ? ch.S : 0;
      if (!m.retrieval) {
        if (!ch.learned) { ch.learned = true; ch.S = (methodId === 'summary' ? 2.0 : 1.6) * (0.7 + 0.3 * eff); entry.fresh++; }
        else {
          var same = ch.touched === g.day; // 같은 날 또 읽으면 거의 안 늘어남 (몰아 읽기)
          ch.S += (methodId === 'summary' ? 0.62 : 0.36) * eff * (same ? 0.35 : 1);
        }
        if (methodId === 'summary') ch.organized = true;
        ch.feel = clamp(ch.feel + m.feel * (1 - ch.feel) * 1.6, 0, 1);
      } else {
        if (!ch.learned) {
          // 처음 보는 걸 문제로 먼저 부딪힘: 틀리고 답을 확인 → 배움 (사전 시험 효과, 다만 느림)
          ch.learned = true; ch.S = 1.8 * (0.7 + 0.3 * eff); entry.fresh++; entry.missed++;
          ch.feel = clamp(ch.feel + 0.25, 0, 1);
        } else {
          var R = retr(ch, t);
          var boost = (methodId === 'teach' ? 1.15 : 1.0);
          var win = ch.S * (1 + (0.9 + 1.8 * (1 - R)) * eff * boost) + 0.6 * eff; // 떠올리는 데 성공
          var lose = Math.max(1.6, ch.S * 0.9) + 0.8 * eff;                        // 못 떠올림 → 답 확인하고 다시 익힘
          ch.S = R * win + (1 - R) * lose;
          entry.missed += (1 - R);
          // 체감은 "얼마나 떠올랐는지"에 맞춰짐 → 착각이 깨지고 실제에 가까워짐
          ch.feel = clamp(ch.feel + ((0.56 + 0.4 * R) - ch.feel) * 0.7, 0, 1);
        }
        if (methodId === 'practice') ch.applied = true;
        if (methodId === 'teach') { ch.organized = true; if (c.kind !== 'calc') ch.applied = true; }
        if (methodId === 'recall' && c.kind === 'essay') ch.organized = ch.organized || ch.reps >= 1;
      }
      ch.S = Math.min(ch.S, 40);
      ch.last = t; ch.touched = g.day; ch.reps++;
      entry.gained += ch.S - before;
    });
    g.cond = clamp(g.cond - m.drain, 0, 100);
    g.log.push(entry);
    return entry;
  }

  /* 하루를 닫음. stayUp=true 면 밤샘(심야 칸을 이미 썼다는 뜻) */
  function endDay(g, stayUp) {
    var today = g.day;
    g.courses.forEach(function (c) {
      c.chunks.forEach(function (ch) {
        if (!stayUp && ch.touched === today) ch.S = Math.min(40, ch.S * 1.18); // 자는 동안 굳음
        ch.feel *= 0.97;
      });
    });
    if (stayUp) { g.allNighters++; g.cond = clamp(g.cond - 26, 0, 100); g.lastNight = 'up'; }
    else { g.cond = clamp(g.cond + 34, 0, 100); g.lastNight = 'sleep'; }
    snapshot(g);
    g.day++; g.slot = 0;
    if (g.day > DAYS) finish(g);
  }

  function snapshot(g) {
    var row = { day: g.history.length, cond: g.cond, actual: {}, felt: {} };
    var t = g.history.length; // 0 = 시작, n = n일째가 끝난 뒤
    g.courses.forEach(function (c) { row.actual[c.id] = actual(g, c.id, t); row.felt[c.id] = felt(g, c.id); });
    g.history.push(row);
  }

  function grade(p) {
    var table = [[90, 'A+'], [84, 'A'], [77, 'B+'], [70, 'B'], [62, 'C+'], [54, 'C'], [45, 'D+'], [36, 'D']];
    for (var i = 0; i < table.length; i++) if (p >= table[i][0]) return table[i][1];
    return 'F';
  }

  function finish(g) {
    g.over = true;
    // 전날 밤을 새우면 시험장에서 아는 것도 덜 나옴
    var examEff = g.lastNight === 'up' ? 0.86 : (g.cond < 45 ? 0.93 : 1);
    var res = { courses: [], examEff: examEff, allNighters: g.allNighters, total: 0 };
    g.courses.forEach(function (c) {
      var a = actual(g, c.id, EXAM_T) * examEff, f = felt(g, c.id);
      var score = Math.round(clamp(a * 100 * 1.04, 0, 100));
      var late = actual(g, c.id, EXAM_T + 14); // 종강 2주 뒤에도 남아 있는 정도
      res.courses.push({ id: c.id, score: score, grade: grade(score), felt: Math.round(f * 100), gap: Math.round(f * 100) - score, after2w: Math.round(late * 100) });
      res.total += score;
    });
    res.avg = Math.round(res.total / g.courses.length);
    res.usage = usage(g);
    res.type = classify(g, res);
    g.result = res;
    return res;
  }

  function usage(g) {
    var u = { total: 0, retrieval: 0, passive: 0, rest: 0, byMethod: {}, firstHalf: 0, lastThree: 0, byCourse: {} };
    g.log.forEach(function (e) {
      u.byMethod[e.method] = (u.byMethod[e.method] || 0) + 1;
      if (e.method === 'rest') { u.rest++; return; }
      u.total++;
      u.byCourse[e.course] = (u.byCourse[e.course] || 0) + 1;
      if (METHODS[e.method].retrieval) u.retrieval++; else u.passive++;
      if (e.day <= 7) u.firstHalf++;
      if (e.day >= 12) u.lastThree++;
    });
    return u;
  }

  /* 플레이 성향 진단 */
  function classify(g, res) {
    var u = res.usage, n = Math.max(1, u.total);
    var gap = res.courses.reduce(function (s, c) { return s + c.gap; }, 0) / res.courses.length;
    if (g.allNighters >= 3) return 'allnighter';
    if (u.lastThree / n > 0.42 && u.firstHalf / n < 0.3) return 'crammer';
    if (u.retrieval / n >= 0.5 && res.avg >= 80) return 'architect';
    if (u.passive / n >= 0.7 && gap >= 12) return 'highlighter';
    var counts = g.courses.map(function (c) { return u.byCourse[c.id] || 0; });
    if (Math.max.apply(null, counts) - Math.min.apply(null, counts) >= n * 0.45) return 'onesided';
    if (u.retrieval / n >= 0.35) return 'explorer';
    return 'steady';
  }

  return { DAYS: DAYS, CHUNKS: CHUNKS, SLOTS: SLOTS, COURSES: COURSES, METHODS: METHODS, EXAM_T: EXAM_T,
    newGame: newGame, study: study, endDay: endDay, actual: actual, felt: felt, now: now, grade: grade, courseOf: courseOf, retr: retr };
});
