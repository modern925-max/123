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

const Export = require('../js/export.js');

test('Export.build: 가명과 ABC 원자료, 요청 문구를 포함한다', () => {
  const recs = [
    { ts: ts('2026-10-05', '09:10'), durationSec: 90, intensity: 3, abc: { setting: '교실', activity: '수학', antecedents: ['demand'], antecedentText: '익힘책을 주자', behaviorText: '소리를 지름', consequences: ['task_removed'], consequenceText: '', functionGuess: 'escape', notes: '' } },
    { ts: ts('2026-10-06', '10:00') },
  ];
  const behavior = { name: '소리 지르기', definition: '큰 소리', measures: ['frequency', 'abc'], interventionDate: '' };
  const an = A.analyze(behavior, recs, { from: '2026-10-05', to: '2026-10-09' });
  const txt = Export.build({ student: { name: '별님', grade: '3학년', birth: '2017-01-01' }, behavior, analysis: an });
  assert.ok(txt.includes('학생(가명): 별님 (3학년)'));
  assert.ok(!txt.includes('2017-01-01'));
  assert.ok(txt.includes('A: 과제·지시 제시, 익힘책을 주자'));
  assert.ok(txt.includes('## 6. ABC 기록 원자료'));
  assert.ok(txt.includes('## 요청'));
});

test('looksLikeRealName: 실명처럼 보이는 이름을 구별한다', () => {
  global.Analysis = A; global.Plan = Plan;
  const src = require('fs').readFileSync(require('path').join(__dirname, '../js/store.js'), 'utf8');
  const U = new Function('Analysis', 'Plan', 'localStorage', src.split('const COLORS')[0] + 'return U;')(A, Plan, {});
  assert.strictEqual(U.looksLikeRealName('김민수'), true);
  assert.strictEqual(U.looksLikeRealName('학생A'), false);
  assert.strictEqual(U.looksLikeRealName('별님'), false);
  assert.strictEqual(U.looksLikeRealName('별님(예시)'), false);
});

const CsvImport = require('../js/csv-import.js');

test('CsvImport: 시간·지속시간·날짜 형식을 해석한다', () => {
  assert.strictEqual(CsvImport.parseDate('2026-04-01 (수)'), '2026-04-01');
  assert.strictEqual(CsvImport.parseDate('2026. 4. 1.'), '2026-04-01');
  assert.strictEqual(CsvImport.parseDate('2026-02-30'), null);
  assert.strictEqual(CsvImport.parseTime('9:10'), 550);
  assert.strictEqual(CsvImport.parseTime('오전 10:40'), 640);
  assert.strictEqual(CsvImport.parseTime('오후 12:45'), 765);
  assert.strictEqual(CsvImport.parseTime('오후 1:05'), 785);
  assert.strictEqual(CsvImport.parseTime('13:16'), 796);
  assert.strictEqual(CsvImport.parseTime(''), null);
  assert.strictEqual(CsvImport.parseDuration('0시 05분'), 300);
  assert.strictEqual(CsvImport.parseDuration('2시 20분'), 8400);
  assert.strictEqual(CsvImport.parseDuration('0시 00분'), 0);
  assert.strictEqual(CsvImport.parseDuration('5분 30초'), 330);
  assert.strictEqual(CsvImport.parseDuration('90', 'sec'), 90);
  assert.strictEqual(CsvImport.parseDuration(''), null);
  assert.strictEqual(CsvImport.parseFunction('회피·도피'), 'escape');
});

test('CsvImport.prepare: 기록표를 학생·행동·ABC 기록으로 바꾸고 중복은 건너뛴다', () => {
  const csv = [
    '학생,표적행동,날짜,시작시간,종료시간,지속시간,강도,장소,활동,선행사건,선행사건 상세,행동 묘사,후속결과,후속결과 상세,추정 기능,메모',
    '마이노,위기행동,2026-04-01 (수),9:10,11:30,2시 20분,4,교실,체육,과제·지시 제시,컨디션 난조,양 주먹으로 때림,과제 감소·지연·대신 해 줌,진정영역으로 분리,회피·도피,',
    '마이노,위기행동,2026-04-06 (월),오전 10:40,오전 10:45,,2,교실,일상생활,과제·지시 제시,없음,양 주먹으로 때림,자리·교실에서 분리,진정영역에서 휴식,회피·도피,',
    '마이노,위기행동,2026-08-20 (목),,,0시 00분,3,교실,수학,소음·감각 자극 과다,착석 거부,양 주먹으로 때림,자리·교실에서 분리,,회피·도피,',
    '마이노,위기행동,날짜없음,9:00,,,3,,,,,,,,,',
  ].join('\r\n');
  const res = CsvImport.prepare(csv, { students: [], behaviors: [], records: [] });
  assert.strictEqual(res.records.length, 3);
  assert.deepStrictEqual(res.students.map(s => s.name), ['마이노']);
  assert.deepStrictEqual(res.behaviors.map(b => b.name), ['위기행동']);
  assert.strictEqual(res.skipped.length, 1);
  assert.strictEqual(res.skipped[0].line, 5);
  const [r1, r2, r3] = res.records;
  assert.strictEqual(r1.durationSec, 8400);
  assert.strictEqual(r1.intensity, 4);
  assert.deepStrictEqual(r1.abc.antecedents, ['demand']);
  assert.deepStrictEqual(r1.abc.consequences, ['task_reduced']);
  assert.strictEqual(r1.abc.functionGuess, 'escape');
  assert.strictEqual(r2.durationSec, 300); // 지속시간이 비면 시작~종료로 계산
  assert.strictEqual(r2.abc.antecedentText, ''); // '없음'은 빈칸으로
  assert.strictEqual(r3.timeUnknown, true);
  assert.strictEqual(r3.durationSec, undefined);
  assert.strictEqual(res.noTime, 1);
  assert.deepStrictEqual(res.behaviorUpdates[res.behaviors[0].id], ['frequency', 'duration', 'intensity', 'abc']);

  const again = CsvImport.prepare(csv, { students: res.students, behaviors: res.behaviors, records: res.records });
  assert.strictEqual(again.records.length, 0);
  assert.strictEqual(again.duplicates, 3);
  assert.strictEqual(again.students.length, 0);
});

test('CsvImport.prepare: 날짜 열이 없으면 안내한다', () => {
  const res = CsvImport.prepare('학생,강도\nA,3', { students: [], behaviors: [], records: [] });
  assert.ok(res.error.includes('날짜'));
});
