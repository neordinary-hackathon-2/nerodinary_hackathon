import Image from 'next/image';
import type {ReactNode} from 'react';

import ColorBars from '@/components/ColorBars';
import TvLoadingScreen from '@/components/TvLoadingScreen';
import type {TvScreen} from '@/constants/tv';

interface PixelTvProps {
  screen: TvScreen;
  channelLabel: string;
  /** 전원을 끄는 CRT 연출 중. 마지막 화면이 가로줄로 접히며 사라진다. */
  isPoweringOff?: boolean;
  children?: ReactNode;
}

const PixelTv = ({
  screen,
  channelLabel,
  isPoweringOff = false,
  children,
}: PixelTvProps) => {
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
      {/* 꺼진 화면은 검은 유리. 켜지면 화면 내용이 가로줄에서 펼쳐지고(crt-on), 끌 때는 다시 접힌다(crt-off). */}
      <div className="tv-screen-mask absolute top-[84px] left-[28px] h-[164px] w-[300px] overflow-hidden bg-ink-900">
        {screen !== 'off' && (
          <div
            className={`absolute inset-0 motion-reduce:animate-none ${isPoweringOff ? 'animate-crt-off' : 'animate-crt-on'}`}
          >
            {screen === 'loading' && <TvLoadingScreen />}
            {screen === 'noSignal' && <ColorBars />}
            {screen === 'live' && children}
          </div>
        )}
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
