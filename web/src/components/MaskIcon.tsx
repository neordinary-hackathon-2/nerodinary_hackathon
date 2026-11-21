interface MaskIconProps {
  className: string;
}

// SVG의 모양만 mask로 쓰고 색은 배경색으로 칠해, 파일 하나로 상태별 색·크기를 바꾼다.
const MaskIcon = ({className}: MaskIconProps) => {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute mask-size-[100%_100%] mask-no-repeat ${className}`}
    />
  );
};

export default MaskIcon;
