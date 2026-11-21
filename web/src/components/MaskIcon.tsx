interface MaskIconProps {
  className: string;
  iconClassName: string;
}

// SVG의 모양만 mask로 쓰고 색은 배경색으로 칠해, 파일 하나로 상태별 색·크기를 바꾼다.
// className은 아이콘 그림 영역(위치·크기), iconClassName은 mask 그림·틀 보정·색을 받는다.
const MaskIcon = ({className, iconClassName}: MaskIconProps) => {
  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`}>
      <span
        className={`absolute mask-size-[100%_100%] mask-no-repeat ${iconClassName}`}
      />
    </span>
  );
};

export default MaskIcon;
