import type {ReactNode} from 'react';

interface ModalOverlayProps {
  /** 카드 밖 영역(닫기 버튼)의 스크린 리더용 이름. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

// Figma Channel Guide: 어두운 배경 위 카드. 카드 밖을 눌러도 닫힌다.
// z-10: TV 화면(유튜브 iframe)보다 위에 그려야 영상까지 어둡게 덮인다.
// fixed: PC에서도 화면 컬럼이 아닌 창 전체를 덮고, PC 시안처럼 카드를 세로 가운데에 둔다.
const ModalOverlay = ({closeLabel, onClose, children}: ModalOverlayProps) => {
  return (
    <div className="fixed inset-0 z-10 flex justify-center bg-black/60 pt-[222px] backdrop-blur-[2px] lg:items-center lg:pt-0">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative h-fit">{children}</div>
    </div>
  );
};

export default ModalOverlay;
