import Image from 'next/image';
import type {ReactNode} from 'react';

import ColorBars from '@/components/ColorBars';
import type {TvScreen} from '@/constants/tv';

interface PixelTvProps {
  screen: TvScreen;
  channelLabel: string;
  children?: ReactNode;
}

const SCREEN_BACKGROUND_CLASSES: Record<TvScreen, string> = {
  off: 'bg-ink-900',
  loading: 'bg-olive-500',
  noSignal: '',
  live: 'bg-ink-900',
};

const LoadingContent = () => {
  return (
    // 화면 가운데 정렬하면 반 픽셀 위치에 놓여 픽셀 경계가 흐려지므로 Figma 정수 좌표에 고정한다.
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
  );
};

const PixelTv = ({screen, channelLabel, children}: PixelTvProps) => {
  return (
    <div className="relative h-[346px] w-[362px]">
      <Image
        src="/tv/leg.svg"
        width={40}
        height={22}
        alt=""
        className="absolute top-[322px] left-[268px]"
      />
      <Image
        src="/tv/leg.svg"
        width={40}
        height={22}
        alt=""
        className="absolute top-[322px] left-[52px]"
      />
      <Image
        src="/tv/antenna.svg"
        width={356}
        height={56}
        alt=""
        className="absolute top-0 left-0"
      />
      <Image
        src="/tv/antenna-ball-left.svg"
        width={16}
        height={16}
        alt=""
        className="absolute top-0 left-[110px]"
      />
      <Image
        src="/tv/antenna-ball-right.svg"
        width={16}
        height={16}
        alt=""
        className="absolute top-0 left-[230px]"
      />
      <Image
        src="/tv/antenna-base.svg"
        width={40}
        height={14}
        alt=""
        className="absolute top-[44px] left-[158px]"
      />
      <Image
        src="/tv/body.svg"
        width={362}
        height={274}
        alt=""
        className="absolute top-[56px] left-0"
      />
      <Image
        src="/tv/bezel.svg"
        width={320}
        height={184}
        alt=""
        className="absolute top-[74px] left-[18px]"
      />
      <div
        className={`tv-screen-mask absolute top-[84px] left-[28px] h-[164px] w-[300px] overflow-hidden ${SCREEN_BACKGROUND_CLASSES[screen]}`}
      >
        {screen === 'loading' && (
          <>
            <Image
              src="/tv/scanlines.svg"
              width={280}
              height={150}
              alt=""
              className="absolute top-[6px] left-[10px]"
            />
            <LoadingContent />
          </>
        )}
        {screen === 'noSignal' && <ColorBars />}
        {screen === 'live' && children}
      </div>
      <Image
        src="/tv/dither.svg"
        width={332}
        height={8}
        alt=""
        className="absolute top-[266px] left-[12px]"
      />
      <div className="absolute top-[282px] left-[22px] flex h-7 w-16 items-center justify-center bg-ink-900 font-press-start text-[9px] leading-[9px] text-white shadow-tv-led">
        {channelLabel}
      </div>
      <div className="absolute top-[286px] left-[102px] flex gap-1">
        {Array.from({length: 8}, (_, index) => (
          <span key={index} className="h-5 w-1 bg-ink-700" />
        ))}
      </div>
      <Image
        src="/tv/knob-channel.svg"
        width={33}
        height={36}
        alt=""
        className="absolute top-[279px] left-[257px]"
      />
      <Image
        src="/tv/knob-volume.svg"
        width={33}
        height={36}
        alt=""
        className="absolute top-[279px] left-[301px]"
      />
      <p className="absolute top-[290px] left-[174px] font-silkscreen text-[9px] leading-[11.52px] font-bold text-ink-700">
        BAP-TV
      </p>
    </div>
  );
};

export default PixelTv;
