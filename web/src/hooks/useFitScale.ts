import {useEffect} from 'react';

// Figma 모바일 시안 프레임(home) 크기. 이 크기에 맞춰 그린 화면을 실제 화면에 들어가게 줄인다.
const DESIGN_WIDTH = 402;
const DESIGN_HEIGHT = 874;

/**
 * 모바일 화면이 Figma 프레임(402x874)보다 좁거나 낮으면 화면 전체를 같은 비율로 줄일 배율을
 * `--fit-scale` CSS 변수로 둔다. 배율은 globals.css의 `fit-scale` 유틸리티가 쓴다.
 *
 * 화면 높이·폭으로 나눈 값을 CSS만으로 구하면(길이 ÷ 길이) Chrome 140 미만에서 동작하지 않거나
 * 잘못 계산되므로(구형 Android WebView), 배율은 JS로 구한다.
 */
const useFitScale = () => {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const scale = Math.min(
        1,
        window.innerWidth / DESIGN_WIDTH,
        window.innerHeight / DESIGN_HEIGHT,
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
