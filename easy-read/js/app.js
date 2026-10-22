/*
 * 쉬운 안내문 — 화면(UI) 로직
 */
(function () {
  'use strict';
  const E = Easy;
  const KEY = 'easyRead.v1';

  const SAMPLE = `2026학년도 2학기 현장체험학습 안내

학부모님 안녕하십니까? 결실의 계절 가을을 맞아 가정에 건강과 행복이 가득하시길 기원합니다.
본교에서는 아래와 같이 현장체험학습을 실시하오니 협조 부탁드립니다.

1. 일시: 2026. 10. 30.(금) 09:00 ~ 15:00
2. 장소: 국립중앙박물관
3. 집결 장소: 본교 운동장
4. 교통편: 전세버스
5. 준비물: 도시락, 물, 돗자리, 모자
6. 복장: 체육복, 운동화
7. 비용: 15,000원
8. 유의사항
 - 우천 시에도 정상 진행합니다.
 - 시간을 엄수하여 8시 50분까지 등교하시기 바랍니다.
 - 체험 중 휴대폰 사용을 금지합니다.
 - 참가 동의서를 10월 23일(금)까지 담임선생님께 제출해 주십시오.

OO초등학교장`;

  const state = { title: '', cards: [], rest: [], size: 'l', slide: 0 };

  // ======================== 공통 ========================
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2000);
  }
  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').classList.remove('hidden');
  }
  function closeModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ text: $('#src').value, ...state }));
    } catch (e) { /* 저장할 수 없는 환경이면 넘어감 */ }
  }
  function restore() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d) return;
      $('#src').value = d.text || '';
      Object.assign(state, { title: d.title || '', cards: d.cards || [], rest: d.rest || [], size: d.size || 'l' });
    } catch (e) { /* 무시 */ }
  }

  // ======================== 그림 ========================
  function calendarSvg(x) {
    return `<div class="cal-ico" role="img" aria-label="${x.m}월 ${x.d}일 ${x.wd ? x.wd + '요일' : ''}">
      <div class="cal-m">${x.m}월</div>
      <div class="cal-d">${x.d}</div>
      ${x.wd ? `<div class="cal-w ${x.wd === '일' ? 'sun' : x.wd === '토' ? 'sat' : ''}">${x.wd}요일</div>` : ''}
    </div>`;
  }
  function clockSvg(t) {
    const hAng = ((t.h % 12) + t.min / 60) * 30;
    const mAng = t.min * 6;
    const nums = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1, a = (n * 30 - 90) * Math.PI / 180;
      return `<text x="${50 + 36 * Math.cos(a)}" y="${50 + 36 * Math.sin(a)}" class="clk-n">${n}</text>`;
    }).join('');
    const day = t.h >= 6 && t.h < 18;
    return `<svg class="clock" viewBox="0 0 100 100" role="img" aria-label="${esc(E.fmtTime(t))}">
      <circle cx="50" cy="50" r="47" class="clk-face"/>
      ${nums}
      <line x1="50" y1="50" x2="50" y2="25" class="clk-h" transform="rotate(${hAng} 50 50)"/>
      <line x1="50" y1="50" x2="50" y2="14" class="clk-m" transform="rotate(${mAng} 50 50)"/>
      <circle cx="50" cy="50" r="3.5" class="clk-c"/>
      <text x="50" y="72" class="clk-sun">${day ? '☀️' : '🌙'}</text>
    </svg>`;
  }
  function visualHtml(c) {
    const v = c.visual;
    let inner;
    if (v && v.type === 'calendar' && v.dates && v.dates.length) inner = v.dates.map(calendarSvg).join('<span class="tilde">~</span>');
    else if (v && v.type === 'clock' && v.times && v.times.length) inner = v.times.map(clockSvg).join('<span class="tilde">~</span>');
    else inner = `<span class="emoji">${esc(c.emoji || '💡')}</span>`;
    return `<div class="visual ${c.ban ? 'ban' : ''}">${inner}${c.ban ? '<span class="ban-mark" aria-label="하면 안 돼요"></span>' : ''}</div>`;
  }

  // ======================== 카드 그리기 ========================
  function render() {
    $('#result').classList.toggle('hidden', !state.cards.length && !state.title);
    document.body.dataset.size = state.size;
    document.querySelectorAll('[data-action="size"]').forEach(b => b.classList.toggle('active', b.dataset.size === state.size));
    $('#title').textContent = state.title;
    $('#cards').innerHTML = state.cards.map((c, i) => `
      <article class="ecard ${c.ban ? 'is-ban' : ''} kind-${esc(c.kind || 'note')}" data-id="${c.id}">
        <div class="ecard-top">
          <span class="ecard-no">${i + 1}</span>
          <span class="ecard-label" contenteditable="true" spellcheck="false" data-field="label" data-id="${c.id}">${esc(c.label)}</span>
        </div>
        <button class="visual-btn" data-action="pickEmoji" data-id="${c.id}" title="그림 바꾸기">${visualHtml(c)}</button>
        <div class="ecard-kw" contenteditable="true" spellcheck="false" data-field="keyword" data-id="${c.id}">${esc(c.keyword)}</div>
        <p class="ecard-sent" contenteditable="true" spellcheck="false" data-field="sentence" data-id="${c.id}">${esc(c.sentence)}</p>
        <div class="ecard-tools no-print">
          <button class="icon-btn" data-action="speak" data-id="${c.id}" title="읽어 주기">🔊</button>
          <button class="icon-btn" data-action="move" data-id="${c.id}" data-d="-1" title="앞으로" ${i === 0 ? 'disabled' : ''}>◀</button>
          <button class="icon-btn" data-action="move" data-id="${c.id}" data-d="1" title="뒤로" ${i === state.cards.length - 1 ? 'disabled' : ''}>▶</button>
          <button class="icon-btn danger" data-action="del" data-id="${c.id}" title="카드 지우기">🗑</button>
        </div>
      </article>`).join('');
    $('#restBox').classList.toggle('hidden', !state.rest.length);
    $('#rest').innerHTML = state.rest.map((r, i) => `
      <li><span>${esc(r.easy)}</span> <button class="btn small" data-action="restToCard" data-i="${i}">+ 카드로</button></li>`).join('');
  }

  const cardById = id => state.cards.find(c => c.id === id);

  // ======================== 읽어 주기 ========================
  function speak(texts, onEach) {
    if (!('speechSynthesis' in window)) { toast('이 브라우저는 읽어 주기를 지원하지 않아요.'); return; }
    speechSynthesis.cancel();
    const voice = speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang));
    texts.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'ko-KR';
      u.rate = 0.85;
      if (voice) u.voice = voice;
      if (onEach) {
        u.onstart = () => onEach(i);
        if (i === texts.length - 1) u.onend = () => onEach(-1);
      }
      speechSynthesis.speak(u);
    });
  }
  const cardSpeech = c => c.sentence || c.keyword;

  // ======================== 한 장씩 보기 ========================
  function renderSlide() {
    const c = state.cards[state.slide];
    if (!c) return;
    $('#slideBody').innerHTML = `
      <div class="ecard big ${c.ban ? 'is-ban' : ''}">
        ${c.label ? `<div class="ecard-top"><span class="ecard-label">${esc(c.label)}</span></div>` : ''}
        ${visualHtml(c)}
        <div class="ecard-kw">${esc(c.keyword)}</div>
        <p class="ecard-sent">${esc(c.sentence)}</p>
      </div>`;
    $('#slideNo').textContent = `${state.slide + 1} / ${state.cards.length}`;
  }

  // ======================== 그림 고르기 ========================
  function emojiPicker(id, q = '') {
    const c = cardById(id);
    const query = q.trim();
    const list = Pictos.PICTOS.filter(p => !query || p.label.includes(query) || p.words.some(w => w.includes(query) || query.includes(w)));
    openModal(`
      <h3>그림 고르기</h3>
      <input class="input" id="pickQ" placeholder="찾을 낱말 (예: 버스, 우산)" value="${esc(query)}" data-input="pickSearch" data-id="${id}">
      <div class="emoji-grid">
        ${list.map(p => `<button class="emoji-opt" data-action="setEmoji" data-id="${id}" data-e="${esc(p.emoji)}" title="${esc(p.label)}"><span>${p.emoji}</span><small>${esc(p.label)}</small></button>`).join('') || '<p class="muted">찾는 그림이 없어요. 아래에 직접 넣어 보세요.</p>'}
      </div>
      <div class="row">
        <input class="input short" id="pickCustom" placeholder="그림 문자 직접 넣기 😀" maxlength="8">
        <button class="btn" data-action="setEmojiCustom" data-id="${id}">넣기</button>
      </div>
      <div class="row">
        <label class="check"><input type="checkbox" data-change="toggleBan" data-id="${id}" ${c && c.ban ? 'checked' : ''}> 🚫 '하면 안 돼요' 표시</label>
        ${c && c.visual ? `<button class="btn small" data-action="dropVisual" data-id="${id}">달력·시계 대신 그림 쓰기</button>` : ''}
      </div>`);
    const input = $('#pickQ');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  // ======================== AI 챗봇 ========================
  function aiModal() {
    const text = $('#src').value.trim();
    if (!text) { toast('먼저 안내문 글을 넣어 주세요.'); return; }
    openModal(`
      <h3>🤖 AI 챗봇으로 만들기 <small class="muted">(API 키·비용 없음)</small></h3>
      <ol class="steps">
        <li><button class="btn primary" data-action="copyPrompt">📋 부탁 글 복사</button>
          <span class="muted small">전화번호·이메일은 가려서 복사돼요. 학생 이름 등 개인정보는 미리 지워 주세요.</span></li>
        <li>사용하는 챗봇에 붙여넣기:
          <a class="btn small" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
          <a class="btn small" href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
          <a class="btn small" href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a></li>
        <li>챗봇의 답(JSON)을 모두 복사해 아래에 붙여넣기
          <textarea id="aiAnswer" rows="6" placeholder='{"title": "...", "cards": [...]}'></textarea>
          <button class="btn primary" data-action="applyAi">카드로 바꾸기</button></li>
      </ol>`);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  // ======================== 사진 글자 읽기 ========================
  async function readPhoto(file) {
    if (!file) return;
    const box = $('#ocr');
    box.classList.remove('hidden', 'error');
    $('#ocrImg').src = URL.createObjectURL(file);
    $('#ocrBar').style.width = '0%';
    const setMsg = (p, msg) => {
      $('#ocrMsg').textContent = p == null ? msg + '…' : `${msg}… ${Math.round(p * 100)}%`;
      if (p != null) $('#ocrBar').style.width = `${Math.round(p * 100)}%`;
    };
    try {
      const text = await OCR.recognize(file, setMsg);
      if (!text.trim()) throw new Error('글자를 찾지 못했어요. 밝은 곳에서 안내문이 화면에 꽉 차게 다시 찍어 보세요.');
      const src = $('#src');
      src.value = src.value.trim() ? `${src.value.trim()}\n\n${text}` : text;
      $('#ocrBar').style.width = '100%';
      $('#ocrMsg').textContent = '✅ 다 읽었어요. 아래 글에서 틀린 글자를 고친 뒤 [쉬운 카드 만들기]를 누르세요.';
      save();
      src.focus();
    } catch (e) {
      box.classList.add('error');
      $('#ocrMsg').textContent = '⚠️ ' + (e.message || '글자를 읽지 못했어요.');
    }
  }

  // ======================== 동작 ========================
  const Actions = {
    sample() {
      $('#src').value = SAMPLE;
      save();
      Actions.build();
    },
    clear() {
      if (($('#src').value || state.cards.length) && !confirm('넣은 글과 카드를 모두 지울까요?')) return;
      $('#src').value = '';
      Object.assign(state, { title: '', cards: [], rest: [] });
      $('#ocr').classList.add('hidden');
      save();
      render();
    },
    build() {
      const text = $('#src').value.trim();
      if (!text) { toast('안내문 글을 넣어 주세요.'); return; }
      const r = E.buildCards(text);
      if (!r.cards.length && !r.rest.length) { toast('카드로 만들 내용을 찾지 못했어요.'); return; }
      Object.assign(state, r);
      save();
      render();
      $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(`카드 ${r.cards.length}장을 만들었어요.`);
    },
    ai: aiModal,
    async copyPrompt() {
      const ok = await copyText(E.aiPrompt($('#src').value));
      toast(ok ? '복사했어요. 챗봇 대화창에 붙여넣으세요.' : '복사하지 못했어요.');
    },
    applyAi() {
      try {
        const r = E.parseAi($('#aiAnswer').value);
        state.title = r.title || state.title;
        state.cards = r.cards;
        state.rest = [];
        closeModal();
        save();
        render();
        $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast(`카드 ${r.cards.length}장을 만들었어요.`);
      } catch (e) {
        toast(e.message);
      }
    },
    size(el) { state.size = el.dataset.size; save(); render(); },
    speak(el) { const c = cardById(el.dataset.id); if (c) speak([cardSpeech(c)]); },
    readAll() {
      const texts = [state.title, ...state.cards.map(cardSpeech)].filter(Boolean);
      const offset = state.title ? 1 : 0;
      speak(texts, i => {
        document.querySelectorAll('.ecard.reading').forEach(x => x.classList.remove('reading'));
        const c = state.cards[i - offset];
        const el = c && document.querySelector(`.ecard[data-id="${c.id}"]`);
        if (el) { el.classList.add('reading'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
    },
    move(el) {
      const i = state.cards.findIndex(c => c.id === el.dataset.id);
      const j = i + Number(el.dataset.d);
      if (i < 0 || j < 0 || j >= state.cards.length) return;
      [state.cards[i], state.cards[j]] = [state.cards[j], state.cards[i]];
      save();
      render();
    },
    del(el) {
      state.cards = state.cards.filter(c => c.id !== el.dataset.id);
      save();
      render();
    },
    addCard() {
      const c = E.cardFromSentence('');
      Object.assign(c, { label: '알아 두세요', keyword: '낱말', sentence: '문장을 쓰세요.', emoji: '💡' });
      state.cards.push(c);
      save();
      render();
      const el = document.querySelector(`.ecard[data-id="${c.id}"] .ecard-kw`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
    },
    restToCard(el) {
      const r = state.rest.splice(Number(el.dataset.i), 1)[0];
      if (!r) return;
      state.cards.push(E.cardFromSentence(r.text));
      save();
      render();
      toast('카드를 맨 뒤에 넣었어요.');
    },
    pickEmoji(el) { emojiPicker(el.dataset.id); },
    setEmoji(el) {
      const c = cardById(el.dataset.id);
      if (!c) return;
      c.emoji = el.dataset.e;
      c.visual = null;
      closeModal();
      save();
      render();
    },
    setEmojiCustom(el) {
      const v = $('#pickCustom').value.trim();
      if (!v) return;
      el.dataset.e = v;
      Actions.setEmoji(el);
    },
    dropVisual(el) {
      const c = cardById(el.dataset.id);
      if (c) { c.visual = null; save(); render(); emojiPicker(c.id); }
    },
    print() { window.print(); },
    slides() {
      if (!state.cards.length) return;
      state.slide = 0;
      $('#slides').classList.remove('hidden');
      document.body.classList.add('no-scroll');
      renderSlide();
    },
    slide(el) {
      const n = state.slide + Number(el.dataset.d);
      if (n < 0 || n >= state.cards.length) return;
      state.slide = n;
      renderSlide();
    },
    speakSlide() { const c = state.cards[state.slide]; if (c) speak([cardSpeech(c)]); },
    closeSlides() {
      $('#slides').classList.add('hidden');
      document.body.classList.remove('no-scroll');
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
    closeModal,
  };

  const Changes = {
    photo(el) { readPhoto(el.files && el.files[0]); el.value = ''; },
    toggleBan(el) {
      const c = cardById(el.dataset.id);
      if (!c) return;
      c.ban = el.checked;
      save();
      render();
    },
  };

  // ======================== 이벤트 ========================
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = Actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el); }
  });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('change', e => {
    const fn = Changes[e.target.dataset.change];
    if (fn) fn(e.target);
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'src') { save(); return; }
    if (el.dataset.input === 'pickSearch') { emojiPicker(el.dataset.id, el.value); return; }
    const field = el.dataset.field;
    if (!field) return;
    if (field === 'title') state.title = el.textContent.trim();
    else {
      const c = cardById(el.dataset.id);
      if (c) c[field] = el.textContent.trim();
    }
    save();
  });
  // 고칠 때 줄바꿈 대신 다음 칸으로
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.field) { e.preventDefault(); e.target.blur(); }
    if (!$('#slides').classList.contains('hidden')) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); Actions.slide({ dataset: { d: 1 } }); }
      if (e.key === 'ArrowLeft') Actions.slide({ dataset: { d: -1 } });
      if (e.key === 'Escape') Actions.closeSlides();
    } else if (e.key === 'Escape') closeModal();
  });
  // 붙여넣을 때 서식은 빼고 글자만
  document.addEventListener('paste', e => {
    if (!e.target.dataset || !e.target.dataset.field) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' '));
  });
  // 한 장씩 보기: 밀어서 넘기기
  let touchX = null;
  $('#slides').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#slides').addEventListener('touchend', e => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) Actions.slide({ dataset: { d: dx < 0 ? 1 : -1 } });
  });

  restore();
  render();
})();
