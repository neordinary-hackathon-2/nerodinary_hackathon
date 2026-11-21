interface MaskIconProps {
  className: string;
}

// SVG의 모양만 mask로 쓰고 색은 배경색으로 칠해, 파일 하나로 상태별 색·크기를 바꾼다.
// 위치·크기는 아이콘 그림 영역 기준이고, 틀 여백이 있는 SVG는 mask-size로 그림만 키워 맞춘다.
const MaskIcon = ({className}: MaskIconProps) => {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute mask-no-repeat ${className}`}
    />
  );
};

export default MaskIcon;
