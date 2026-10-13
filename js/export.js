/*
 * AI 챗봇(Gemini 젬, ChatGPT GPT 등)에 붙여넣을 분석 자료 텍스트 생성 (브라우저/Node 공용)
 * 앱은 API를 호출하지 않으며, 사용자가 자신의 AI 계정에 직접 붙여넣는다.
 * 앱에는 처음부터 가명만 저장하므로 내보내는 자료에도 실명이 없다.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const A = isNode ? require('./analysis.js') : root.Analysis;
  const P = isNode ? require('./plan.js') : root.Plan;
  const mod = factory(A, P);
  if (isNode) module.exports = mod;
  else root.Export = mod;
})(typeof self !== 'undefined' ? self : this, function (A, P) {
  'use strict';

  const MEASURE_LABELS = { frequency: '빈도', duration: '지속시간', intensity: '강도(1~5점)', abc: 'ABC 기록' };

  function r1(x, d = 1) { const v = A.round(x, d); return v == null ? '-' : String(v); }
  function md(key) { return `${Number(key.slice(5, 7))}/${Number(key.slice(8))}`; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function timeOf(ts) { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /**
   * 앱에는 가명만 입력하도록 안내하므로 별도 익명화는 하지 않는다.
   * @param ctx { student, behavior, analysis, maxAbc, draftText }
   */
  function build(ctx) {
    const { student = {}, behavior = {}, analysis: an } = ctx;
    const anon = s => String(s == null ? '' : s);
    const name = student.name || '학생';
    const s = an.summary;
    const fn = an.fn;
    const L = [];

    L.push('[행동중재계획 작성 요청 자료]');
    L.push('※ 행동중재 도우미 앱에서 내보낸 관찰 자료입니다. 아래 자료를 근거로 행동중재계획서(BIP)를 작성해 주세요.');
    L.push('');
    L.push('## 1. 학생 정보');
    L.push(`- 학생(가명): ${name}${student.grade ? ` (${student.grade})` : ''}`);
    if (student.info) L.push(`- 참고 특성: ${anon(student.info)}`);
    L.push('');
    L.push('## 2. 표적행동');
    L.push(`- 행동명: ${anon(behavior.name)}`);
    L.push(`- 조작적 정의: ${anon(behavior.definition) || '(미입력)'}`);
    if (behavior.examples) L.push(`- 포함되는 예: ${anon(behavior.examples)}`);
    if (behavior.nonExamples) L.push(`- 포함되지 않는 예: ${anon(behavior.nonExamples)}`);
    L.push(`- 측정 방법: ${(behavior.measures || []).map(m => MEASURE_LABELS[m] || m).join(', ')}`);
    if (behavior.intensityScale && (behavior.measures || []).includes('intensity')) {
      L.push(`- 강도 기준: ${behavior.intensityScale.map((t, i) => `${i + 1}점=${t.split(':')[0]}`).join(', ')}`);
    }
    L.push(`- 중재 시작일: ${behavior.interventionDate || '없음(기초선 단계)'}`);
    if (behavior.goal) L.push(`- 교사가 정한 목표: ${anon(behavior.goal)}`);
    L.push('');
    L.push(`## 3. 자료 요약 (분석 기간 ${an.from} ~ ${an.to})`);
    L.push(`- 관찰일 ${s.obsDays}일 중 발생일 ${s.daysWithBehavior}일, 총 ${s.totalCount}회`);
    L.push(`- 일평균 빈도 ${r1(s.meanPerDay)}회 (최대 ${s.maxPerDay}회/일), 추세: ${an.trend.label}`);
    if (s.avgDurationSec != null) L.push(`- 1회 평균 지속시간 ${P.fmtDur(s.avgDurationSec)} (최장 ${P.fmtDur(s.maxDurationSec)})`);
    if (s.avgIntensity != null) L.push(`- 평균 강도 ${r1(s.avgIntensity)}점 / 최고 ${s.maxIntensity}점`);
    if (an.peakHours.length) L.push(`- 가장 많이 발생한 시간대: ${an.peakHours.map(h => `${h}시대`).join(', ')}`);
    const wdTop = an.weekdays.map((c, i) => ({ c, i })).filter(x => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 2);
    if (wdTop.length) L.push(`- 많이 발생한 요일: ${wdTop.map(x => `${A.WEEKDAYS[x.i]}(${x.c}회)`).join(', ')}`);
    const ph = an.phase;
    if (ph && ph.baseDays && ph.interDays) {
      L.push(`- 기초선(${ph.baseDays}일) 일평균 ${r1(ph.baseMean)}회 → 중재(${ph.interDays}일) 일평균 ${r1(ph.interMean)}회`
        + `${ph.changePct != null ? ` (${r1(ph.changePct)}%)` : ''}, PND ${r1(ph.pnd, 0)}%`);
    }
    L.push('');
    L.push('## 4. 일별 기록 (관찰일만, 날짜: 횟수 / 평균 지속시간 / 평균 강도)');
    const obs = an.daily.filter(d => d.observed);
    const chunk = [];
    for (const d of obs) {
      let t = `${md(d.date)}(${A.WEEKDAYS[d.weekday]}) ${d.count}회`;
      if (d.avgDuration != null) t += ` / ${P.fmtDur(d.avgDuration)}`;
      if (d.avgIntensity != null) t += ` / 강도 ${r1(d.avgIntensity)}`;
      if (ph && d.date === ph.interventionDate) t = '▶중재 시작 ' + t;
      chunk.push(t);
    }
    for (let i = 0; i < chunk.length; i += 5) L.push('- ' + chunk.slice(i, i + 5).join(' · '));
    L.push('');
    L.push(`## 5. 앱의 규칙 기반 기능 추정 (참고용, ABC ${fn.abcCount}건 기준)`);
    if (fn.primary) {
      L.push(`- 비율: ${Object.keys(A.FUNCTIONS).map(k => `${A.FUNCTIONS[k]} ${r1(fn.percents[k], 0)}%`).join(', ')}`);
      L.push(`- 추정: ${A.FUNCTIONS[fn.primary]}${fn.secondary ? ` (+ ${A.FUNCTIONS[fn.secondary]})` : ''}, 신뢰도 ${fn.confidence}`);
      if (an.antecedents.length) L.push(`- 주요 선행사건: ${an.antecedents.slice(0, 4).map(x => `${x.label} ${x.count}회`).join(', ')}`);
      if (an.consequences.length) L.push(`- 주요 후속결과: ${an.consequences.slice(0, 4).map(x => `${x.label} ${x.count}회`).join(', ')}`);
      if (an.activities.length) L.push(`- 주요 활동: ${an.activities.map(x => `${anon(x.label)} ${x.count}회`).join(', ')}`);
      if (an.settings.length) L.push(`- 주요 장소: ${an.settings.map(x => `${anon(x.label)} ${x.count}회`).join(', ')}`);
    } else {
      L.push('- ABC 기록이 없어 추정하지 못했습니다.');
    }
    L.push('');
    const maxAbc = ctx.maxAbc || 40;
    const abcRecs = an.records.filter(r => r.abc).slice(-maxAbc);
    L.push(`## 6. ABC 기록 원자료 (최근 ${abcRecs.length}건${fn.abcCount > abcRecs.length ? ` / 전체 ${fn.abcCount}건` : ''})`);
    if (!abcRecs.length) L.push('- 없음');
    for (const r of abcRecs) {
      const x = r.abc;
      const k = A.dayKey(r.ts);
      const parts = [`${md(k)}(${A.WEEKDAYS[new Date(r.ts).getDay()]}) ${timeOf(r.ts)}`];
      const where = [x.setting, x.activity].filter(Boolean).map(anon).join('/');
      if (where) parts.push(where);
      const ante = [...(x.antecedents || []).map(c => A.ANTE_LABELS[c]), anon(x.antecedentText)].filter(Boolean).join(', ');
      const cons = [...(x.consequences || []).map(c => A.CONS_LABELS[c]), anon(x.consequenceText)].filter(Boolean).join(', ');
      parts.push(`A: ${ante || '-'}`);
      parts.push(`B: ${anon(x.behaviorText) || anon(behavior.name)}`);
      parts.push(`C: ${cons || '-'}`);
      if (r.durationSec) parts.push(`지속 ${P.fmtDur(r.durationSec)}`);
      if (r.intensity) parts.push(`강도 ${r.intensity}`);
      if (x.functionGuess) parts.push(`관찰자 추정: ${A.FUNCTIONS[x.functionGuess]}`);
      if (x.notes) parts.push(`메모: ${anon(x.notes)}`);
      L.push('- ' + parts.join(' | '));
    }
    if (ctx.draftText && ctx.draftText.trim()) {
      L.push('');
      L.push('## 7. 교사가 검토 중인 계획서 초안 (이 초안을 보완·개선해 주세요)');
      L.push(anon(ctx.draftText.trim().replace(/\n{3,}/g, '\n\n')));
    }
    L.push('');
    L.push('## 요청');
    L.push('위 자료를 근거로 긍정적 행동지원(PBS)에 기반한 행동중재계획서를 작성해 주세요.');
    L.push('1) 자료가 부족하거나 꼭 필요한 정보(학생의 의사소통 수준, 선호물, 강점 등)가 있으면 먼저 3개 이내로 질문해 주세요.');
    L.push('2) 특히 ABC 원자료의 서술 내용을 근거로 행동 기능 가설을 세우고, 근거가 된 기록을 인용해 주세요.');
    L.push('3) 계획서는 기본 정보, 표적행동, 현행 수준, 기능평가 결과와 가설, 목표(단기·장기), 예방 전략, 대체행동 교수, 후속결과 전략, 위기행동 관리, 자료 수집·평가 계획 순서로 작성해 주세요.');
    L.push('4) 체벌·혐오 자극·불필요한 신체 제지는 권하지 말고, 의학적 진단이나 약물 권고는 하지 마세요.');
    L.push(`5) 학생은 가명 '${name}'(으)로 표기하고, 실명 등 개인정보는 묻지 마세요.`);
    return L.join('\n');
  }

  return { build };
});
