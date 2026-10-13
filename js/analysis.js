/*
 * 행동 자료 분석 모듈 (브라우저/Node 공용)
 * - 일별 빈도·지속시간·강도 집계
 * - 추세, 기초선/중재 단계 비교
 * - ABC 기록 기반 행동 기능 추정
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Analysis = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FUNCTIONS = {
    attention: '관심 획득',
    escape: '회피·도피',
    tangible: '물건·활동 획득',
    sensory: '감각 자극(자동 강화)',
  };

  // 각 선행사건/후속결과가 어떤 기능을 시사하는지에 대한 가중치
  const ANTECEDENTS = [
    { code: 'demand', label: '과제·지시 제시', fn: { escape: 1 } },
    { code: 'hard_task', label: '어려운 과제', fn: { escape: 1 } },
    { code: 'low_attention', label: '관심 부족(혼자 있음)', fn: { attention: 1, sensory: 0.5 } },
    { code: 'attention_other', label: '교사가 다른 학생에게 관심', fn: { attention: 1 } },
    { code: 'denied', label: '요구·선호물 거절', fn: { tangible: 1 } },
    { code: 'removed', label: '선호 활동·물건 중단', fn: { tangible: 1 } },
    { code: 'transition', label: '활동 전환', fn: { escape: 0.5, tangible: 0.5 } },
    { code: 'waiting', label: '기다리는 시간', fn: { tangible: 0.5, sensory: 0.5 } },
    { code: 'unstructured', label: '비구조화 시간(할 일 없음)', fn: { sensory: 1 } },
    { code: 'noise', label: '소음·감각 자극 과다', fn: { escape: 1 } },
    { code: 'peer', label: '또래와의 갈등·상호작용', fn: { attention: 0.5, tangible: 0.5 } },
    { code: 'other', label: '기타', fn: {} },
  ];

  const CONSEQUENCES = [
    { code: 'adult_attention', label: '교사 관심(꾸중·설득·달래기)', fn: { attention: 2 } },
    { code: 'peer_attention', label: '또래 관심(웃음·반응)', fn: { attention: 2 } },
    { code: 'task_removed', label: '과제 중단·제거', fn: { escape: 2 } },
    { code: 'task_reduced', label: '과제 감소·지연·대신 해 줌', fn: { escape: 1.5 } },
    { code: 'sent_out', label: '자리·교실에서 분리', fn: { escape: 1.5 } },
    { code: 'item_given', label: '원하는 물건·활동 제공', fn: { tangible: 2 } },
    { code: 'ignored', label: '계획된 무시', fn: { sensory: 0.5 } },
    { code: 'no_response', label: '반응 없음(혼자 행동 지속)', fn: { sensory: 2 } },
    { code: 'redirect', label: '다른 활동으로 재지시', fn: {} },
    { code: 'restraint', label: '신체적 제지·안전 조치', fn: { attention: 0.5 } },
    { code: 'other', label: '기타', fn: {} },
  ];

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  // ---------- 날짜 도우미 ----------
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayKey(d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parseDay(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }
  function addDays(key, n) {
    const d = parseDay(key);
    d.setDate(d.getDate() + n);
    return dayKey(d);
  }

  // ---------- 통계 도우미 ----------
  function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
  function round(x, digits = 1) {
    if (x == null || !isFinite(x)) return null;
    const f = Math.pow(10, digits);
    return Math.round(x * f) / f;
  }
  function linreg(ys) {
    const n = ys.length;
    if (n < 2) return { slope: 0, intercept: ys[0] || 0 };
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    ys.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
    const d = n * sxx - sx * sx;
    const slope = d ? (n * sxy - sx * sy) / d : 0;
    return { slope, intercept: (sy - slope * sx) / n };
  }

  /**
   * 기간 내 일별 자료. 주말은 기록이 있는 날만 관찰일(observed)로 본다.
   */
  function buildDaily(records, from, to) {
    const out = [];
    if (!from || !to || from > to) return out;
    const map = {};
    for (const r of records) {
      const k = dayKey(r.ts);
      (map[k] = map[k] || []).push(r);
    }
    for (let k = from; k <= to; k = addDays(k, 1)) {
      const rs = map[k] || [];
      const wd = parseDay(k).getDay();
      const weekend = wd === 0 || wd === 6;
      let dur = 0, durN = 0, iSum = 0, iN = 0, iMax = 0, abc = 0;
      for (const r of rs) {
        if (r.durationSec > 0) { dur += r.durationSec; durN++; }
        if (r.intensity) { iSum += r.intensity; iN++; iMax = Math.max(iMax, r.intensity); }
        if (r.abc) abc++;
      }
      out.push({
        date: k,
        weekday: wd,
        weekend,
        observed: !weekend || rs.length > 0,
        count: rs.length,
        durationTotal: dur,
        durationN: durN,
        avgDuration: durN ? dur / durN : null,
        avgIntensity: iN ? iSum / iN : null,
        maxIntensity: iN ? iMax : null,
        abcCount: abc,
      });
    }
    return out;
  }

  function summarize(daily, records) {
    const obs = daily.filter(d => d.observed);
    const total = records.length;
    const durs = records.filter(r => r.durationSec > 0).map(r => r.durationSec);
    const ints = records.filter(r => r.intensity).map(r => r.intensity);
    const totalDur = durs.reduce((a, b) => a + b, 0);
    return {
      obsDays: obs.length,
      daysWithBehavior: obs.filter(d => d.count > 0).length,
      totalCount: total,
      meanPerDay: obs.length ? total / obs.length : 0,
      maxPerDay: obs.reduce((m, d) => Math.max(m, d.count), 0),
      durationRecords: durs.length,
      avgDurationSec: durs.length ? totalDur / durs.length : null,
      maxDurationSec: durs.length ? Math.max(...durs) : null,
      meanDurationPerDaySec: durs.length && obs.length ? totalDur / obs.length : null,
      intensityRecords: ints.length,
      avgIntensity: mean(ints),
      maxIntensity: ints.length ? Math.max(...ints) : null,
      abcRecords: records.filter(r => r.abc).length,
    };
  }

  function trend(daily) {
    const ys = daily.filter(d => d.observed).map(d => d.count);
    if (ys.length < 5) return { slope: 0, label: '판단 불가(자료 부족)', direction: 'unknown' };
    const { slope } = linreg(ys);
    const m = mean(ys) || 0;
    const weekly = slope * 5; // 학교 1주(5일) 기준 변화량
    const threshold = Math.max(0.1 * m, 0.2);
    let direction = 'stable', label = '안정(뚜렷한 변화 없음)';
    if (weekly > threshold) { direction = 'up'; label = '증가 추세'; }
    else if (weekly < -threshold) { direction = 'down'; label = '감소 추세'; }
    return { slope, weekly, label, direction };
  }

  function phaseComparison(daily, records, interventionDate) {
    if (!interventionDate) return null;
    const obs = daily.filter(d => d.observed);
    const base = obs.filter(d => d.date < interventionDate);
    const inter = obs.filter(d => d.date >= interventionDate);
    const phaseOf = r => (dayKey(r.ts) < interventionDate ? 'base' : 'inter');
    const durOf = p => mean(records.filter(r => phaseOf(r) === p && r.durationSec > 0).map(r => r.durationSec));
    const intOf = p => mean(records.filter(r => phaseOf(r) === p && r.intensity).map(r => r.intensity));
    const res = {
      interventionDate,
      baseDays: base.length,
      interDays: inter.length,
      baseMean: mean(base.map(d => d.count)),
      interMean: mean(inter.map(d => d.count)),
      baseAvgDuration: durOf('base'),
      interAvgDuration: durOf('inter'),
      baseAvgIntensity: intOf('base'),
      interAvgIntensity: intOf('inter'),
      changePct: null,
      pnd: null,
    };
    if (base.length && inter.length) {
      if (res.baseMean > 0) res.changePct = (res.interMean - res.baseMean) / res.baseMean * 100;
      // PND(비중복 자료 비율): 감소 목표 행동이므로 기초선 최저치보다 낮은 중재 자료 비율
      const minBase = Math.min(...base.map(d => d.count));
      res.pnd = inter.filter(d => d.count < minBase).length / inter.length * 100;
    }
    return res;
  }

  function functionAnalysis(records) {
    const scores = { attention: 0, escape: 0, tangible: 0, sensory: 0 };
    const anteMap = Object.fromEntries(ANTECEDENTS.map(a => [a.code, a.fn]));
    const consMap = Object.fromEntries(CONSEQUENCES.map(c => [c.code, c.fn]));
    let n = 0;
    for (const r of records) {
      if (!r.abc) continue;
      n++;
      for (const c of r.abc.antecedents || []) {
        for (const [f, w] of Object.entries(anteMap[c] || {})) scores[f] += w;
      }
      for (const c of r.abc.consequences || []) {
        for (const [f, w] of Object.entries(consMap[c] || {})) scores[f] += w;
      }
      if (r.abc.functionGuess && scores[r.abc.functionGuess] != null) scores[r.abc.functionGuess] += 3;
    }
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const percents = {};
    for (const k of Object.keys(scores)) percents[k] = total ? scores[k] / total * 100 : 0;
    const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    const primary = total > 0 ? ranked[0] : null;
    const secondary = primary && percents[ranked[1]] >= 25 ? ranked[1] : null;

    const levels = ['매우 낮음', '낮음', '보통', '높음'];
    let level = n < 3 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3;
    const mixed = primary && percents[ranked[0]] - percents[ranked[1]] < 15;
    if (mixed && level > 0) level--;
    return {
      abcCount: n,
      scores,
      percents,
      ranked,
      primary,
      secondary,
      mixed: !!mixed,
      confidence: primary ? levels[level] : '판단 불가',
    };
  }

  function topCounts(records, getter, labels, limit = 5) {
    const counts = {};
    let n = 0;
    for (const r of records) {
      const vals = getter(r);
      if (!vals || !vals.length) continue;
      n++;
      for (const v of vals) if (v) counts[v] = (counts[v] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([code, count]) => ({ code, label: (labels && labels[code]) || code, count, pct: n ? count / n * 100 : 0 }));
  }

  const ANTE_LABELS = Object.fromEntries(ANTECEDENTS.map(a => [a.code, a.label]));
  const CONS_LABELS = Object.fromEntries(CONSEQUENCES.map(c => [c.code, c.label]));

  function hourDist(records) {
    const h = new Array(24).fill(0);
    for (const r of records) h[new Date(r.ts).getHours()]++;
    return h;
  }
  function weekdayDist(records) {
    const w = new Array(7).fill(0);
    for (const r of records) w[new Date(r.ts).getDay()]++;
    return w;
  }

  /**
   * 하나의 표적행동에 대한 종합 분석
   * @param behavior { id, interventionDate }
   * @param records  해당 행동의 기록 배열 { ts, durationSec, intensity, abc }
   * @param opts     { from, to } (YYYY-MM-DD)
   */
  function analyze(behavior, records, opts = {}) {
    const all = records.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const to = opts.to || dayKey(new Date());
    const from = opts.from || (all.length ? dayKey(all[0].ts) : to);
    const inRange = all.filter(r => { const k = dayKey(r.ts); return k >= from && k <= to; });
    const daily = buildDaily(inRange, from, to);
    const abcRecs = inRange.filter(r => r.abc);
    const hours = hourDist(inRange);
    const maxHour = Math.max(...hours);
    return {
      from,
      to,
      records: inRange,
      daily,
      summary: summarize(daily, inRange),
      trend: trend(daily),
      phase: phaseComparison(daily, inRange, behavior && behavior.interventionDate),
      fn: functionAnalysis(inRange),
      antecedents: topCounts(abcRecs, r => r.abc.antecedents, ANTE_LABELS),
      consequences: topCounts(abcRecs, r => r.abc.consequences, CONS_LABELS),
      settings: topCounts(abcRecs, r => [r.abc.setting && r.abc.setting.trim()], null, 3),
      activities: topCounts(abcRecs, r => [r.abc.activity && r.abc.activity.trim()], null, 3),
      hours,
      peakHours: maxHour > 0 ? hours.map((c, h) => ({ h, c })).filter(x => x.c === maxHour).map(x => x.h) : [],
      weekdays: weekdayDist(inRange),
    };
  }

  return {
    FUNCTIONS, ANTECEDENTS, CONSEQUENCES, ANTE_LABELS, CONS_LABELS, WEEKDAYS,
    dayKey, parseDay, addDays, mean, round, linreg,
    buildDaily, summarize, trend, phaseComparison, functionAnalysis, topCounts,
    hourDist, weekdayDist, analyze,
  };
});
