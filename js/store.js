/*
 * 공용 도우미(U)와 데이터 저장소(Store) — 브라우저 localStorage에 저장
 */
// 흔한 성씨(상위 약 60개) + 이름 2자 → 실명처럼 보이는지 확인할 때 사용
const SURNAMES = '김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설';

const U = {
  looksLikeRealName(name) {
    const n = String(name || '').trim();
    return /^[가-힣]{3}$/.test(n) && SURNAMES.includes(n[0]);
  },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  pad(n) { return String(n).padStart(2, '0'); },
  dayKey(d) { return Analysis.dayKey(d); },
  today() { return Analysis.dayKey(new Date()); },
  addDays(k, n) { return Analysis.addDays(k, n); },
  timeStr(d) { d = new Date(d); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); },
  nowTime() { return U.timeStr(new Date()); },
  toISO(dateKey, time) { return new Date(`${dateKey}T${time || '12:00'}`).toISOString(); },
  fmtDur(sec) { return Plan.fmtDur(sec); },
  clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + ':' + U.pad(m) : U.pad(m)) + ':' + U.pad(s);
  },
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  rgba(hex, a) {
    const h = (hex || '#3b5bdb').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },
  download(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  },
};

const COLORS = ['#3b5bdb', '#e8590c', '#2b8a3e', '#c2255c', '#7048e8', '#0c8599', '#e67700', '#5c940d'];

const DEFAULT_INTENSITY = [
  '매우 약함: 짧고 작게 나타나며 활동에 거의 방해되지 않음',
  '약함: 주변 1~2명이 알아차리나 활동은 지속됨',
  '보통: 수업·활동이 잠시 중단됨',
  '강함: 활동이 중단되고 성인의 개입이 필요함',
  '매우 강함: 자신이나 타인에게 위험하거나 물건이 파손됨',
];

// 자주 쓰는 표적행동 예시 (조작적 정의 작성 도움)
const BEHAVIOR_TEMPLATES = [
  { name: '소리 지르기', definition: '수업·활동 중 주변 사람이 들을 수 있을 정도로 큰 소리로 소리를 지르거나 비명을 지르는 행동. 3초 이상 소리가 멈추면 1회가 끝난 것으로 본다.', examples: '"싫어!"라고 크게 외치기, 의미 없는 고음 비명', nonExamples: '체육·음악 시간에 허용된 큰 소리, 노래 부르기', measures: ['frequency', 'duration', 'intensity', 'abc'] },
  { name: '자리 이탈', definition: '착석해야 하는 시간에 허락 없이 엉덩이가 의자에서 완전히 떨어져 자리를 벗어나는 행동. 자리로 돌아와 앉으면 1회가 끝난 것으로 본다.', examples: '수업 중 일어나 교실을 돌아다니기, 교실 밖으로 나가기', nonExamples: '교사의 허락을 받고 이동, 활동 중 지시에 따른 이동', measures: ['frequency', 'duration', 'abc'] },
  { name: '공격 행동', definition: '손, 발, 머리 또는 물건으로 다른 사람의 신체를 때리거나 차거나 미는 행동. 각 접촉을 1회로 센다.', examples: '친구 때리기, 교사 발로 차기, 밀치기', nonExamples: '놀이 중 허용된 신체 접촉, 우연한 부딪힘', measures: ['frequency', 'intensity', 'abc'] },
  { name: '자해 행동', definition: '자신의 신체를 때리거나 물거나 긁거나 머리를 물체에 부딪치는 행동. 행동이 5초 이상 멈추면 1회가 끝난 것으로 본다.', examples: '손등 물기, 머리 박기, 얼굴 때리기', nonExamples: '가려워서 가볍게 긁기', measures: ['frequency', 'duration', 'intensity', 'abc'] },
  { name: '물건 던지기', definition: '손에 든 물건을 의도적으로 손에서 떨어뜨리거나 던져 30cm 이상 이동하게 하는 행동.', examples: '교과서·필통 던지기, 의자 넘어뜨리기', nonExamples: '활동 중 공 던지기, 실수로 떨어뜨리기', measures: ['frequency', 'intensity', 'abc'] },
  { name: '과제 거부', definition: '교사의 지시 후 10초 이내에 과제를 시작하지 않거나 "안 해" 등 말·몸짓으로 거부하는 행동.', examples: '책상에 엎드리기, 학습지 밀어내기, "안 해"라고 말하기', nonExamples: '도움을 요청하는 행동, 잠시 생각하는 행동', measures: ['frequency', 'duration', 'abc'] },
  { name: '울화(텐트럼)', definition: '울기, 소리 지르기, 바닥에 눕기, 발 구르기 중 두 가지 이상이 동시에 나타나는 행동. 1분 이상 진정 상태가 유지되면 종료로 본다.', examples: '바닥에 누워 울며 발 구르기', nonExamples: '다쳐서 우는 행동', measures: ['frequency', 'duration', 'intensity', 'abc'] },
];

