import {useEffect} from 'react';

// Figma 시안 프레임 크기. 모바일은 home(402x874), PC(lg, 64rem 이상)는 pc/home(1280x832).
const MOBILE_FRAME = {width: 402, height: 874};
const PC_FRAME = {width: 1280, height: 832};
const PC_QUERY = '(min-width: 64rem)';

/**
 * Figma 프레임이 화면 안에 다 들어오는 배율(키우기·줄이기 모두)을 `--fit-scale` CSS 변수로 둔다.
 * 배율은 globals.css의 `fit-scale` 유틸리티(FigmaFrame)가 쓴다.
 *
 * 화면 높이·폭으로 나눈 값을 CSS만으로 구하면(길이 ÷ 길이) Chrome 140 미만에서 동작하지 않거나
 * 잘못 계산되므로(구형 Android WebView), 배율은 JS로 구한다.
 */
const useFitScale = () => {
  useEffect(() => {
    const root = document.documentElement;
    const pcQuery = window.matchMedia(PC_QUERY);
    const update = () => {
      const frame = pcQuery.matches ? PC_FRAME : MOBILE_FRAME;
      const scale = Math.min(
        window.innerWidth / frame.width,
        window.innerHeight / frame.height,
      );
      root.style.setProperty('--fit-scale', String(scale));
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      root.style.removeProperty('--fit-scale');
    };
  }, []);
};

export default useFitScale;
