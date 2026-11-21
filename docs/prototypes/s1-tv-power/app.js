// 밥송국 S1 — TV 전원 켜기/끄기 (CSS 애니메이션 1회 재생, 로티 미사용)
// 상태: off → powering-on → loading → live → powering-off → off
(() => {
  const frame = document.getElementById('frame');
  const crt = document.getElementById('crt');
  const badgeText = document.getElementById('badgeText');
  const ledText = document.getElementById('ledText');
  const blocks = [...document.querySelectorAll('#progress i')];

  const CRT_MS = 520;
  const LOADING_MS = 2800;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));

  const setState = (s) => {
    frame.dataset.state = s;
    badgeText.textContent = s === 'live' ? 'ON AIR' : 'OFF AIR';
    ledText.textContent = s === 'live' ? 'CH 0' : 'CH --';
  };

  // 애니메이션을 한 번만 재생하고 끝나면 클래스를 지운다
  const playOnce = (cls) => new Promise(resolve => {
    crt.classList.remove('anim-on', 'anim-off');
    void crt.offsetWidth; // 리플로우로 재시작 보장
    crt.classList.add(cls);
    const done = () => { crt.removeEventListener('animationend', done); resolve(); };
    crt.addEventListener('animationend', done);
    setTimeout(done, CRT_MS + 80); // 안전장치
  });

  const resetProgress = () => blocks.forEach((b, i) => b.classList.toggle('on', i < 4));

  async function powerOn() {
    setState('powering-on');
    resetProgress();
    await playOnce('anim-on');
    crt.classList.remove('anim-on');

    setState('loading');
    // 진행바: 남은 6칸을 순서대로 채움 (뚝뚝 끊기는 픽셀 느낌)
    const steps = blocks.length - 4;
    for (let i = 0; i < steps; i++) {
      await wait(LOADING_MS / steps);
      if (frame.dataset.state !== 'loading') return;
      blocks[4 + i].classList.add('on');
    }
    await wait(250);
    if (frame.dataset.state === 'loading') setState('live');
  }

  async function powerOff() {
    setState('powering-off');
    await playOnce('anim-off');
    crt.classList.remove('anim-off');
    setState('off');
  }

  function toggle() {
    const s = frame.dataset.state;
    if (s === 'off') powerOn();
    else if (s === 'live') powerOff();
    // 로딩·전환 중에는 무시
  }

  document.querySelectorAll('[data-power]').forEach(b => b.addEventListener('click', toggle));

  // 모바일 뷰 고정 390x844를 화면에 맞춰 축소
  const fit = () => {
    const s = Math.min(1, innerWidth / 390, innerHeight / 844);
    document.getElementById('stage').style.setProperty('--s', s);
    document.getElementById('stage').style.marginBottom = `${844 * s - 844}px`;
  };
  addEventListener('resize', fit);
  fit();
})();
