import type {ReactNode} from 'react';

import MaskIcon from './MaskIcon';

type RemoteRockerType = 'volume' | 'channel';

interface RemoteRockerProps {
  type: RemoteRockerType;
  className?: string;
}

interface RockerConfig {
  upName: string;
  downName: string;
  label: string;
  labelClassName: string;
  upIcon: ReactNode;
  downIcon: ReactNode;
}

const rockerConfig: Record<RemoteRockerType, RockerConfig> = {
  volume: {
    upName: '볼륨 올리기',
    downName: '볼륨 내리기',
    label: 'VOL',
    labelClassName: 'top-[42px] left-[5px]',
    upIcon: (
      <MaskIcon className="top-[17px] left-[13px] size-[13px] bg-black/50 mask-[url(/remote/volume-up.svg)] mask-size-[100%_100%] group-hover/up:bg-black group-active/up:top-[19px] group-active/up:left-[14px] group-active/up:size-[10px] group-active/up:bg-black" />
    ),
    downIcon: (
      <MaskIcon className="top-[27px] left-[13px] h-[3px] w-[13px] bg-black/50 mask-[url(/remote/volume-down.svg)] mask-size-[100%_100%] group-hover/down:bg-black group-active/down:top-[28px] group-active/down:left-[14px] group-active/down:h-[2px] group-active/down:w-[10px] group-active/down:bg-black" />
    ),
  },
  channel: {
    upName: '채널 올리기',
    downName: '채널 내리기',
    label: 'ch',
    labelClassName: 'top-[39px] left-[9px]',
    upIcon: (
      <MaskIcon className="top-[12px] left-[8px] h-[13px] w-[23px] bg-black/50 mask-[url(/icons/up.svg)] mask-size-[114.2857%_200%] mask-center group-hover/up:bg-black group-active/up:top-[16px] group-active/up:left-[11px] group-active/up:h-[9px] group-active/up:w-[16px] group-active/up:bg-black" />
    ),
    downIcon: (
      <MaskIcon className="top-[21px] left-[8px] h-[13px] w-[23px] bg-black/50 mask-[url(/icons/down.svg)] mask-size-[114.2857%_200%] mask-center group-hover/down:bg-black group-active/down:left-[11px] group-active/down:h-[9px] group-active/down:w-[16px] group-active/down:bg-black" />
    ),
  },
};

const RemoteRocker = ({type, className = 'relative'}: RemoteRockerProps) => {
  const config = rockerConfig[type];

  return (
    <div
      className={`group h-[99px] w-[44px] shrink-0 overflow-hidden border-3 border-solid border-black/50 bg-peach-100 shadow-key hover:border-black hover:bg-bg-accent has-[:active]:border-black has-[:active]:bg-bg-accent has-[[data-half=up]:active]:shadow-rocker-up has-[[data-half=down]:active]:shadow-rocker-down ${className}`}
    >
      <button
        type="button"
        aria-label={config.upName}
        data-half="up"
        className="group/up absolute inset-x-0 top-0 h-[46px]"
      >
        {config.upIcon}
      </button>
      <button
        type="button"
        aria-label={config.downName}
        data-half="down"
        className="group/down absolute inset-x-0 top-[46px] h-[47px]"
      >
        {config.downIcon}
      </button>
      <span
        aria-hidden
        className={`pointer-events-none absolute font-silkscreen text-[11px] leading-normal font-bold whitespace-nowrap text-black/50 group-hover:text-black group-has-[:active]:text-black ${config.labelClassName}`}
      >
        {config.label}
      </span>
    </div>
  );
};

export default RemoteRocker;
