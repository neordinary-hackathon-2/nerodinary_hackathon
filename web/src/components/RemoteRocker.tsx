import type {ReactNode} from 'react';

import MaskIcon from './MaskIcon';

type RemoteRockerType = 'volume' | 'channel';

interface RemoteRockerProps {
  type: RemoteRockerType;
  className?: string;
  disabled?: boolean;
  onClickUp?: () => void;
  onClickDown?: () => void;
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
      <MaskIcon className="top-[27px] left-[13px] h-[3px] w-[13px] bg-black/50 mask-[url(/remote/volume-down.svg)] mask-size-[100%_100%] group-hover/down:bg-black group-active/down:left-[14px] group-active/down:h-[2px] group-active/down:w-[10px] group-active/down:bg-black" />
    ),
  },
  channel: {
    upName: '채널 올리기',
    downName: '채널 내리기',
    label: 'ch',
    labelClassName: 'top-[40px] left-[8px] w-[23px] text-center',
    upIcon: (
      <MaskIcon className="top-[9px] left-[8px] size-[23px] bg-black/50 mask-[url(/icons/up.svg)] mask-size-[100%_100%] group-hover/up:bg-black group-active/up:top-[15px] group-active/up:left-[11.5px] group-active/up:size-[16px] group-active/up:bg-black" />
    ),
    downIcon: (
      <MaskIcon className="top-[16px] left-[8px] size-[23px] bg-black/50 mask-[url(/icons/down.svg)] mask-size-[100%_100%] group-hover/down:bg-black group-active/down:left-[11.5px] group-active/down:size-[16px] group-active/down:bg-black" />
    ),
  },
};

const RemoteRocker = ({
  type,
  className = 'relative',
  disabled = false,
  onClickUp,
  onClickDown,
}: RemoteRockerProps) => {
  const config = rockerConfig[type];

  return (
    <div
      // 비활성이면 로커 전체가 hover·눌림 모양을 보이지 않도록 포인터 이벤트를 막는다.
      className={`group h-[99px] w-[44px] shrink-0 overflow-hidden border-3 border-solid border-black/50 bg-peach-100 shadow-key hover:border-black hover:bg-bg-accent has-[:active]:border-black has-[:active]:bg-bg-accent has-[[data-half=up]:active]:shadow-rocker-up has-[[data-half=down]:active]:shadow-rocker-down ${disabled ? 'pointer-events-none' : ''} ${className}`}
    >
      <button
        type="button"
        aria-label={config.upName}
        data-half="up"
        disabled={disabled}
        onClick={onClickUp}
        className="group/up absolute inset-x-0 top-0 h-[46px]"
      >
        {config.upIcon}
      </button>
      <button
        type="button"
        aria-label={config.downName}
        data-half="down"
        disabled={disabled}
        onClick={onClickDown}
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
