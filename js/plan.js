/*
 * 분석 결과를 바탕으로 행동중재계획서(BIP) 초안을 HTML로 생성 (브라우저/Node 공용)
 */
(function (root, factory) {
  const mod = factory(root.Analysis || (typeof require === 'function' ? require('./analysis.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Plan = mod;
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 받침 유무에 따라 조사 선택: josa('철수', '은/는') -> '철수는'
  function josa(word, pair) {
    word = String(word || '').trim();
    const [a, b] = pair.split('/');
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    if (isNaN(code) || code < 0 || code > 11171) return word + a + '(' + b + ')';
    const jong = code % 28;
    if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? b : a);
    return word + (jong ? a : b);
  }

  // 괄호 설명을 제외한 단어 기준으로 조사만 반환: particle('감각 자극(자동 강화)', '으로/로') -> '으로'
  function particle(word, pair) {
    const base = String(word).replace(/\s*\([^)]*\)\s*$/, '');
    return josa(base, pair).slice(base.length);
  }

  function fmtNum(x, d = 1) {
    const r = A.round(x, d);
    return r == null ? '-' : String(r);
  }
  function fmtDur(sec) {
    if (sec == null) return '-';
    sec = Math.round(sec);
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? (s ? `${m}분 ${s}초` : `${m}분`) : `${s}초`;
  }
  function fmtDate(key) {
    if (!key) return '-';
    const [y, m, d] = key.split('-');
    return `${y}. ${Number(m)}. ${Number(d)}.`;
  }

  const MEASURE_LABELS = { frequency: '빈도(사건 기록법)', duration: '지속시간 기록법', intensity: '강도 평정(5점 척도)', abc: 'ABC 서술 기록' };

  // 기능별 표준 긍정적 행동지원(PBS) 전략
  const STRATEGIES = {
    attention: {
      replacement: [
        '적절하게 관심 요청하기: 손 들기, "선생님, 봐 주세요" 말하기 또는 도움 요청 카드 내밀기',
        '또래에게 적절하게 말 걸기·함께 놀자고 요청하기',
      ],
      prevention: [
        '비수반 관심 제공: 문제행동과 관계없이 일정 간격(예: 5~10분)마다 짧은 칭찬·눈맞춤·대화 제공',
        '교사와 가까운 자리 배치, 수업 중 심부름·도우미 등 긍정적 관심을 받을 수 있는 역할 부여',
        '교사가 다른 학생을 도와야 할 때 미리 예고하고 기다리는 동안 할 과제 제공',
      ],
      consequence: [
        '대체행동(적절한 관심 요청) 시 즉시·충분히 관심과 칭찬 제공(차별강화, DRA)',
        '문제행동 발생 시 안전에 문제가 없다면 관심을 최소화(계획된 무시)하고, 대체행동을 촉구한 뒤 대체행동에 관심 제공',
        '문제행동 없이 일정 시간 지나면 칭찬·스티커 제공(DRO)',
      ],
    },
    escape: {
      replacement: [
        '휴식 요청하기: "쉬고 싶어요" 말하기 또는 휴식 카드 사용 (짧은 휴식 후 과제 복귀)',
        '도움 요청하기: "도와주세요" 말하기 또는 도움 카드 사용',
      ],
      prevention: [
        '과제 난이도·양 조정, 과제를 작은 단계로 나누어 제시',
        '과제 순서·자료 선택 기회 제공',
        '쉬운 요구를 연속 제시한 뒤 어려운 요구 제시(행동 타성, 고확률 요구 연속)',
        '시각적 일정표와 "먼저-다음(first-then)" 보드로 과제 시작과 끝을 예측 가능하게 제공',
        '소음 등 감각 자극이 원인일 경우 조용한 자리, 귀마개 등 환경 조정',
      ],
      consequence: [
        '휴식·도움 요청 시 즉시 짧은 휴식 또는 도움 제공(점차 요청 전 과제 수행량을 늘려 감)',
        '문제행동으로 과제가 완전히 제거되지 않도록 함(도피 소거) — 과제를 줄여서라도 끝까지 수행 후 마무리',
        '과제 완수 시 토큰·선호 활동 등으로 강화',
      ],
    },
    tangible: {
      replacement: [
        '원하는 물건·활동을 적절하게 요구하기: 말, 그림 카드(PECS), 의사소통 기기 사용',
        '기다리기 기술: "잠깐만 기다려" 신호에 타이머를 보며 기다리기',
      ],
      prevention: [
        '선호 활동·물건을 언제 이용할 수 있는지 시각적 일정표로 안내',
        '전환 전 미리 예고(5분 전, 1분 전)하고 타이머 사용',
        '"먼저-다음(first-then)" 보드 활용, 선택판으로 대안 제시',
        '선호물을 정기적으로 이용할 수 있는 시간을 일과에 계획',
      ],
      consequence: [
        '적절한 요구 시 가능한 한 즉시 요구 들어주기, 불가능할 경우 언제 가능한지 시각적으로 안내',
        '문제행동으로는 원하는 물건·활동을 얻지 못하도록 일관되게 대응(소거)',
        '기다리기에 성공하면 칭찬과 함께 원하는 것 제공',
      ],
    },
    sensory: {
      replacement: [
        '같은 감각을 충족하는 적절한 대체 활동 사용(예: 씹기 도구, 피젯 도구, 감각 놀이)',
        '감각 휴식·감각 도구를 적절하게 요청하기',
      ],
      prevention: [
        '비구조화 시간을 줄이고 흥미로운 활동으로 환경 풍부화',
        '일과 중 정기적인 감각 활동 시간(감각 식단) 제공 — 필요 시 작업치료사와 협의',
        '행동이 주로 발생하는 상황·시간대에 대체 감각 자극 미리 제공',
      ],
      consequence: [
        '문제행동 발생 시 기능적으로 동등한 대체 활동으로 재지시',
        '문제행동 없이 일정 시간 지나면 선호 감각 활동으로 강화(DRO)',
        '가능한 경우 행동이 만들어내는 감각 자극을 줄이는 방법 고려(감각 소거)',
      ],
    },
  };

  const GENERAL = {
    prevention: '대체행동과 학급 규칙을 시각 자료로 안내하고, 바람직한 행동에 대한 칭찬 비율을 높인다(긍정 4 : 교정 1 이상).',
    unknown: [
      '현재 ABC 기록이 부족하여 기능을 추정하기 어렵습니다. 2주 이상 ABC 기록을 추가로 수집한 뒤 다시 분석하세요.',
      '필요 시 기능평가 면담(교사·보호자), 동기평가척도(MAS), QABF 등 간접 평가를 함께 실시하세요.',
    ],
  };

  // 평균 변화율과 PND를 함께 고려한 중재 효과 판단
  function effectText(changePct, pnd) {
    if ((changePct != null && changePct <= -50) || pnd >= 70) return '중재가 효과적인 것으로 판단된다.';
    if ((changePct != null && changePct <= -20) || pnd >= 50) return '중재 효과가 부분적으로 나타나고 있으므로 현재 전략을 유지하며 경과를 지켜본다.';
    return '중재 효과가 미미하므로 기능 가설과 전략 수정을 검토한다.';
  }

  function li(items) { return items.map(t => `<li>${esc(t)}</li>`).join(''); }
  function listOrNone(items, fmt) {
    return items && items.length ? items.map(fmt).join(', ') : '기록 없음';
  }
  function hourLabel(h) { return `${h}시~${h + 1}시`; }

  /**
   * @param ctx { student, behavior, analysis, author, replacement }
   */
  function generate(ctx) {
    const { student = {}, behavior = {}, analysis: an } = ctx;
    const s = an.summary;
    const fn = an.fn;
    const name = student.name || '학생';
    const bName = behavior.name || '표적행동';
    const today = A.dayKey(new Date());
    const review = A.addDays(today, 28);
    const measures = (behavior.measures && behavior.measures.length ? behavior.measures : ['frequency']);

    const primary = fn.primary;
    const secondary = fn.secondary;
    const strat = primary ? STRATEGIES[primary] : null;
    const strat2 = secondary ? STRATEGIES[secondary] : null;
    const replacement = (ctx.replacement && ctx.replacement.trim())
      || (strat ? strat.replacement[0] : '기능 평가 후 결정');

    // --- 가설 문장 ---
    let hypothesis;
    if (primary) {
      const ante = an.antecedents[0] ? an.antecedents[0].label : '특정';
      const cons = an.consequences[0] ? an.consequences[0].label : '특정 결과';
      const where = an.activities[0] ? ` 주로 '${an.activities[0].label}' 시간에` : '';
      hypothesis = `${esc(josa(name, '은/는'))}${esc(where)} '${esc(ante)}' 상황에서 ${esc(josa(bName, '을/를'))} 보이며, `
        + `그 결과 '${esc(cons)}'의 후속결과가 뒤따른다. 따라서 이 행동의 주된 기능은 <b>${esc(A.FUNCTIONS[primary])}</b>${particle(A.FUNCTIONS[primary], '으로/로')} 추정된다.`;
      if (secondary) hypothesis += ` 또한 <b>${esc(A.FUNCTIONS[secondary])}</b> 기능도 함께 작용할 가능성이 있다.`;
    } else {
      hypothesis = 'ABC 기록이 없거나 부족하여 기능에 대한 가설을 세우기 어렵다. 추가 자료 수집이 필요하다.';
    }

    // --- 목표 ---
    const goals = [];
    const m = s.meanPerDay;
    if (s.totalCount > 0) {
      goals.push(`[단기] 4주 이내에 ${bName} 발생 빈도가 일평균 ${fmtNum(m)}회에서 ${fmtNum(m * 0.5)}회 이하로 감소한다(현재 대비 50% 감소).`);
      goals.push(`[장기] 학기 말까지 ${bName} 발생 빈도가 일평균 ${fmtNum(Math.max(m * 0.2, 0))}회 이하로 감소한다(현재 대비 80% 이상 감소).`);
    } else {
      goals.push(`[단기] ${bName}의 기초선 자료를 2주 이상 수집하여 목표 수준을 설정한다.`);
    }
    if (s.avgDurationSec != null) {
      goals.push(`[지속시간] 1회 평균 지속시간이 ${fmtDur(s.avgDurationSec)}에서 ${fmtDur(s.avgDurationSec * 0.5)} 이하로 줄어든다.`);
    }
    if (s.avgIntensity != null && s.avgIntensity > 2) {
      goals.push(`[강도] 평균 강도가 ${fmtNum(s.avgIntensity)}점에서 2점 이하로 낮아지고, 4점 이상의 행동이 발생하지 않는다.`);
    }
    goals.push(`[대체행동] ${josa(name, '이/가')} 대체행동(${replacement.split(':')[0]})을 촉구 없이 하루 ${Math.max(3, Math.ceil(m || 0))}회 이상 사용한다.`);

    const crisisNeeded = (s.maxIntensity || 0) >= 4;

    const phase = an.phase;
    let phaseHtml = '';
    if (phase && phase.baseDays && phase.interDays) {
      const ch = phase.changePct;
      phaseHtml = `
        <h3>기초선 · 중재 단계 비교 (중재 시작일 ${fmtDate(phase.interventionDate)})</h3>
        <table>
          <tr><th></th><th>기초선</th><th>중재</th></tr>
          <tr><th>관찰일 수</th><td>${phase.baseDays}일</td><td>${phase.interDays}일</td></tr>
          <tr><th>일평균 빈도</th><td>${fmtNum(phase.baseMean)}회</td><td>${fmtNum(phase.interMean)}회</td></tr>
          <tr><th>평균 지속시간</th><td>${fmtDur(phase.baseAvgDuration)}</td><td>${fmtDur(phase.interAvgDuration)}</td></tr>
          <tr><th>평균 강도</th><td>${fmtNum(phase.baseAvgIntensity)}</td><td>${fmtNum(phase.interAvgIntensity)}</td></tr>
        </table>
        <p>중재 단계의 일평균 빈도는 기초선 대비 <b>${ch == null ? '-' : (ch <= 0 ? fmtNum(-ch) + '% 감소' : fmtNum(ch) + '% 증가')}</b>하였으며,
        비중복 자료 비율(PND)은 ${fmtNum(phase.pnd, 0)}%이다.
        ${effectText(ch, phase.pnd)}</p>`;
    } else if (phase && phase.interventionDate) {
      phaseHtml = `<p class="muted">중재 시작일(${fmtDate(phase.interventionDate)}) 전후 자료가 모두 있어야 단계 비교가 가능합니다.</p>`;
    }

    const fnRows = Object.keys(A.FUNCTIONS).map(k =>
      `<tr><th>${esc(A.FUNCTIONS[k])}</th><td>${fmtNum(fn.percents[k], 0)}%</td><td><div class="bar"><span style="width:${Math.round(fn.percents[k])}%"></span></div></td></tr>`
    ).join('');

    const prevention = strat ? strat.prevention.slice() : [];
    const consequence = strat ? strat.consequence.slice() : [];
    const replacementList = [replacement];
    if (strat) strat.replacement.forEach(r => { if (r !== replacement) replacementList.push(r); });
    if (strat2) {
      prevention.push(...strat2.prevention.slice(0, 2).map(t => `(${A.FUNCTIONS[secondary]}) ${t}`));
      replacementList.push(`(${A.FUNCTIONS[secondary]}) ${strat2.replacement[0]}`);
      consequence.push(`(${A.FUNCTIONS[secondary]}) ${strat2.consequence[0]}`);
    }
    prevention.push(GENERAL.prevention);

    // 시간·장소 기반 맞춤 예방 전략
    if (an.peakHours.length) {
      prevention.push(`행동이 가장 많이 발생하는 ${an.peakHours.map(hourLabel).join(', ')}에는 성인의 근접 지원과 사전 예고를 강화한다.`);
    }
    if (an.antecedents[0]) {
      prevention.push(`주요 선행사건인 '${an.antecedents[0].label}' 상황을 미리 파악하여 위의 예방 전략을 우선 적용한다.`);
    }

    const html = `
<div class="plan">
  <h1>행동중재계획서 (BIP)</h1>
  <p class="plan-note">※ 본 계획서는 기록된 자료를 바탕으로 자동 생성된 <b>초안</b>입니다. 학생지원팀(담임·특수교사·보호자·관련 전문가) 협의를 거쳐 수정·확정하세요.</p>

  <h2>1. 기본 정보</h2>
  <table>
    <tr><th>학생명</th><td>${esc(name)}</td><th>학년/반</th><td>${esc(student.grade || '')}</td></tr>
    <tr><th>생년월일</th><td>${esc(student.birth || '')}</td><th>작성일</th><td>${fmtDate(today)}</td></tr>
    <tr><th>작성자</th><td>${esc(ctx.author || '')}</td><th>분석 기간</th><td>${fmtDate(an.from)} ~ ${fmtDate(an.to)}</td></tr>
    <tr><th>특성·진단</th><td colspan="3">${esc(student.info || '')}</td></tr>
  </table>

  <h2>2. 표적행동</h2>
  <table>
    <tr><th>행동명</th><td>${esc(bName)}</td></tr>
    <tr><th>조작적 정의</th><td>${esc(behavior.definition || '')}</td></tr>
    <tr><th>포함되는 예</th><td>${esc(behavior.examples || '')}</td></tr>
    <tr><th>포함되지 않는 예</th><td>${esc(behavior.nonExamples || '')}</td></tr>
    <tr><th>측정 방법</th><td>${measures.map(k => esc(MEASURE_LABELS[k] || k)).join(', ')}</td></tr>
  </table>

  <h2>3. 현행 수준 (자료 요약)</h2>
  <table>
    <tr><th>관찰일 수</th><td>${s.obsDays}일 (행동 발생일 ${s.daysWithBehavior}일)</td></tr>
    <tr><th>총 발생 횟수</th><td>${s.totalCount}회</td></tr>
    <tr><th>일평균 빈도</th><td>${fmtNum(s.meanPerDay)}회 (최대 ${s.maxPerDay}회/일)</td></tr>
    <tr><th>평균 지속시간</th><td>${fmtDur(s.avgDurationSec)}${s.maxDurationSec != null ? ` (최장 ${fmtDur(s.maxDurationSec)})` : ''}</td></tr>
    <tr><th>평균 강도</th><td>${s.avgIntensity == null ? '-' : fmtNum(s.avgIntensity) + '점 / 5점'}${s.maxIntensity ? ` (최고 ${s.maxIntensity}점)` : ''}</td></tr>
    <tr><th>추세</th><td>${esc(an.trend.label)}</td></tr>
    <tr><th>주 발생 시간대</th><td>${an.peakHours.length ? an.peakHours.map(hourLabel).join(', ') : '-'}</td></tr>
  </table>
  ${phaseHtml}

  <h2>4. 기능평가 결과</h2>
  <table>
    <tr><th>ABC 기록 수</th><td>${fn.abcCount}건</td></tr>
    <tr><th>주요 선행사건(A)</th><td>${esc(listOrNone(an.antecedents.slice(0, 3), x => `${x.label} (${fmtNum(x.pct, 0)}%)`))}</td></tr>
    <tr><th>주요 후속결과(C)</th><td>${esc(listOrNone(an.consequences.slice(0, 3), x => `${x.label} (${fmtNum(x.pct, 0)}%)`))}</td></tr>
    <tr><th>주요 장소</th><td>${esc(listOrNone(an.settings, x => `${x.label} (${x.count}회)`))}</td></tr>
    <tr><th>주요 활동</th><td>${esc(listOrNone(an.activities, x => `${x.label} (${x.count}회)`))}</td></tr>
  </table>
  <h3>행동 기능 추정 비율</h3>
  <table class="fn-table">${fnRows}</table>
  <p><b>가설:</b> ${hypothesis}</p>
  <p class="muted">추정 신뢰도: ${esc(fn.confidence)}${fn.mixed ? ' (상위 기능 간 차이가 작아 복합 기능 가능성 있음)' : ''}. 자동 추정은 참고용이며, 면담·직접 관찰을 통해 확인해야 합니다.</p>

  <h2>5. 중재 목표</h2>
  <ul>${li(goals)}</ul>

  <h2>6. 중재 전략</h2>
  <h3>6-1. 배경·선행사건 중재 (예방)</h3>
  <ul>${prevention.length > 1 ? li(prevention) : li(GENERAL.unknown.concat(prevention))}</ul>
  <h3>6-2. 대체행동 교수</h3>
  <ul>${li(replacementList)}</ul>
  <p>대체행동은 문제행동과 <b>같은 기능</b>을 하면서 더 쉽고 빠르게 결과를 얻을 수 있어야 한다. 시범-연습-피드백으로 가르치고, 처음에는 대체행동이 나올 때마다 즉시 강화한다.</p>
  <h3>6-3. 후속결과 중재</h3>
  <ul>${consequence.length ? li(consequence) : li(['바람직한 행동에 즉각적이고 구체적인 칭찬 제공', '문제행동에 대한 반응은 일관되고 짧게 유지'])}</ul>
  <h3>6-4. 위기행동 관리 계획</h3>
  ${crisisNeeded ? `<p><b>최고 강도 ${s.maxIntensity}점의 행동이 기록되어 위기 관리 계획이 필요합니다.</b></p>` : ''}
  <ul>${li([
      '자신이나 타인에게 위험한 상황에서는 주변 학생을 안전한 곳으로 이동시키고 위험 물건을 치운다.',
      '차분하고 짧은 말로 안내하며, 불필요한 언어적 요구와 신체 접촉을 줄인다.',
      '사전에 정한 진정 공간·지원 인력 호출 절차를 따르고, 신체적 개입은 최후의 수단으로 학교 지침에 따라 실시한다.',
      '위기 상황 종료 후 보호자에게 알리고, 사건 기록(ABC 포함)을 남겨 팀 협의에 활용한다.',
    ])}</ul>

  <h2>7. 자료 수집 및 평가 계획</h2>
  <ul>${li([
      `측정: ${measures.map(k => MEASURE_LABELS[k] || k).join(', ')}로 매일 기록한다.`,
      '중재 기간 동안 주 1~2회 이상 ABC 기록을 유지하여 기능 가설을 계속 확인한다.',
      `평가: ${fmtDate(review)}에 그래프를 검토하여 목표 도달 여부를 판단한다.`,
      '2주 이상 개선이 없거나 행동이 증가하면 팀 협의를 통해 가설과 전략을 수정한다.',
      '목표 달성 시 강화 계획을 점진적으로 줄이고(용암), 다른 장면으로 일반화를 계획한다.',
    ])}</ul>

  <h2>8. 역할 분담</h2>
  <table>
    <tr><th>담당</th><th>역할</th></tr>
    <tr><td>담임교사</td><td>예방 전략 적용, 대체행동 강화, 일일 자료 기록</td></tr>
    <tr><td>특수교사</td><td>대체행동 교수, 시각 자료 제작, 자료 분석 및 계획 수정</td></tr>
    <tr><td>보호자</td><td>가정에서 대체행동 강화, 가정 내 특이사항 공유</td></tr>
    <tr><td>관련 전문가</td><td>(필요 시) 행동지원·치료 자문</td></tr>
  </table>

  <h2>9. 확인</h2>
  <table class="sign">
    <tr><th>작성자</th><td></td><th>보호자</th><td></td></tr>
    <tr><th>담임교사</th><td></td><th>관리자</th><td></td></tr>
  </table>
</div>`;
    return html;
  }

  const CSS = `
.plan { font-family: 'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif; color:#1f2430; line-height:1.6; font-size:14px; }
.plan h1 { font-size:22px; text-align:center; margin:0 0 8px; }
.plan h2 { font-size:17px; margin:22px 0 8px; padding-bottom:4px; border-bottom:2px solid #3b5bdb; }
.plan h3 { font-size:15px; margin:14px 0 6px; }
.plan table { width:100%; border-collapse:collapse; margin:6px 0; }
.plan th, .plan td { border:1px solid #c9ced8; padding:6px 8px; text-align:left; vertical-align:top; }
.plan th { background:#f1f3f8; width:22%; font-weight:600; }
.plan .sign td { height:40px; }
.plan ul { margin:6px 0; padding-left:22px; }
.plan li { margin:3px 0; }
.plan .plan-note { background:#fff6db; border:1px solid #f0d58a; padding:8px 10px; border-radius:6px; font-size:13px; }
.plan .muted { color:#667085; font-size:13px; }
.plan .bar { background:#eef0f5; height:10px; border-radius:5px; overflow:hidden; }
.plan .bar span { display:block; height:100%; background:#3b5bdb; }
.plan .fn-table th { width:30%; } .plan .fn-table td:nth-child(2) { width:12%; }
`;

  return { generate, josa, CSS, STRATEGIES, fmtDur };
});
