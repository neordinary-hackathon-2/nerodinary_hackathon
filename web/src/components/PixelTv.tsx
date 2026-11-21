import Image from 'next/image';
import type {ReactNode} from 'react';

import ColorBars from '@/components/ColorBars';
import TvLoadingScreen from '@/components/TvLoadingScreen';
import type {TvScreen} from '@/constants/tv';

interface PixelTvProps {
  screen: TvScreen;
  channelLabel: string;
  children?: ReactNode;
}

const SCREEN_BACKGROUND_CLASSES: Record<TvScreen, string> = {
  off: 'bg-ink-900',
  loading: '',
  noSignal: '',
  live: 'bg-ink-900',
};

const PixelTv = ({screen, channelLabel, children}: PixelTvProps) => {
  return (
    // 모바일 반응형: 부모 폭(화면 폭 - 양옆 20px)에 맞춰 비율을 유지한다. 최대 Figma 크기(362x346).
    // 내부 요소는 Figma 픽셀 좌표 그대로 362x346에 그리고, 바깥 폭 / 362 배율로 통째로 줄인다.
    // 배율 = tan(atan2(100cqw, 362px)): CSS에서 길이끼리 나눠 단위 없는 수를 얻는 방법.
    <div className="@container relative aspect-[362/346] w-full max-w-[362px]">
      <div className="absolute top-0 left-0 h-[346px] w-[362px] origin-top-left scale-[tan(atan2(100cqw,362px))]">
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
          {screen === 'loading' && <TvLoadingScreen />}
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
    </div>
  );
};

export default PixelTv;
