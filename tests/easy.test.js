const test = require('node:test');
const assert = require('node:assert');
const E = require('../easy-read/js/easy.js');
const Pictos = require('../easy-read/js/pictos.js');

test('toHaeyo: 동사 줄기를 해요체로', () => {
  const cases = { 가져오: '가져와요', 입: '입어요', 찾: '찾아요', 하: '해요', 마시: '마셔요', 모이: '모여요', 되: '돼요', 주: '줘요', 쓰: '써요', 모으: '모아요', 부르: '불러요', 가: '가요', 내: '내요' };
  for (const [stem, want] of Object.entries(cases)) assert.strictEqual(E.toHaeyo(stem), want, stem);
});

test('josa: 받침에 맞는 조사', () => {
  assert.strictEqual(E.josa('도시락', '을/를'), '도시락을');
  assert.strictEqual(E.josa('모자', '을/를'), '모자를');
  assert.strictEqual(E.josa('15,000원', '이/가'), '15,000원이');
  assert.strictEqual(E.josa('오전 9시', '이에요/예요'), '오전 9시예요');
  assert.strictEqual(E.josa('전세버스', '으로/로'), '전세버스로');
  assert.strictEqual(E.josa('지하철', '으로/로'), '지하철로');
  assert.strictEqual(E.josa('기차역', '으로/로'), '기차역으로');
});

test('easySentence: 어려운 말과 높임 끝말을 쉬운 말로', () => {
  const cases = {
    '도시락을 지참하시기 바랍니다.': '도시락을 가져와요.',
    '모자를 착용할 것': '모자를 써요.',
    '운동화를 착용합니다.': '운동화를 신어요.',
    '학생들은 강당에 집결합니다.': '학생들은 강당에 모여요.',
    '동의서를 제출해 주십시오.': '동의서를 내 주세요.',
    '휴대폰 사용을 금지합니다.': '휴대폰 사용 안 돼요.',
    '위험한 물건은 가져오지 마십시오.': '위험한 물건은 가져오지 마세요.',
    '우천 시에도 정상 진행합니다.': '비가 와도 그대로 해요.',
    '체험학습을 실시할 예정입니다.': '체험학습을 할 거예요.',
    '버스에 탑승하겠습니다.': '버스에 탈 거예요.',
    '노래를 부릅니다.': '노래를 불러요.',
    '점심은 급식을 먹습니다.': '점심은 급식을 먹어요.',
  };
  for (const [src, want] of Object.entries(cases)) assert.strictEqual(E.easySentence(src), want, src);
});

test('findDates / findTimes', () => {
  const d = E.findDates('일시: 2026. 10. 30.(금) 09:00 ~ 15:00, 문의 010-1234-5678');
  assert.strictEqual(d.length, 1);
  assert.deepStrictEqual([d[0].m, d[0].d, d[0].wd], [10, 30, '금']);
  assert.strictEqual(E.findDates('10월 12일', 2026)[0].wd, '월'); // 요일 계산
  const t = E.findTimes('09:00 ~ 15:00');
  assert.deepStrictEqual(t.map(E.fmtTime), ['오전 9시', '오후 3시']);
  assert.deepStrictEqual(E.findTimes('2시 30분에 하교, 5시간 활동').map(E.fmtTime), ['오후 2시 30분']);
});

test('Pictos.find: 긴 낱말 우선, 한 글자 낱말은 앞뒤 확인', () => {
  assert.deepStrictEqual(Pictos.find('체육복과 물병, 물건').map(h => h.word), ['체육복', '물병']);
  assert.strictEqual(Pictos.pickLast('우리 학교 운동장', '?'), '🏟️');
});

const NOTICE = `2026학년도 2학기 현장체험학습 안내
학부모님 안녕하십니까? 가정에 건강과 행복이 가득하시길 기원합니다.
1. 일시: 2026. 10. 30.(금) 09:00 ~ 15:00
2. 장소: 국립중앙박물관
3. 준비물: 도시락, 물, 돗자리
4. 복장: 체육복, 운동화
5. 비용: 15,000원
6. 유의사항
 - 휴대폰 사용을 금지합니다.
 - 참가 동의서를 10월 23일(금)까지 담임선생님께 제출해 주십시오.
OO초등학교장`;

test('buildCards: 안내문에서 핵심 카드를 만든다', () => {
  const r = E.buildCards(NOTICE, { year: 2026 });
  assert.strictEqual(r.title, '현장체험학습');
  const by = k => r.cards.filter(c => c.kind === k);
  assert.strictEqual(by('when')[0].keyword, '10월 30일 금요일');
  assert.strictEqual(by('when')[0].visual.type, 'calendar');
  assert.strictEqual(by('time')[0].keyword, '오전 9시 ~ 오후 3시');
  assert.strictEqual(by('place')[0].keyword, '국립중앙박물관');
  assert.deepStrictEqual(by('item').map(c => c.keyword), ['도시락', '물', '돗자리']);
  assert.deepStrictEqual(by('wear').map(c => c.sentence), ['체육복을 입어요.', '운동화를 신어요.']);
  assert.strictEqual(by('cost')[0].keyword, '15,000원');
  assert.strictEqual(by('deadline')[0].sentence, '동의서를 10월 23일 금요일까지 내요.');
  assert.strictEqual(by('ban')[0].ban, true);
  // 인사말·학교장·소제목은 카드도, 그 밖의 내용도 아님
  const all = JSON.stringify(r);
  assert.ok(!/안녕하십니까|학교장|유의사항/.test(all));
});

test('cleanOcr: 글자 사이 띄어쓰기를 붙인다', () => {
  assert.strictEqual(E.cleanOcr('현 장 체 험 학 습 안 내\n준 비 물 : 도 시 락 , 물'), '현장체험학습안내\n준비물 : 도시락 , 물');
});

test('aiPrompt는 전화번호를 가리고, parseAi는 앞뒤 설명이 있어도 읽는다', () => {
  assert.ok(E.aiPrompt('문의 010-1234-5678').includes('[전화번호]'));
  const r = E.parseAi('네, 만들었어요!\n```json\n{"title":"운동회","cards":[{"label":"언제?","emoji":"📅","keyword":"10월 12일","sentence":"10월 12일에 해요."},{"label":"하면 안 돼요","keyword":"휴대폰","sentence":"휴대폰은 안 돼요."}]}\n```');
  assert.strictEqual(r.title, '운동회');
  assert.strictEqual(r.cards.length, 2);
  assert.strictEqual(r.cards[1].ban, true);
  assert.throws(() => E.parseAi('카드가 없어요'));
});