const Store = (() => {
  const KEY = 'bip-app-data-v1';

  function empty() {
    return { version: 1, students: [], behaviors: [], records: [], plans: [], settings: {} };
  }
  // 개인정보 최소화: 예전 버전에서 저장된 생년월일 등은 지운다
  function stripPersonal(d) {
    for (const s of d.students || []) delete s.birth;
    return d;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return stripPersonal(Object.assign(empty(), JSON.parse(raw)));
    } catch (e) { console.error(e); }
    return empty();
  }

  let data = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { alert('저장에 실패했습니다. 브라우저 저장 공간을 확인하세요.\n' + e.message); }
  }

  function upsert(list, obj) {
    const i = list.findIndex(x => x.id === obj.id);
    if (i >= 0) list[i] = Object.assign({}, list[i], obj);
    else list.push(Object.assign({ id: U.uid(), createdAt: new Date().toISOString() }, obj));
    save();
    return i >= 0 ? list[i] : list[list.length - 1];
  }

  const api = {
    get data() { return data; },
    save,

    // ---- 설정 ----
    setting(k) { return data.settings[k]; },
    setSetting(k, v) { data.settings[k] = v; save(); },

    // ---- 학생 ----
    students() { return data.students; },
    student(id) { return data.students.find(s => s.id === id); },
    upsertStudent(s) { return upsert(data.students, s); },
    deleteStudent(id) {
      const bIds = new Set(data.behaviors.filter(b => b.studentId === id).map(b => b.id));
      data.records = data.records.filter(r => !bIds.has(r.behaviorId));
      data.plans = data.plans.filter(p => !bIds.has(p.behaviorId));
      data.behaviors = data.behaviors.filter(b => b.studentId !== id);
      data.students = data.students.filter(s => s.id !== id);
      save();
    },
    currentStudent() {
      let s = api.student(data.settings.studentId);
      if (!s && data.students.length) { s = data.students[0]; data.settings.studentId = s.id; }
      return s || null;
    },

    // ---- 표적행동 ----
    behaviors(studentId) { return data.behaviors.filter(b => b.studentId === studentId); },
    behavior(id) { return data.behaviors.find(b => b.id === id); },
    upsertBehavior(b) { return upsert(data.behaviors, b); },
    deleteBehavior(id) {
      data.records = data.records.filter(r => r.behaviorId !== id);
      data.plans = data.plans.filter(p => p.behaviorId !== id);
      data.behaviors = data.behaviors.filter(b => b.id !== id);
      save();
    },
    currentBehavior() {
      const s = api.currentStudent();
      if (!s) return null;
      const list = api.behaviors(s.id);
      let b = list.find(x => x.id === data.settings.behaviorId);
      if (!b && list.length) { b = list[0]; data.settings.behaviorId = b.id; }
      return b || null;
    },

    // ---- 기록 ----
    records(behaviorId) { return data.records.filter(r => r.behaviorId === behaviorId); },
    record(id) { return data.records.find(r => r.id === id); },
    addRecord(r) {
      const rec = Object.assign({ id: U.uid(), ts: new Date().toISOString() }, r);
      data.records.push(rec);
      save();
      return rec;
    },
    updateRecord(id, patch) {
      const r = api.record(id);
      if (r) { Object.assign(r, patch); save(); }
      return r;
    },
    deleteRecord(id) { data.records = data.records.filter(r => r.id !== id); save(); },

    // ---- 계획서 ----
    plans(behaviorId) { return data.plans.filter(p => p.behaviorId === behaviorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    plan(id) { return data.plans.find(p => p.id === id); },
    addPlan(p) { return upsert(data.plans, p); },
    deletePlan(id) { data.plans = data.plans.filter(p => p.id !== id); save(); },

    // ---- CSV 불러오기 (CsvImport.prepare 결과 저장) ----
    applyImport(res) {
      for (const s of res.students) data.students.push(s);
      for (const b of res.behaviors) {
        const { colorIndex, ...rest } = b;
        data.behaviors.push(Object.assign(rest, { color: COLORS[colorIndex % COLORS.length], intensityScale: DEFAULT_INTENSITY.slice() }));
      }
      for (const [id, measures] of Object.entries(res.behaviorUpdates)) {
        const b = data.behaviors.find(x => x.id === id);
        if (b) b.measures = measures;
      }
      for (const r of res.records) data.records.push(r);
      const first = res.records[0] && data.behaviors.find(b => b.id === res.records[0].behaviorId);
      if (first) { data.settings.studentId = first.studentId; data.settings.behaviorId = first.id; }
      save();
    },

    // ---- 백업 ----
    exportJSON() { return JSON.stringify(data, null, 2); },
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || !Array.isArray(d.students) || !Array.isArray(d.behaviors) || !Array.isArray(d.records)) {
        throw new Error('올바른 백업 파일이 아닙니다.');
      }
      data = stripPersonal(Object.assign(empty(), d));
      save();
    },
    reset() { data = empty(); save(); },

    loadSample() { sample(); },
  };

  // ---- 예시 데이터 (기초선 3주 + 중재 3주) ----
  function sample() {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const poisson = lam => { let L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };

    const student = api.upsertStudent({ name: '별님(예시)', grade: '3학년', info: '구어 사용 가능(2~3어절), 시각 자료 이해가 좋음', notes: '예시 데이터입니다.' });
    const today = U.today();
    const start = U.addDays(today, -41);
    const ivDate = U.addDays(today, -20);

    const defs = [
      {
        tpl: BEHAVIOR_TEMPLATES[0], color: COLORS[0], base: 4.5, inter: [3, 1],
        abc: { ante: ['demand', 'hard_task', 'hard_task', 'transition', 'noise'], cons: ['task_removed', 'task_reduced', 'adult_attention', 'sent_out'], guess: ['escape', 'escape', ''], acts: ['수학', '국어', '수학', '받아쓰기'] },
      },
      {
        tpl: BEHAVIOR_TEMPLATES[1], color: COLORS[1], base: 3, inter: [2.4, 1.6],
        abc: { ante: ['low_attention', 'attention_other', 'attention_other', 'unstructured'], cons: ['adult_attention', 'peer_attention', 'adult_attention'], guess: ['attention', ''], acts: ['미술', '자유시간', '국어', '모둠활동'] },
      },
    ];
    for (const d of defs) {
      const b = api.upsertBehavior(Object.assign({}, d.tpl, { studentId: student.id, color: d.color, interventionDate: ivDate, intensityScale: DEFAULT_INTENSITY.slice() }));
      for (let i = 0; i < 42; i++) {
        const day = U.addDays(start, i);
        const wd = Analysis.parseDay(day).getDay();
        if (wd === 0 || wd === 6) continue;
        const inIv = day >= ivDate;
        const progress = inIv ? (i - 21) / 20 : 0;
        const lam = inIv ? d.inter[0] + (d.inter[1] - d.inter[0]) * progress : d.base;
        const n = poisson(lam);
        for (let j = 0; j < n; j++) {
          const hour = pick([9, 9, 10, 10, 10, 11, 11, 13, 14]);
          const ts = new Date(`${day}T${U.pad(hour)}:${U.pad(Math.floor(rnd() * 60))}`);
          if (ts > new Date()) continue;
          const rec = { behaviorId: b.id, ts: ts.toISOString(), source: 'frequency' };
          if (b.measures.includes('duration')) rec.durationSec = Math.round((inIv ? 40 : 90) + rnd() * (inIv ? 60 : 150));
          if (b.measures.includes('intensity')) rec.intensity = Math.min(5, Math.max(1, Math.round((inIv ? 2 : 3) + (rnd() - 0.5) * 2.4)));
          if (rnd() < 0.45) {
            rec.source = 'abc';
            rec.abc = {
              setting: pick(['교실', '교실', '교실', '특별실']),
              activity: pick(d.abc.acts),
              antecedents: [pick(d.abc.ante)],
              antecedentText: '',
              behaviorText: '',
              consequences: [pick(d.abc.cons)],
              consequenceText: '',
              functionGuess: pick(d.abc.guess),
              notes: '',
            };
          }
          data.records.push(Object.assign({ id: U.uid() }, rec));
        }
      }
    }
    data.settings.studentId = student.id;
    save();
  }

  return api;
})();
