import type {ReactNode} from 'react';

interface ModalOverlayProps {
  /** 카드 밖 영역(닫기 버튼)의 스크린 리더용 이름. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

// 어두운 배경은 창 전체를 덮고(fixed), 카드는 FigmaFrame과 같은 배율(--fit-scale)로 Figma 프레임 위치에 둔다.
// FigmaFrame 안(scale이 걸린 main)에 두면 fixed도 프레임 기준이 되어 프레임 밖 빈 공간을 못 덮으므로,
// 반드시 FigmaFrame 밖에서 렌더링한다. z-10: TV 화면(유튜브 iframe)까지 어둡게 덮는다.
// 카드 위치: 프레임은 화면 아래에 붙어 있으므로 "프레임 위에서 y" = 화면 아래에서 (프레임 높이 - y) × 배율 위.
// - 모바일(402x874): 시안처럼 프레임 위에서 222px
// - PC(1280x832): 시안처럼 프레임 세로 가운데(위에서 416px)
const ModalOverlay = ({closeLabel, onClose, children}: ModalOverlayProps) => {
  return (
    <div className="fixed inset-0 z-10 bg-black/60 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="absolute top-[calc(100dvh-652px*var(--fit-scale,1))] left-1/2 origin-top -translate-x-1/2 fit-scale lg:top-[calc(100dvh-416px*var(--fit-scale,1))] lg:origin-center lg:-translate-y-1/2">
        {children}
      </div>
    </div>
  );
};

export default ModalOverlay;
