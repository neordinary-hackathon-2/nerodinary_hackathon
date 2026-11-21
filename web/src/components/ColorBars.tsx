// 칸 너비를 38/37px로 번갈아 둬서 모든 경계가 정수 픽셀에 놓이게 한다(Figma와 같은 위치).
const COLOR_BAR_CLASSES = [
  'bg-colorbar-1',
  'bg-colorbar-2',
  'bg-colorbar-3',
  'bg-colorbar-4',
  'bg-colorbar-5',
  'bg-colorbar-6',
  'bg-colorbar-7',
  'bg-colorbar-8',
];

const ColorBars = () => {
  return (
    <div className="grid size-full grid-cols-[repeat(4,38px_37px)]">
      {COLOR_BAR_CLASSES.map((colorClass) => (
        <div key={colorClass} className={colorClass} />
      ))}
    </div>
  );
};

export default ColorBars;
