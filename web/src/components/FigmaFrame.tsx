'use client';

import type {ReactNode} from 'react';

import useFitScale from '@/hooks/useFitScale';

interface FigmaFrameProps {
  children: ReactNode;
}

/**
 * Figma 시안 프레임(모바일 402x874, PC 1280x832)을 시안 좌표 그대로 그리고, 화면 안에 다 들어오게
 * 같은 비율로 키우거나 줄인다. 프레임 밖(리모컨 아래쪽)은 잘라서 어떤 화면 크기에서도 시안과 같은 구도로 보인다.
 * 화면이 시안보다 세로로 길면 프레임을 아래에 붙여 리모컨이 화면 아래 끝에서 잘리게 하고, 남는 위·옆은 방 배경이 보인다.
 */
const FigmaFrame = ({children}: FigmaFrameProps) => {
  useFitScale();

  return (
    <div className="flex h-dvh items-end justify-center overflow-hidden">
      <main className="relative h-[874px] w-mobile shrink-0 origin-bottom overflow-clip fit-scale lg:h-[832px] lg:w-[1280px]">
        {children}
      </main>
    </div>
  );
};

export default FigmaFrame;
