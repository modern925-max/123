/*
 * CSV 기록 불러오기 (브라우저/Node 공용)
 * - 엑셀·구글 시트에서 만든 행동 기록표, 앱에서 내보낸 CSV를 모두 읽는다.
 * - 열 이름으로 항목을 찾으므로 열 순서는 상관없다.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const mod = factory(isNode ? require('./analysis.js') : root.Analysis);
  if (isNode) module.exports = mod;
  else root.CsvImport = mod;
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';

  // ---------- CSV 파싱 (따옴표, 줄바꿈 포함 칸 지원) ----------
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(v => String(v).trim() !== ''));
  }

  // ---------- 열 이름 ----------
  const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const COLUMNS = {
    student: ['학생', '학생(가명)', '가명', '이름', '학생명'],
    behavior: ['표적행동', '행동', '행동명', '문제행동'],
    date: ['날짜', '일자', '발생일', '관찰일'],
    start: ['시각', '시작시간', '시작시각', '발생시각', '시간'],
    end: ['종료시간', '종료시각', '끝난시간'],
    duration: ['지속시간', '지속시간(초)', '지속시간(분)', '지속'],
    intensity: ['강도', '강도(1~5)'],
    setting: ['장소'],
    activity: ['활동', '수업', '활동·수업', '교과'],
    antecedents: ['선행사건', '선행사건(a)', 'a'],
    antecedentText: ['선행사건상세', '선행사건(상세)', '배경사건'],
    behaviorText: ['행동묘사', '행동(b)', 'b', '행동상세'],
    consequences: ['후속결과', '후속결과(c)', 'c'],
    consequenceText: ['후속결과상세', '후속결과(상세)'],
    functionGuess: ['추정기능', '기능', '행동기능'],
    notes: ['메모', '비고'],
  };

  function mapHeaders(headers) {
    const map = {};
    const used = new Set();
    headers.forEach((h, i) => {
      const n = norm(h);
      for (const [key, aliases] of Object.entries(COLUMNS)) {
        if (map[key] == null && !used.has(i) && aliases.some(a => norm(a) === n)) {
          map[key] = i;
          used.add(i);
        }
      }
    });
    if (map.duration != null) {
      const h = norm(headers[map.duration]);
      map.durationUnit = h.includes('(초)') ? 'sec' : h.includes('(분)') ? 'min' : 'auto';
    }
    return map;
  }

  // ---------- 값 해석 ----------
  // 2026-04-01 (수), 2026.4.1, 2026/04/01 → 2026-04-01
  function parseDate(s) {
    const m = String(s || '').match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 9:10, 13:16, 오전 10:40, 오후 12:45, 오후 1시 30분, 2:05 PM → 분 단위(0~1439)
  function parseTime(s) {
    s = String(s || '').trim();
    if (!s) return null;
    const pm = /오후|pm/i.test(s), am = /오전|am/i.test(s);
    let m = s.match(/(\d{1,2})\s*:\s*(\d{2})/) || s.match(/(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/);
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  // 0시 05분, 2시간 20분, 5분 30초, 90초, 1:20(시:분), 0:05:30 → 초
  function parseDuration(s, unit) {
    s = String(s || '').trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      return Math.round(unit === 'sec' ? n : n * 60); // 단위 표시가 없으면 분으로 본다
    }
    let m = s.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    m = s.match(/^(\d+):(\d{1,2})$/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60;
    const h = s.match(/(\d+(?:\.\d+)?)\s*시(?:간)?/);
    const mi = s.match(/(\d+(?:\.\d+)?)\s*분/);
    const se = s.match(/(\d+(?:\.\d+)?)\s*초/);
    if (!h && !mi && !se) return null;
    return Math.round((h ? Number(h[1]) * 3600 : 0) + (mi ? Number(mi[1]) * 60 : 0) + (se ? Number(se[1]) : 0));
  }

  const EMPTY_TEXT = new Set(['', '-', '없음', '해당없음', 'x', 'n/a']);
  const cleanText = s => (EMPTY_TEXT.has(norm(s)) ? '' : String(s || '').trim());

  function lookup(list) {
    const m = {};
    for (const x of list) { m[norm(x.label)] = x.code; m[norm(x.code)] = x.code; }
    return m;
  }
  const ANTE = lookup(A.ANTECEDENTS);
  const CONS = lookup(A.CONSEQUENCES);

  // "과제·지시 제시; 활동 전환" → codes + 목록에 없는 항목은 상세 텍스트로
  function parseCodes(s, table) {
    const codes = [], extra = [];
    for (const part of String(s || '').split(/[;|\n]/)) {
      const t = part.trim();
      if (!t || EMPTY_TEXT.has(norm(t))) continue;
      const code = table[norm(t)];
      if (code && code !== 'other') { if (!codes.includes(code)) codes.push(code); }
      else extra.push(t);
    }
    return { codes, extra };
  }

  function parseFunction(s) {
    const n = norm(s);
    if (!n || EMPTY_TEXT.has(n)) return '';
    for (const [k, v] of Object.entries(A.FUNCTIONS)) if (norm(v) === n || n === k) return k;
    if (n.includes('관심')) return 'attention';
    if (n.includes('회피') || n.includes('도피')) return 'escape';
    if (n.includes('감각') || n.includes('자동')) return 'sensory';
    if (n.includes('획득') || n.includes('물건') || n.includes('요구')) return 'tangible';
    return '';
  }

  const pad = n => String(n).padStart(2, '0');

  /**
   * CSV 텍스트를 해석해 저장할 내용을 미리 계산한다 (아직 저장하지 않음).
   * @param text  CSV 내용
   * @param data  현재 저장소 데이터 { students, behaviors, records }
   * @param opts  { defaultStudent, defaultBehavior, uid }
   */
  function prepare(text, data, opts = {}) {
    const uid = opts.uid || (() => Math.random().toString(36).slice(2, 10));
    const table = parseCSV(text);
    const result = { rows: 0, records: [], students: [], behaviors: [], behaviorUpdates: {}, skipped: [], duplicates: 0, noTime: 0, from: null, to: null, missingColumns: [] };
    if (!table.length) { result.error = '파일이 비어 있습니다.'; return result; }
    const headers = table[0];
    const col = mapHeaders(headers);
    if (col.date == null) {
      result.error = "'날짜' 열을 찾을 수 없습니다. 첫 줄에 날짜, 학생, 표적행동 등의 열 이름이 있어야 합니다.";
      return result;
    }
    if (col.student == null && !opts.defaultStudent) result.missingColumns.push('학생');
    if (col.behavior == null && !opts.defaultBehavior) result.missingColumns.push('표적행동');
    if (result.missingColumns.length) {
      result.error = `'${result.missingColumns.join("', '")}' 열이 없습니다. 열을 추가하거나, 앱에서 학생과 표적행동을 먼저 선택한 뒤 불러오세요.`;
      return result;
    }

    const students = (data.students || []).slice();
    const behaviors = (data.behaviors || []).slice();
    const existingKeys = new Set((data.records || []).map(r => recordKey(r)));
    const seenKeys = new Set();
    const get = (row, key) => (col[key] == null ? '' : String(row[col[key]] == null ? '' : row[col[key]]).trim());

    const findStudent = name => {
      let s = students.find(x => norm(x.name) === norm(name));
      if (!s) {
        s = { id: uid(), name, grade: '', info: '', notes: 'CSV 파일에서 불러옴', createdAt: new Date().toISOString() };
        students.push(s);
        result.students.push(s);
      }
      return s;
    };
    const findBehavior = (student, name) => {
      let b = behaviors.find(x => x.studentId === student.id && norm(x.name) === norm(name));
      if (!b) {
        const count = behaviors.filter(x => x.studentId === student.id).length;
        b = { id: uid(), studentId: student.id, name, definition: '', examples: '', nonExamples: '', measures: ['frequency'], interventionDate: '', goal: '', colorIndex: count, createdAt: new Date().toISOString() };
        behaviors.push(b);
        result.behaviors.push(b);
      }
      return b;
    };
    const addMeasure = (b, m) => {
      const cur = result.behaviorUpdates[b.id] || (b.measures || []).slice();
      if (!cur.includes(m)) cur.push(m);
      result.behaviorUpdates[b.id] = cur;
    };

    for (let i = 1; i < table.length; i++) {
      const row = table[i];
      const line = i + 1;
      result.rows++;
      const date = parseDate(get(row, 'date'));
      if (!date) { result.skipped.push({ line, reason: `날짜를 읽을 수 없음 ('${get(row, 'date')}')` }); continue; }
      const sName = get(row, 'student') || opts.defaultStudent;
      const bName = get(row, 'behavior') || opts.defaultBehavior;
      if (!sName) { result.skipped.push({ line, reason: '학생 이름이 비어 있음' }); continue; }
      if (!bName) { result.skipped.push({ line, reason: '표적행동이 비어 있음' }); continue; }

      const startMin = parseTime(get(row, 'start'));
      const endMin = parseTime(get(row, 'end'));
      let durationSec = parseDuration(get(row, 'duration'), col.durationUnit);
      if (!durationSec && startMin != null && endMin != null && endMin > startMin) durationSec = (endMin - startMin) * 60;

      const t = startMin == null ? 12 * 60 : startMin;
      const ts = new Date(`${date}T${pad(Math.floor(t / 60))}:${pad(t % 60)}`).toISOString();

      const student = findStudent(sName);
      const b = findBehavior(student, bName);
      const rec = { id: uid(), behaviorId: b.id, ts, source: 'import' };
      if (startMin == null) { rec.timeUnknown = true; result.noTime++; }
      if (durationSec > 0) { rec.durationSec = durationSec; addMeasure(b, 'duration'); }
      const lvl = Math.round(Number(get(row, 'intensity')));
      if (lvl >= 1 && lvl <= 5) { rec.intensity = lvl; addMeasure(b, 'intensity'); }

      const ante = parseCodes(get(row, 'antecedents'), ANTE);
      const cons = parseCodes(get(row, 'consequences'), CONS);
      const abc = {
        setting: cleanText(get(row, 'setting')),
        activity: cleanText(get(row, 'activity')),
        antecedents: ante.codes,
        antecedentText: [...ante.extra, cleanText(get(row, 'antecedentText'))].filter(Boolean).join(', '),
        behaviorText: cleanText(get(row, 'behaviorText')),
        consequences: cons.codes,
        consequenceText: [...cons.extra, cleanText(get(row, 'consequenceText'))].filter(Boolean).join(', '),
        functionGuess: parseFunction(get(row, 'functionGuess')),
        notes: cleanText(get(row, 'notes')),
      };
      if (Object.values(abc).some(v => (Array.isArray(v) ? v.length : v))) { rec.abc = abc; addMeasure(b, 'abc'); }

      const key = recordKey(rec);
      if (existingKeys.has(key) || seenKeys.has(key)) { result.duplicates++; continue; }
      seenKeys.add(key);
      result.records.push(rec);
      if (!result.from || date < result.from) result.from = date;
      if (!result.to || date > result.to) result.to = date;
    }
    return result;
  }

  // 같은 기록인지 판단하는 열쇠: 행동 + 시각 + 지속시간 + 강도 + 선행사건/후속결과
  function recordKey(r) {
    const abc = r.abc || {};
    return [r.behaviorId, r.ts, r.durationSec || '', r.intensity || '', (abc.antecedents || []).join('+'), (abc.consequences || []).join('+'), abc.behaviorText || ''].join('|');
  }

  const TEMPLATE = [
    '학생,표적행동,날짜,시작시간,종료시간,지속시간,강도,장소,활동,선행사건,선행사건 상세,행동 묘사,후속결과,후속결과 상세,추정 기능,메모',
    '학생A,소리 지르기,2026-04-01,오전 9:10,오전 9:15,0시 05분,3,교실,수학,과제·지시 제시,익힘책 3쪽을 풀자고 함,싫어! 하고 크게 소리 지름,과제 감소·지연·대신 해 줌,문제 수를 줄여 줌,회피·도피,',
  ].join('\r\n');

  return { parseCSV, mapHeaders, parseDate, parseTime, parseDuration, parseFunction, prepare, recordKey, TEMPLATE };
});
