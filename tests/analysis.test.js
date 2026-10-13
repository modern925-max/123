const test = require('node:test');
const assert = require('node:assert');
const A = require('../js/analysis.js');
const Plan = require('../js/plan.js');

const ts = (day, time = '10:00') => new Date(`${day}T${time}`).toISOString();

test('buildDaily: 주말은 기록이 있을 때만 관찰일로 본다', () => {
  // 2026-10-05(월) ~ 2026-10-11(일)
  const recs = [{ ts: ts('2026-10-05') }, { ts: ts('2026-10-05') }, { ts: ts('2026-10-10'), durationSec: 60, intensity: 4 }];
  const daily = A.buildDaily(recs, '2026-10-05', '2026-10-11');
  assert.strictEqual(daily.length, 7);
  assert.strictEqual(daily[0].count, 2);
  assert.strictEqual(daily.filter(d => d.observed).length, 6); // 평일 5 + 기록 있는 토요일
  assert.strictEqual(daily[5].maxIntensity, 4);
  const s = A.summarize(daily, recs);
  assert.strictEqual(s.totalCount, 3);
  assert.strictEqual(s.meanPerDay, 0.5);
  assert.strictEqual(s.avgDurationSec, 60);
});

test('trend: 감소 추세를 판별한다', () => {
  const recs = [];
  const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'];
  days.forEach((d, i) => { for (let j = 0; j < 7 - i; j++) recs.push({ ts: ts(d) }); });
  const an = A.analyze({}, recs, { from: days[0], to: days[days.length - 1] });
  assert.strictEqual(an.trend.direction, 'down');
});

test('phaseComparison: 기초선 대비 변화율과 PND', () => {
  const recs = [];
  ['2026-10-05', '2026-10-06', '2026-10-07'].forEach(d => { for (let j = 0; j < 4; j++) recs.push({ ts: ts(d) }); });
  ['2026-10-08', '2026-10-09'].forEach(d => recs.push({ ts: ts(d) }));
  const an = A.analyze({ interventionDate: '2026-10-08' }, recs, { from: '2026-10-05', to: '2026-10-09' });
  assert.strictEqual(an.phase.baseMean, 4);
  assert.strictEqual(an.phase.interMean, 1);
  assert.strictEqual(an.phase.changePct, -75);
  assert.strictEqual(an.phase.pnd, 100);
});

test('functionAnalysis: ABC 기록으로 회피 기능을 추정한다', () => {
  const abc = (a, c, g = '') => ({ ts: ts('2026-10-05'), abc: { antecedents: a, consequences: c, functionGuess: g } });
  const recs = [
    abc(['demand'], ['task_removed']),
    abc(['hard_task'], ['task_removed'], 'escape'),
    abc(['hard_task'], ['adult_attention']),
    abc(['demand'], ['task_reduced']),
    abc(['transition'], ['sent_out']),
  ];
  const fn = A.functionAnalysis(recs);
  assert.strictEqual(fn.abcCount, 5);
  assert.strictEqual(fn.primary, 'escape');
  assert.ok(fn.percents.escape > 60);
  assert.strictEqual(fn.confidence, '보통');
});

test('functionAnalysis: ABC 기록이 없으면 판단 불가', () => {
  const fn = A.functionAnalysis([{ ts: ts('2026-10-05') }]);
  assert.strictEqual(fn.primary, null);
  assert.strictEqual(fn.confidence, '판단 불가');
});

test('josa: 받침에 따라 조사를 고른다', () => {
  assert.strictEqual(Plan.josa('민수', '은/는'), '민수는');
  assert.strictEqual(Plan.josa('김예진', '은/는'), '김예진은');
  assert.strictEqual(Plan.josa('자리 이탈', '을/를'), '자리 이탈을');
  assert.strictEqual(Plan.josa('소리 지르기', '을/를'), '소리 지르기를');
  assert.strictEqual(Plan.josa('회피·도피', '으로/로'), '회피·도피로');
  assert.strictEqual(Plan.josa('관심 획득', '으로/로'), '관심 획득으로');
});

test('Plan.generate: 계획서에 주요 섹션과 기능 기반 전략이 포함된다', () => {
  const recs = [];
  for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
    recs.push({ ts: ts(d, '09:20'), durationSec: 120, intensity: 4, abc: { antecedents: ['demand'], consequences: ['task_removed'], activity: '수학', setting: '교실' } });
    recs.push({ ts: ts(d, '09:40') });
  }
  const behavior = { name: '소리 지르기', definition: '큰 소리로 소리 지르기', measures: ['frequency', 'duration', 'intensity', 'abc'] };
  const an = A.analyze(behavior, recs, { from: '2026-10-05', to: '2026-10-09' });
  const html = Plan.generate({ student: { name: '민수', grade: '3-2' }, behavior, analysis: an, author: '홍길동' });
  for (const h of ['1. 기본 정보', '2. 표적행동', '3. 현행 수준', '4. 기능평가 결과', '5. 중재 목표', '6. 중재 전략', '7. 자료 수집 및 평가 계획']) {
    assert.ok(html.includes(h), h);
  }
  assert.ok(html.includes('회피·도피</b>로 추정된다'));
  assert.ok(html.includes('휴식 요청하기'));
  assert.ok(html.includes('위기 관리 계획이 필요합니다'));
  assert.ok(html.includes('민수는'));
  assert.ok(html.includes('일평균 2회'));
});

test('Plan.generate: 사용자 입력은 HTML 이스케이프된다', () => {
  const an = A.analyze({}, [], { from: '2026-10-05', to: '2026-10-09' });
  const html = Plan.generate({ student: { name: '<script>x</script>' }, behavior: { name: 'b' }, analysis: an });
  assert.ok(!html.includes('<script>'));
});
