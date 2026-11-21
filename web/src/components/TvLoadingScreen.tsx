import Image from 'next/image';

/** TV 화면의 로딩 상태 (Figma Pixel TV loading). 전원을 켤 때와 채널을 바꿀 때 쓴다. */
const TvLoadingScreen = () => {
  return (
    <div className="absolute inset-0 bg-olive-500">
      <Image
        src="/tv/scanlines.svg"
        width={280}
        height={150}
        alt=""
        className="absolute top-[6px] left-[10px]"
      />
      {/* 화면 가운데 정렬하면 반 픽셀 위치에 놓여 픽셀 경계가 흐려지므로 Figma 정수 좌표에 고정한다. */}
      <div className="absolute top-[59px] left-[71px] flex flex-col items-center gap-3">
        <div className="border-2 border-ink-900 bg-olive-300 p-1">
          <div className="relative">
            <div className="flex gap-[3px]">
              {Array.from({length: 10}, (_, index) => (
                <span key={index} className="h-2.5 w-3 bg-olive-700" />
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 w-[60px] animate-tv-progress overflow-hidden motion-reduce:animate-none">
              <div className="flex w-[147px] gap-[3px]">
                {Array.from({length: 10}, (_, index) => (
                  <span key={index} className="h-2.5 w-3 shrink-0 bg-ink-900" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="font-silkscreen text-[9px] leading-[10.8px] font-bold tracking-[0.36px] text-ink-700">
          PLEASE WAIT
        </p>
      </div>
    </div>
  );
};

export default TvLoadingScreen;
