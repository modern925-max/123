/*
 * 사진 속 글자 읽기 (Tesseract.js, 처음 쓸 때만 인터넷에서 불러옴)
 * 사진은 이 기기 안에서만 처리되고 서버로 보내지 않습니다.
 */
(function () {
  'use strict';
  const SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const STATUS = {
    'loading tesseract core': '글자 읽기 도구를 불러오는 중',
    'initializing tesseract': '글자 읽기 도구를 준비하는 중',
    'loading language traineddata': '한글 자료를 불러오는 중 (처음 한 번은 조금 걸려요)',
    'initializing api': '준비하는 중',
    'recognizing text': '글자를 읽는 중',
  };
  let loading = null;

  function load() {
    if (window.Tesseract) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SRC;
        s.onload = resolve;
        s.onerror = () => {
          loading = null;
          reject(new Error('글자 읽기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
        };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // 큰 사진은 줄이고 흑백·대비를 높여 더 빠르고 정확하게 읽게 합니다.
  async function prepare(file) {
    let img;
    try {
      img = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('사진을 열지 못했어요.'));
        el.src = URL.createObjectURL(file);
      });
    }
    const w = img.width, h = img.height;
    const scale = Math.min(1, 2200 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d');
    ctx.filter = 'grayscale(1) contrast(1.25)';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /**
   * @param {File} file
   * @param {(progress:number|null, msg:string)=>void} onProgress
   * @returns {Promise<string>} 정리된 글
   */
  async function recognize(file, onProgress = () => {}) {
    onProgress(null, '글자 읽기 도구를 불러오는 중');
    await load();
    const canvas = await prepare(file);
    const worker = await window.Tesseract.createWorker('kor', 1, {
      logger: m => onProgress(m.status === 'recognizing text' ? m.progress : null, STATUS[m.status] || '준비하는 중'),
    });
    try {
      const { data } = await worker.recognize(canvas);
      return window.Easy.cleanOcr(data.text);
    } finally {
      worker.terminate();
    }
  }

  window.OCR = { recognize };
})();
