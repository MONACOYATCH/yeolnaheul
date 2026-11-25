/* 열나흘 — 진짜 기말 계획표 만들기 (화면과 분리, node 에서도 돌아감)
 * 입력: 오늘 날짜, 과목[{name, date(YYYY-MM-DD), kind}]
 * 원칙: ① 먼저 범위를 한 번 훑는다 ② 시험 7·4·2일 전에 덮고 꺼내 본다 ③ 전날은 가볍게 꺼내 보고 일찍 잔다
 *       ④ 하루에 3개까지만. 넘치면 앞날로 당긴다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Plan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DAY = 86400000, PER_DAY = 3;
  var KIND = {
    memo: { label: '암기형', pull: '백지 복습: 덮고 빈 종이에 써 보기', last: '틀렸던 것만 다시 꺼내 보기' },
    calc: { label: '문제풀이형', pull: '기출·연습문제를 시간 재고 풀기', last: '틀렸던 유형만 한 문제씩 다시 풀기' },
    essay: { label: '서술형', pull: '예상 문제 하나 골라 개요 쓰고 소리 내어 설명하기', last: '핵심 개념 사이의 연결을 한 장에 그려 보기' }
  };
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function diff(a, b) { return Math.round((parse(iso(a)) - parse(iso(b))) / DAY); }
  function add(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; }

  function build(todayStr, subjects) {
    var today = parse(todayStr), days = {}, order = [], warnings = [];
    function slot(d) { var k = iso(d); if (!days[k]) { days[k] = { date: k, tasks: [], exams: [] }; } return days[k]; }
    function put(offsetFromToday, task) {
      // 그날이 꽉 찼으면 앞날로, 앞이 없으면 뒷날로
      var o = offsetFromToday, limit = task.max;
      while (o > 0 && slot(add(today, o)).tasks.length >= PER_DAY) o--;
      if (slot(add(today, o)).tasks.length >= PER_DAY) { o = offsetFromToday; while (o < limit && slot(add(today, o)).tasks.length >= PER_DAY) o++; }
      slot(add(today, o)).tasks.push(task);
    }
    var list = subjects.filter(function (s) { return s && s.name && s.date; }).map(function (s) { return { name: String(s.name).trim().slice(0, 30), date: s.date, kind: KIND[s.kind] ? s.kind : 'memo', left: diff(parse(s.date), today) }; });
    list.sort(function (a, b) { return a.left - b.left; });
    list.forEach(function (s) {
      var k = KIND[s.kind], L = s.left;
      if (L < 0) { warnings.push(s.name + ': 시험일이 이미 지났습니다.'); return; }
      slot(parse(s.date)).exams.push(s.name);
      if (L === 0) { warnings.push(s.name + ': 오늘이 시험입니다. 새로 외우기보다 아는 것을 한 번 꺼내 보고 들어가세요.'); return; }
      var max = L - 1;
      if (L >= 3) put(0, { subj: s.name, kind: s.kind, type: 'scan', text: '범위 확인하고 한 번 훑기 (시험 형식·범위·기출 유무부터)', max: max });
      else put(0, { subj: s.name, kind: s.kind, type: 'pull', text: k.pull + ' (시간이 없으니 읽기는 건너뛰고 바로)', max: max });
      [7, 4, 2].forEach(function (b) { if (L - b >= 1) put(L - b, { subj: s.name, kind: s.kind, type: 'pull', text: k.pull, max: max }); });
      if (L >= 10) put(Math.min(max, 2), { subj: s.name, kind: s.kind, type: 'pull', text: '훑은 범위를 덮고 목차만 보고 떠올려 보기', max: max });
      if (L >= 2) put(L - 1, { subj: s.name, kind: s.kind, type: 'last', text: k.last + ' → 평소 시간에 자기', max: max });
      if (L < 7) warnings.push(s.name + ': 시험까지 ' + L + '일. 간격을 충분히 두긴 어렵지만, 읽기보다 꺼내 보기를 먼저 하세요.');
    });
    order = Object.keys(days).sort().map(function (k) { var d = days[k]; d.left = diff(parse(k), today); return d; }).filter(function (d) { return d.tasks.length || d.exams.length; });
    return { days: order, warnings: warnings, subjects: list };
  }

  function toText(plan) {
    var w = ['일', '월', '화', '수', '목', '금', '토'], out = ['[열나흘] 내 기말 계획표', ''];
    plan.days.forEach(function (d) {
      var dt = parse(d.date);
      out.push((dt.getMonth() + 1) + '/' + dt.getDate() + '(' + w[dt.getDay()] + ')' + (d.exams.length ? '  ★ 시험: ' + d.exams.join(', ') : ''));
      d.tasks.forEach(function (t) { out.push('  □ ' + t.subj + ' — ' + t.text); });
    });
    return out.join('\n');
  }

  function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  /* 캘린더 앱에 넣을 수 있는 .ics (종일 일정) */
  function toICS(plan) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yeolnaheul//KO', 'CALSCALE:GREGORIAN'], n = 0;
    function ev(date, title) {
      var d = date.replace(/-/g, ''), e = iso(add(parse(date), 1)).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:yn-' + d + '-' + (n++) + '@yeolnaheul', 'DTSTAMP:' + d + 'T000000Z', 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + e, 'SUMMARY:' + esc(title), 'END:VEVENT');
    }
    plan.days.forEach(function (d) {
      d.exams.forEach(function (x) { ev(d.date, '★ 시험: ' + x); });
      d.tasks.forEach(function (t) { ev(d.date, t.subj + ' — ' + t.text); });
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  }

  return { build: build, toText: toText, toICS: toICS, KIND: KIND, iso: iso, parse: parse };
});
