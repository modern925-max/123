/*
 * 쉬운 안내문 만들기 — 핵심 모듈 (브라우저/Node 공용)
 * - 안내문 글에서 행사 이름·날짜·시간·장소·준비물·복장·비용·할 일을 찾기
 * - 어려운 낱말과 높임 끝말을 쉬운 말('~해요')로 바꾸기
 * - 그림 + 핵심 낱말 + 짧은 문장으로 된 카드 만들기
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const mod = factory(isNode ? require('./pictos.js') : root.Pictos);
  if (isNode) module.exports = mod;
  else root.Easy = mod;
})(typeof self !== 'undefined' ? self : this, function (Pictos) {
  'use strict';

  // ======================== 한글 도우미 ========================
  const BASE = 0xAC00;
  const J = { A: 0, EO: 4, YEO: 6, O: 8, WA: 9, WAE: 10, OE: 11, U: 13, WO: 14, WI: 16, EU: 18, UI: 19, I: 20 };
  const JONG = { NONE: 0, N: 4, L: 8, M: 16, B: 17 };

  function syl(ch) {
    const c = ch ? ch.charCodeAt(0) - BASE : -1;
    return c >= 0 && c < 11172 ? { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 } : null;
  }
  const compose = (cho, jung, jong) => String.fromCharCode(BASE + cho * 588 + jung * 28 + jong);

  /** 낱말 끝에 받침이 있는지 (숫자·영문은 읽는 소리로) */
  function hasBatchim(word) {
    const w = String(word).replace(/[\s)\]」』'".,!?~]+$/, '');
    const ch = w.slice(-1);
    const s = syl(ch);
    if (s) return s.jong !== 0;
    if (/[0-9]/.test(ch)) return '013678'.includes(ch);
    if (/[a-zA-Z]/.test(ch)) return /[lmnr]/i.test(ch);
    return false;
  }
  /** 조사 붙이기: josa('도시락', '을/를') → '도시락을' */
  function josa(word, pair) {
    const [a, b] = pair.split('/');
    if (pair === '으로/로') {
      const s = syl(String(word).slice(-1));
      return word + (s && s.jong && s.jong !== JONG.L ? a : b);
    }
    return word + (hasBatchim(word) ? a : b);
  }
  /** 받침 붙이기: addJong('가져오', ㄹ, '을') → '가져올', addJong('입', ㄹ, '을') → '입을' */
  function addJong(stem, jong, alt) {
    const s = syl(stem.slice(-1));
    if (s && !s.jong) return stem.slice(0, -1) + compose(s.cho, s.jung, jong);
    return stem + alt;
  }
  const yang = s => s && (s.jung === J.A || s.jung === J.O);

  /** 동사 줄기를 '~해요' 꼴로: 가져오→가져와요, 입→입어요, 하→해요, 모르→몰라요 */
  function toHaeyo(stem) {
    if (!stem) return stem;
    const head = stem.slice(0, -1);
    const last = stem.slice(-1);
    const s = syl(last);
    if (!s) return stem + '요';
    if (last === '하') return head + '해요';
    if (s.jong) return stem + (yang(s) ? '아요' : '어요');
    switch (s.jung) {
      case J.O: return head + compose(s.cho, J.WA, 0) + '요';
      case J.U: return head + compose(s.cho, J.WO, 0) + '요';
      case J.OE: return head + compose(s.cho, J.WAE, 0) + '요';
      case J.I: return head + compose(s.cho, J.YEO, 0) + '요';
      case J.EU: {
        const p = syl(head.slice(-1));
        if (last === '르' && p && !p.jong) return head.slice(0, -1) + compose(p.cho, p.jung, JONG.L) + (yang(p) ? '라요' : '러요');
        return head + compose(s.cho, yang(p) ? J.A : J.EO, 0) + '요';
      }
      case J.WI: case J.UI: return stem + '어요';
      default: return stem + '요';
    }
  }

  // ======================== 쉬운 말로 바꾸기 ========================
  // 'OO하다' 꼴의 어려운 말 → 쉬운 동사 줄기
  const VERBS = {
    지참: '가져오', 소지: '가져오', 귀가: '집에 가', 하교: '집에 가', 등교: '학교에 오', 집결: '모이',
    제출: '내', 유의: '조심하', 엄수: '꼭 지키', 실시: '하', 시행: '하', 진행: '하', 인솔: '데리고 가',
    문의: '물어보', 참석: '참여하', 탑승: '타', 승차: '타', 하차: '내리', 섭취: '먹', 지도: '가르치',
    협조: '도와주', 복용: '먹', 숙지: '잘 알아 두', 휴대: '가져오', 이동: '가', 출발: '출발하', 도착: '도착하',
  };
  // 낱말 그대로 바꾸기 (앞에서부터 차례로)
  const WORDS = [
    [/학부모님께서는|보호자께서는/g, '부모님은'], [/학부모님께서|보호자께서/g, '부모님이'],
    [/학부모님|학부모|보호자님?/g, '부모님'], [/자녀분?들?/g, '학생'],
    [/우천\s*시에?는?/g, '비가 오면'], [/우천/g, '비'],
    [/중식/g, '점심'], [/석식/g, '저녁'], [/조식/g, '아침'], [/본교/g, '우리 학교'],
    [/다음과 같이|아래와 같이/g, '이렇게'], [/반드시|필히/g, '꼭'],
    [/재량\s*휴업일?|휴업일/g, '학교 쉬는 날'], [/연락처/g, '전화번호'],
    [/익일/g, '다음 날'], [/금일/g, '오늘'], [/명일/g, '내일'], [/당일/g, '그날'],
    [/도보로?/g, '걸어서'], [/에 의거하여|에 따라서/g, '에 따라'],
    [/불가능합니다|불가합니다/g, '할 수 없어요'], [/가능합니다/g, '할 수 있어요'],
    [/하오니|하므로/g, '하니까'], [/되오니|되므로/g, '되니까'], [/있사오니|있으므로/g, '있으니까'],
    [/하였/g, '했'], [/되었/g, '됐'], [/하여/g, '해'],
  ];
  const WEAR_HEAD = /모자|마스크|헬멧|안경|선글라스|수모/;
  const WEAR_FOOT = /운동화|신발|실내화|장화|슬리퍼|구두/;
  const VERB_RE = new RegExp(`(${Object.keys(VERBS).join('|')}|착용)(하여|합니다|하|할|해|함|한|합|했)`, 'g');
  const NOUNS = { 지참: '가져오기', 소지: '가져오기', 귀가: '집에 가기', 하교: '집에 가기', 등교: '학교 오기', 집결: '모이기', 제출: '내기', 유의: '조심', 엄수: '꼭 지키기', 인솔: '함께 가기', 문의: '물어보기', 착용: '입기', 협조: '도움' };
  const NOUN_RE = new RegExp(`(${Object.keys(NOUNS).join('|')})`, 'g');

  function verbStem(noun, sentence) {
    if (noun !== '착용') return VERBS[noun];
    if (WEAR_HEAD.test(sentence)) return '쓰';
    if (WEAR_FOOT.test(sentence)) return '신';
    return '입';
  }
  function conjugate(stem, tail) {
    switch (tail) {
      case '합니다': return toHaeyo(stem);
      case '하': return stem;
      case '할': return addJong(stem, JONG.L, '을');
      case '함': return addJong(stem, JONG.M, '음');
      case '한': return addJong(stem, JONG.N, '은');
      case '합': return addJong(stem, JONG.B, '습');
      case '했': { // 가져와 → 가져왔
        const h = toHaeyo(stem).slice(0, -1);
        const s = syl(h.slice(-1));
        return s && !s.jong ? h.slice(0, -1) + compose(s.cho, s.jung, 20) : h + '었';
      }
      default: return toHaeyo(stem).slice(0, -1); // 해, 하여
    }
  }

  // 동사 바꾸기보다 먼저 바꿀 말
  const FIRST = [
    [/유의\s*사항/g, '조심할 점'], [/준수\s*사항/g, '지킬 점'], [/소지품/g, '가져갈 물건'],
    [/하교\s*시간/g, '집에 가는 시간'], [/등교\s*시간/g, '학교에 오는 시간'],
    [/우천\s*시에도/g, '비가 와도'], [/정상(?:적으로)?\s*(?=진행|운영|실시)/g, '그대로 '],
  ];

  function easyWords(s) {
    let out = s;
    for (const [re, to] of FIRST) out = out.replace(re, to);
    out = out.replace(/협조\s*(?:를\s*)?(?:부탁드립니다|바랍니다|부탁합니다)/g, '도와주세요');
    out = out.replace(VERB_RE, (m, noun, tail) => conjugate(verbStem(noun, s), tail));
    out = out.replace(NOUN_RE, (m, noun) => NOUNS[noun]);
    for (const [re, to] of WORDS) out = out.replace(re, to);
    return out;
  }

  // 앞에서부터 처음 맞는 규칙 하나만 씁니다.
  const ENDINGS = [
    [/\s*(?:을|를|은|는)?\s*금지(?:합니다|입니다|됩니다|함|한다|하니까.*)?$/, () => ' 안 돼요'],
    [/지\s*마(?:십시오|십시요|시기\s*바랍니다|시길\s*바랍니다|세요|시고)$/, () => '지 마세요'],
    [/지\s*않도록\s*(?:해|지도해)?\s*주(?:시기|시길)\s*바랍니다$/, () => '지 않게 해 주세요'],
    [/\s*주(?:시기|시길)\s*(?:부탁)?\s*바랍니다$|\s*주(?:십시오|십시요)$|\s*주시면\s*(?:대단히\s*)?감사하겠습니다$/, () => ' 주세요'],
    [/\s*(?:부탁드립니다|부탁합니다)$/, () => ' 부탁해요'],
    [/(?:안내|알려)\s*(?:해\s*)?드립니다$/, () => '알려요'],
    [/^(.*?)(으)?(?:시기\s*바랍니다|시길\s*바랍니다|십시오|십시요|시면\s*(?:대단히\s*)?감사하겠습니다)$/, (m, stem, eu) => {
      // '입으시기' → 입, '모으시기' → 모으
      if (eu && !hasBatchim(stem)) stem += '으';
      return toHaeyo(stem);
    }],
    [/^(.*\S)\s*바랍니다$/, (m, x) => x + ' 부탁해요'],
    [/^(.*?)겠습니다$/, (m, stem) => addJong(stem, JONG.L, '을') + ' 거예요'],
    [/^(.*?)(\S)\s+예정입니다$/, (m, head, ch) => {
      const s = syl(ch);
      return s && s.jong === JONG.L ? `${head}${ch} 거예요` : `${head}${ch} 예정이에요`;
    }],
    [/것입니다$/, () => '거예요'],
    [/^(.*?)입니다$/, (m, x) => josa(x, '이에요/예요')],
    [/합니다$/, () => '해요'],
    [/^(.*?)습니다$/, (m, stem) => toHaeyo(stem)],
    [/^(.*?)([가-힣])니다$/, (m, head, ch) => {
      const s = syl(ch);
      if (!s || s.jong !== JONG.B) return m;
      return toHaeyo(head + compose(s.cho, s.jung, 0));
    }],
    [/^(.*?)([가-힣])\s*것$/, (m, head, ch) => {
      // 개조식 '가져올 것', '입을 것' → '가져와요', '입어요'
      const s = syl(ch);
      if (ch === '을') return toHaeyo(head);
      if (s && s.jong === JONG.L) return toHaeyo(head + compose(s.cho, s.jung, 0));
      return m;
    }],
    [/^(.*?)함$/, (m, x) => x + '해요'],
  ];

  const BULLET = /^\s*(?:[○●◎◦•·\-–*□■▶▷※◆◇☞❍➀-➉①-⑳]|\d{1,2}[.)](?!\d)|[가-하][.)]|\(\d{1,2}\)|\d{1,2}\s*\))\s*/;
  const stripBullet = s => s.replace(BULLET, '').trim();

  /** 한 문장을 쉬운 말로: '도시락을 지참하시기 바랍니다.' → '도시락을 가져와요.' */
  function easySentence(sentence) {
    let s = stripBullet(String(sentence)).replace(/\s+/g, ' ').replace(/[.。!]+\s*$/, '').trim();
    if (!s) return '';
    s = easyWords(s);
    for (const [re, fn] of ENDINGS) {
      if (re.test(s)) { s = s.replace(re, fn); break; }
    }
    s = s.replace(/\s{2,}/g, ' ').trim();
    return /[?!]$/.test(s) ? s : s + '.';
  }

  // ======================== 글 나누기 ========================
  const BOILER = /안녕하(?:십니까|세요)|건강(?:과|하시고)|행복(?:이|한|하시)|평안|가정에\s*(?:늘|항상)|기원|감사(?:합니다|드립니다|하겠습니다)|학교장|교\s*장\s*$|드림\s*$|\(?직인\)?|귀댁|깃드|무궁한|아름다운\s*계절|가을이|봄이|여름이|겨울이|날씨가|성원|노고/;
  const isBoiler = s => BOILER.test(s) || /^[-=_~*\s]+$/.test(s);
  // 문서 번호, 날짜만 있는 줄, '유의사항' 같은 소제목
  const isNoise = s => /^가정\s*통신문|\d{4}\s*[-–]\s*\d+\s*호/.test(s)
    || !/[가-힣]/.test(s.replace(DATE_RE, '').replace(/[()월화수목금토일요]/g, ''))
    || /^[가-힣 ]{1,12}$/.test(stripBullet(s).replace(/[:：]$/, ''));

  function lines(text) {
    return String(text || '').replace(/\r/g, '').split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean);
  }
  function sentences(text) {
    const out = [];
    lines(text).forEach((line, li) => {
      line.split(/(?<=[가-힣)][.!?。])\s+/).forEach(s => { if (s.trim()) out.push({ text: s.trim(), line: li }); });
    });
    return out;
  }

  // ======================== 날짜·시간·돈 ========================
  const WEEK = '일월화수목금토';
  const DATE_RE = /(?<![\d\-:])(?:(\d{4})\s*(?:년|[.\-/])\s*)?(\d{1,2})\s*(?:월\s*|[./-]\s*)(\d{1,2})\s*(?:일|\.)?(?!\d)\s*(?:\(\s*([월화수목금토일])(?:요일)?\s*\)|([월화수목금토일])요일)?/g;

  function findDates(text, refYear) {
    const out = [];
    for (const m of String(text).matchAll(DATE_RE)) {
      const y = m[1] ? +m[1] : refYear;
      const mo = +m[2], d = +m[3];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      if (!m[1] && /^\d{1,2}\s*[.]\s*\d{1,2}$/.test(m[0].trim()) && !m[4]) continue; // '9.30' 같은 숫자는 날짜로 보지 않음
      let wd = m[4] || m[5];
      if (!wd && y) wd = WEEK[new Date(y, mo - 1, d).getDay()];
      out.push({ y, m: mo, d, wd: wd || '', index: m.index, end: m.index + m[0].length });
    }
    return out;
  }
  const fmtDate = x => `${x.m}월 ${x.d}일${x.wd ? ` ${x.wd}요일` : ''}`;

  const TIME_RE = /(오전|오후|아침|낮|저녁|밤|새벽)?\s*(?<![\d.:])(\d{1,2})\s*(?::\s*(\d{2})(?!\d)|시(?!간|각)\s*(?:(\d{1,2})\s*분|(반))?)/g;
  function findTimes(text) {
    const out = [];
    for (const m of String(text).matchAll(TIME_RE)) {
      let h = +m[2];
      const min = m[3] ? +m[3] : m[4] ? +m[4] : m[5] ? 30 : 0;
      if (h > 24 || min > 59) continue;
      const pre = m[1];
      if (pre && /오후|저녁|밤/.test(pre) && h < 12) h += 12;
      else if (!pre && h >= 1 && h <= 6) h += 12; // 학교 일과: 1~6시는 오후
      out.push({ h, min, index: m.index, end: m.index + m[0].length });
    }
    return out;
  }
  function fmtTime(t) {
    const h12 = t.h % 12 || 12;
    const ap = t.h === 12 ? '낮' : t.h < 12 || t.h === 24 ? '오전' : '오후';
    return `${ap} ${h12}시${t.min ? ` ${t.min}분` : ''}`;
  }
  const isRange = (text, a, b) => /^[\s)]*[~∼〜\-–부터]+/.test(String(text).slice(a.end, b.index)) || /부터/.test(String(text).slice(a.end, b.index));

  function findCost(text) {
    const m = String(text).match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/);
    if (m) return { amount: m[1] + '원' };
    if (/무료|무상|비용\s*없음/.test(text)) return { free: true };
    return null;
  }

  // ======================== 안내문 읽기 ========================
  const LABELS = [
    ['title', /^(?:행사\s*명|제\s*목|주\s*제|행\s*사|사업\s*명)$/],
    ['when', /^(?:일\s*시|일\s*자|날\s*짜|기\s*간|일\s*정|언\s*제|운영\s*기간|행사\s*일시?)$/],
    ['time', /^(?:시\s*간|시\s*각|운영\s*시간)$/],
    ['meet', /^(?:집결\s*장소|모이는\s*곳|집\s*결)$/],
    ['place', /^(?:장\s*소|어\s*디|체험\s*장소|목\s*적\s*지|방\s*문\s*지|방문\s*장소|행사\s*장소)$/],
    ['items', /^(?:준\s*비\s*물|지\s*참\s*물|소\s*지\s*품|가져올\s*것|챙길\s*것)$/],
    ['wear', /^(?:복\s*장|옷\s*차\s*림)$/],
    ['cost', /^(?:비\s*용|참\s*가\s*비|체\s*험\s*비|경\s*비|금\s*액|납부\s*금액)$/],
    ['transport', /^(?:교\s*통\s*편|이동\s*수단|차\s*량|교\s*통)$/],
    ['lunch', /^(?:점\s*심|중\s*식|식\s*사)$/],
    ['deadline', /^(?:제출\s*기한|제출\s*일|마\s*감|신청\s*기간|신청\s*기한|회신\s*기한|제\s*출)$/],
    ['who', /^(?:대\s*상|참\s*가\s*자|인\s*원|참여\s*대상)$/],
    ['what', /^(?:내\s*용|활동\s*내용|주요\s*내용|프로그램|체험\s*내용)$/],
  ];
  const LABEL_LINE = /^\s*(?:[○●◎◦•·\-–*□■▶▷※◆◇☞❍]|\d{1,2}[.)]|[가-하][.)]|\(\d{1,2}\))?\s*([가-힣][가-힣 ]{0,8}?)\s*[:：]\s*(.+)$/;

  function labelOf(line) {
    const m = line.match(LABEL_LINE);
    if (!m) return null;
    const hit = LABELS.find(([, re]) => re.test(m[1].trim()));
    return hit ? { key: hit[0], value: m[2].trim() } : null;
  }

  function cleanTitle(t) {
    return String(t)
      .replace(/가정\s*통신문?|알림장/g, '')
      .replace(/제?\s*\d{4}\s*[-–]\s*\d+\s*호/g, '')
      .replace(/\d{4}\s*학년도|\d\s*학기/g, '')
      .replace(/[「」『』<>《》〈〉【】\[\]"'“”]/g, ' ')
      .replace(/\s*(?:에\s*(?:대한|관한)\s*)?(?:안내문?|알림문?|공지|협조\s*요청|신청\s*안내|운영\s*계획|계획|알려\s*드립니다)\s*(?:\(.*\))?\s*$/, '')
      .replace(/\s+/g, ' ').trim();
  }
  function findTitle(ls) {
    for (const l of ls) {
      const lb = labelOf(l);
      if (lb && lb.key === 'title') return cleanTitle(lb.value);
    }
    for (const l of ls.slice(0, 6)) {
      if (l.length <= 40 && /안내|알림|공지|협조|계획/.test(l) && !/[다요]\.?$/.test(l) && !labelOf(l)) {
        const t = cleanTitle(l);
        if (t) return t;
      }
    }
    const first = ls.find(l => !isBoiler(l) && !/^가정\s*통신문?$/.test(l.replace(/\s/g, '')));
    if (first && first.length <= 25 && !/[다요]\.?$/.test(first) && !labelOf(first) && !findDates(first).length) return cleanTitle(first);
    return '';
  }

  const splitList = v => String(v)
    .replace(/\([^)]*\)/g, '')
    .split(/[,，、·/]|\s및\s|\s그리고\s|\s등\s|\n/)
    .map(x => x.replace(/^\s*(?:등|기타)\s*/, '').replace(/\s*(?:등|등등)\s*$/, '').replace(/[.。]+$/, '').trim())
    .filter(x => x && x.length <= 15);

  const REQUEST = /주시기|주십시오|주세요|바랍니다|십시오|하세요|해야|합시다|해 주|꼭|반드시|필히|제출|회신|보내|신청|지참|챙겨|않도록|할 것$|조심|유의|주의|엄수|지켜/;
  const BAN = /금지|안\s*됩니다|안\s*돼요|하지\s*마|지\s*않도록|삼가|불가|없도록/;
  const DEADLINE_CTX = /까지[^.]{0,15}?(?:제출|회신|신청|납부|보내|내 주|내세요|접수)|제출\s*기한|마감|회신\s*기한/;

  /**
   * 안내문 글을 읽어 정보를 찾습니다.
   * @param {string} text
   * @param {{year?:number}} opts
   */
  function extract(text, opts = {}) {
    const refYear = opts.year || new Date().getFullYear();
    const ls = lines(text);
    const info = {
      title: findTitle(ls), dates: [], deadline: null, times: [], timeSource: '', place: '', meet: '',
      items: [], wear: [], cost: null, transport: '', lunch: '', usedLines: new Set(),
    };

    // 1) 'OO: 값' 꼴의 항목
    ls.forEach((l, i) => {
      const lb = labelOf(l);
      if (!lb) return;
      const v = lb.value;
      switch (lb.key) {
        case 'title': break;
        case 'when': {
          const ds = findDates(v, refYear);
          if (ds.length && !info.dates.length) info.dates = ds.length > 1 && isRange(v, ds[0], ds[1]) ? [ds[0], ds[1]] : [ds[0]];
          const ts = findTimes(stripDates(v));
          if (ts.length && !info.times.length) { info.times = ts.slice(0, 2); info.timeSource = 'label'; }
          break;
        }
        case 'time': {
          const ts = findTimes(v);
          if (ts.length) { info.times = ts.slice(0, 2); info.timeSource = 'label'; }
          break;
        }
        case 'meet': info.meet = cleanPlace(v); break;
        case 'place': if (!info.place) info.place = cleanPlace(v); break;
        case 'items': info.items.push(...splitList(v)); break;
        case 'wear': info.wear.push(...splitList(v)); break;
        case 'cost': info.cost = findCost(v) || { text: v }; break;
        case 'transport': info.transport = v.replace(/\([^)]*\)/g, '').trim(); break;
        case 'lunch': info.lunch = v.replace(/\([^)]*\)/g, '').trim(); break;
        case 'deadline': {
          const ds = findDates(v, refYear);
          if (ds.length) info.deadline = { date: ds[ds.length - 1], text: v };
          break;
        }
        default: return; // who, what → 나머지 문장으로
      }
      info.usedLines.add(i);
    });

    // 2) 항목이 없을 때 문장에서 찾기
    const body = ls.map((l, i) => ({ l, i })).filter(x => !info.usedLines.has(x.i) && !isBoiler(x.l) && !/^가정\s*통신문|\d{4}\s*[-–]\s*\d+\s*호/.test(x.l));
    if (!info.dates.length) {
      for (const { l } of body) {
        if (DEADLINE_CTX.test(l)) continue;
        const ds = findDates(l, refYear);
        if (ds.length) { info.dates = ds.length > 1 && isRange(l, ds[0], ds[1]) ? [ds[0], ds[1]] : [ds[0]]; break; }
      }
    }
    if (!info.deadline) {
      for (const { l } of body) {
        if (!DEADLINE_CTX.test(l)) continue;
        const ds = findDates(l, refYear);
        if (ds.length) { info.deadline = { date: ds[ds.length - 1], text: l }; break; }
      }
    }
    if (!info.items.length) {
      for (const { l, i } of body) {
        if (!/준비물|가져|지참|챙겨|소지/.test(l)) continue;
        const hits = Pictos.find(l, { cat: ['item'] }).filter(h => h.label !== '돈' && h.label !== '동의서');
        if (hits.length) { info.items.push(...hits.map(h => h.word)); info.usedLines.add(i); }
      }
    }
    if (!info.wear.length) {
      for (const { l, i } of body) {
        if (!/복장|입고|착용|신고|쓰고|입어|신어/.test(l)) continue;
        const hits = Pictos.find(l, { cat: ['wear'] }).filter(h => h.label !== '옷');
        if (hits.length) { info.wear.push(...hits.map(h => h.word)); info.usedLines.add(i); }
      }
    }
    if (!info.place) {
      const generic = ['집', '학교', '교실', '화장실', '급식실'];
      for (const { l } of body) {
        const hit = Pictos.find(l, { cat: ['place'] }).find(h => !generic.includes(h.label));
        if (hit && /에서|으로|로|에 가|방문|장소|체험|견학/.test(l)) { info.place = hit.word; break; }
      }
    }
    if (!info.cost) {
      for (const { l } of body) { const c = findCost(l); if (c) { info.cost = c; break; } }
    }

    info.items = uniq(info.items).slice(0, 10);
    info.wear = uniq(info.wear).slice(0, 6);
    return info;
  }
  const uniq = arr => [...new Set(arr.map(x => x.trim()).filter(Boolean))];
  const stripDates = v => String(v).replace(DATE_RE, ' ');
  const cleanPlace = v => String(v).replace(/\([^)]*\)/g, '').replace(/본교/g, '우리 학교').replace(/\s+/g, ' ').trim();

  // ======================== 카드 만들기 ========================
  let seq = 0;
  const newId = () => 'c' + Date.now().toString(36) + (seq++).toString(36);

  function card(o) {
    return { id: newId(), label: '', emoji: '', keyword: '', sentence: '', ban: false, visual: null, ...o };
  }

  const PARTICLE = /(?:에서는|에서|에게|으로|부터|까지|이나|이랑|하고|은|는|이|가|을|를|에|의|와|과|도|로|랑|만)$/;
  /** 쉬운 문장에서 핵심 낱말 고르기 */
  function keywordOf(sentence) {
    const hit = Pictos.find(sentence).find(h => !['날짜', '시간', '안전', '위험', '부모님', '선생님'].includes(h.label));
    if (hit) return hit.word.length > 1 ? hit.word : hit.label;
    const words = sentence.replace(/[.?!]$/, '').split(' ').map(w => w.replace(PARTICLE, '')).filter(w => w.length > 1);
    return words.slice(0, 2).join(' ').slice(0, 12);
  }

  function wearVerb(item) {
    if (WEAR_HEAD.test(item)) return '써요';
    if (WEAR_FOOT.test(item)) return '신어요';
    return '입어요';
  }

  /**
   * 안내문 글 → 카드
   * @returns {{title:string, cards:object[], rest:{text:string, easy:string}[]}}
   */
  function buildCards(text, opts = {}) {
    const info = extract(text, opts);
    const cards = [];
    const title = info.title;

    if (title) {
      cards.push(card({
        kind: 'what', label: '무엇을 해요?', emoji: Pictos.pick(title, '📢'), keyword: title,
        sentence: `${josa(title, '이/가')} 있어요.`,
      }));
    }

    if (info.dates.length) {
      const kw = info.dates.map(fmtDate).join(' ~ ');
      cards.push(card({
        kind: 'when', label: '언제?', emoji: '📅', keyword: kw,
        visual: { type: 'calendar', dates: info.dates.map(({ m, d, wd }) => ({ m, d, wd })) },
        sentence: (title ? josa(title, '은/는') + ' ' : '')
          + (info.dates.length > 1 ? `${fmtDate(info.dates[0])}부터 ${fmtDate(info.dates[1])}까지 해요.` : `${josa(kw, '이에요/예요')}.`),
      }));
    }

    const used = new Set(); // 카드로 쓴 문장
    const sents = sentences(text).filter(s => !info.usedLines.has(s.line) && !isBoiler(s.text) && !isNoise(s.text) && !labelOf(s.text)
      && !(title && cleanTitle(s.text) === title));

    if (info.times.length) {
      const t = info.times;
      cards.push(card({
        kind: 'time', label: '몇 시?', emoji: '⏰', keyword: t.map(fmtTime).join(' ~ '),
        visual: { type: 'clock', times: t.map(({ h, min }) => ({ h, min })) },
        sentence: t.length > 1 ? `${fmtTime(t[0])}에 시작해요. ${fmtTime(t[1])}에 끝나요.` : `${josa(fmtTime(t[0]), '이에요/예요')}.`,
      }));
    } else {
      // 시간이 나온 문장마다 카드 (최대 2장)
      sents.filter(s => findTimes(stripDates(s.text)).length && !DEADLINE_CTX.test(s.text)).slice(0, 2).forEach(s => {
        const ts = findTimes(stripDates(s.text)).slice(0, 2);
        cards.push(card({
          kind: 'time', label: '몇 시?', emoji: '⏰', keyword: ts.map(fmtTime).join(' ~ '),
          visual: { type: 'clock', times: ts.map(({ h, min }) => ({ h, min })) },
          sentence: easySentence(s.text),
        }));
        used.add(s);
      });
    }

    if (info.meet) {
      cards.push(card({
        kind: 'place', label: '어디에 모여요?', emoji: Pictos.pickLast(info.meet, '📍'), keyword: info.meet,
        sentence: `${info.meet}에 모여요.`,
      }));
    }
    if (info.place) {
      cards.push(card({
        kind: 'place', label: '어디서?', emoji: Pictos.pickLast(info.place, '📍', { cat: ['place', 'event'] }), keyword: info.place,
        sentence: `${info.place}에 가요.`.replace(/(학교|교실|운동장|강당|체육관)에 가요\.$/, '$1에서 해요.'),
      }));
    }
    if (info.transport) {
      cards.push(card({
        kind: 'how', label: '어떻게 가요?', emoji: Pictos.pick(info.transport, '🚌'), keyword: info.transport,
        sentence: `${josa(info.transport, '으로/로')} 가요.`,
      }));
    }

    info.items.forEach(item => cards.push(card({
      kind: 'item', label: '가져와요', emoji: Pictos.pick(item, '🎒'), keyword: item,
      sentence: `${josa(item, '을/를')} 가져와요.`,
    })));
    if (info.lunch) {
      cards.push(card({
        kind: 'item', label: '점심', emoji: Pictos.pick(info.lunch, '🍚'), keyword: info.lunch,
        sentence: /도시락/.test(info.lunch) ? '점심은 도시락을 먹어요.' : `점심은 ${josa(info.lunch, '이에요/예요')}.`,
      }));
    }
    info.wear.forEach(item => cards.push(card({
      kind: 'wear', label: '이렇게 입어요', emoji: Pictos.pick(item, '👕'), keyword: item,
      sentence: `${josa(item, '을/를')} ${wearVerb(item)}.`,
    })));

    if (info.cost) {
      const c = info.cost;
      cards.push(card({
        kind: 'cost', label: '돈', emoji: '💰',
        keyword: c.amount || (c.free ? '무료' : c.text),
        sentence: c.amount ? `${josa(c.amount, '이/가')} 필요해요.` : c.free ? '돈은 안 내요.' : easySentence(c.text),
      }));
    }

    if (info.deadline) {
      const d = info.deadline;
      const doc = (Pictos.find(d.text).find(h => h.label === '동의서') || {}).word;
      cards.push(card({
        kind: 'deadline', label: '언제까지 내요?', emoji: '📮', keyword: `${fmtDate(d.date)}까지`,
        visual: { type: 'calendar', dates: [{ m: d.date.m, d: d.date.d, wd: d.date.wd }] },
        sentence: `${doc ? josa(doc, '을/를') + ' ' : ''}${fmtDate(d.date)}까지 내요.`,
      }));
      sents.forEach(s => { if (s.text === d.text || (DEADLINE_CTX.test(s.text) && findDates(s.text).length)) used.add(s); });
    }

    // 나머지 문장: 하면 안 되는 것 / 꼭 할 일 / 그 밖의 내용
    const rest = [];
    let todo = 0;
    sents.forEach(s => {
      if (used.has(s)) return;
      const easy = easySentence(s.text);
      if (!easy || easy.length < 4) return;
      const ban = BAN.test(s.text);
      if ((ban || REQUEST.test(s.text)) && todo < 6) {
        todo++;
        const ts = findTimes(stripDates(s.text)).slice(0, 1);
        cards.push(card({
          kind: ban ? 'ban' : 'todo', label: ban ? '하면 안 돼요' : '꼭 해요', ban,
          emoji: Pictos.pick(s.text, ban ? '🚫' : '✅'), keyword: ts.length ? fmtTime(ts[0]) : keywordOf(easy), sentence: easy,
          visual: ts.length && !ban ? { type: 'clock', times: ts.map(({ h, min }) => ({ h, min })) } : null,
        }));
      } else {
        rest.push({ text: s.text, easy });
      }
    });

    return { title, cards, rest };
  }

  /** 한 줄 정보를 카드로 (그 밖의 내용 → 카드로 만들기) */
  function cardFromSentence(text) {
    const easy = easySentence(text);
    const ban = BAN.test(text);
    return card({
      kind: ban ? 'ban' : 'note', label: ban ? '하면 안 돼요' : '알아 두세요', ban,
      emoji: Pictos.pick(text, ban ? '🚫' : '💡'), keyword: keywordOf(easy), sentence: easy,
    });
  }

  // ======================== 사진 글자 정리 ========================
  /** 글자 인식(OCR) 결과의 흔한 오류 정리: '현 장 체 험' → '현장체험' */
  function cleanOcr(text) {
    return String(text || '')
      .replace(/[|¦]/g, ' ')
      .split('\n')
      .map(line => {
        const l = line.replace(/[ \t]+/g, ' ').trim();
        const toks = l.split(' ');
        const singles = toks.filter(t => /^[가-힣]$/.test(t)).length;
        if (toks.length < 3 || singles / toks.length < 0.5) return l;
        return l.replace(/(?<=(?:^|\s)[가-힣])\s+(?=[가-힣])|(?<=[가-힣])\s+(?=[가-힣](?:\s|$))/g, '');
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ======================== AI 챗봇에 맡기기 ========================
  const maskPrivate = t => String(t)
    .replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '[전화번호]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[이메일]');

  function aiPrompt(text) {
    return [
      '아래 학교 안내문을 발달장애 학생이 이해하기 쉬운 "그림 카드"로 바꿔 주세요.',
      '',
      '[규칙]',
      '- 꼭 알아야 할 것만 고르세요: 무엇을 하는지, 언제, 몇 시, 어디서, 가져올 것, 입을 옷, 돈, 낼 것과 날짜, 꼭 할 일, 하면 안 되는 일.',
      '- 인사말, 학교장 이름, 설명이 긴 문장은 빼세요.',
      '- 카드 1장에 내용은 하나만. 카드는 4~12장.',
      '- keyword: 2~8글자 핵심 낱말 (예: "도시락", "10월 25일 금요일", "오전 9시").',
      '- sentence: 10~25글자의 짧은 문장. 쉬운 낱말과 "~해요" 말투. 어려운 한자어(지참, 귀가, 착용, 우천 시 등)는 쓰지 마세요.',
      '- emoji: 내용을 잘 보여 주는 그림 문자 1개.',
      '- 하면 안 되는 일은 "ban": true 로 표시하세요.',
      '- 실제 안내문에 없는 내용은 만들지 마세요.',
      '',
      '[답 형식] 아래 JSON만 코드 블록 하나로 답하세요.',
      '{"title": "행사 이름", "cards": [{"label": "언제?", "emoji": "📅", "keyword": "10월 25일 금요일", "sentence": "10월 25일 금요일에 가요.", "ban": false}]}',
      '',
      '[안내문]',
      maskPrivate(text).trim(),
    ].join('\n');
  }

  /** 챗봇 답(JSON)을 카드로. 앞뒤 설명이나 코드 블록이 있어도 읽습니다. */
  function parseAi(answer) {
    const s = String(answer || '');
    const start = s.search(/[{[]/);
    if (start < 0) throw new Error('JSON을 찾지 못했어요.');
    const open = s[start], close = open === '{' ? '}' : ']';
    const end = s.lastIndexOf(close);
    if (end <= start) throw new Error('JSON이 끝나지 않았어요.');
    let data;
    try { data = JSON.parse(s.slice(start, end + 1)); } catch (e) {
      throw new Error('JSON 형식이 올바르지 않아요.');
    }
    const list = Array.isArray(data) ? data : data.cards;
    if (!Array.isArray(list) || !list.length) throw new Error('카드가 없어요.');
    return {
      title: (!Array.isArray(data) && data.title) || '',
      cards: list.filter(c => c && (c.keyword || c.sentence)).map(c => {
        const ban = c.ban === true || /안\s*돼|금지|하지\s*마/.test(`${c.label || ''} ${c.sentence || ''}`);
        return card({
          kind: ban ? 'ban' : 'ai', label: String(c.label || ''), ban,
          emoji: String(c.emoji || Pictos.pick(`${c.keyword} ${c.sentence}`, ban ? '🚫' : '💡')).slice(0, 8),
          keyword: String(c.keyword || ''), sentence: String(c.sentence || ''),
        });
      }),
    };
  }

  return {
    hasBatchim, josa, toHaeyo, easyWords, easySentence,
    lines, sentences, findDates, findTimes, fmtDate, fmtTime, findCost,
    labelOf, cleanTitle, findTitle, extract, buildCards, cardFromSentence, keywordOf,
    cleanOcr, maskPrivate, aiPrompt, parseAi,
  };
});
