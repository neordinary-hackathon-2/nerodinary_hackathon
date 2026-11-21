import type {ReactNode} from 'react';

type RemoteButtonType = 'power' | 'refresh' | 'volume' | 'channel' | 'number';

interface RemoteButtonProps {
  type: RemoteButtonType;
  label?: string;
  className?: string;
}

interface MaskIconProps {
  className: string;
}

const KEY_COLOR =
  'border-black/50 bg-peach-100 hover:border-black hover:bg-bg-accent active:border-black active:bg-bg-accent';

const KEY_TEXT_COLOR =
  'text-black/50 group-hover:text-black group-active:text-black';

const buttonClassName: Record<RemoteButtonType, string> = {
  power:
    'h-[28px] w-[30px] border-ink-900 bg-bg-surface shadow-key-sm hover:bg-bg-accent active:bg-ink-700 active:shadow-none',
  refresh: `h-[28px] w-[31px] ${KEY_COLOR} shadow-key-sm active:shadow-none`,
  volume: `h-[99px] w-[44px] ${KEY_COLOR} shadow-key active:shadow-key-pressed`,
  channel: `h-[99px] w-[44px] ${KEY_COLOR} shadow-key active:shadow-none`,
  number: `flex h-[31px] w-[41px] items-center justify-center ${KEY_COLOR} shadow-key active:shadow-key-pressed`,
};

const buttonName: Record<RemoteButtonType, string | undefined> = {
  power: '전원',
  refresh: '새로고침',
  volume: '볼륨',
  channel: '채널',
  number: undefined,
};

// SVG의 모양만 mask로 쓰고 색은 배경색으로 칠해, 파일 하나로 상태별 색·크기를 바꾼다.
const MaskIcon = ({className}: MaskIconProps) => (
  <span
    aria-hidden
    className={`absolute mask-size-[100%_100%] mask-no-repeat ${className}`}
  />
);

const renderContent: Record<RemoteButtonType, (label?: string) => ReactNode> = {
  power: () => (
    <MaskIcon className="top-[2px] left-[3px] size-[18px] bg-ink-900 mask-[url(/remote/power.svg)] group-active:bg-white" />
  ),
  refresh: () => (
    <MaskIcon className="top-[3px] left-[5px] size-[14.8425px] bg-black/50 mask-[url(/remote/refresh.svg)] group-hover:bg-ink-900 group-active:top-[4px] group-active:left-[6px] group-active:size-[12.8635px] group-active:bg-black" />
  ),
  volume: () => (
    <>
      <MaskIcon className="top-[17px] left-[13px] size-[13px] bg-black/50 mask-[url(/remote/volume-up.svg)] group-hover:bg-black group-active:top-[19px] group-active:left-[14px] group-active:size-[10px] group-active:bg-black" />
      <span
        className={`absolute top-[42px] left-[5px] font-silkscreen text-[11px] leading-normal font-bold whitespace-nowrap ${KEY_TEXT_COLOR}`}
      >
        VOL
      </span>
      <span
        aria-hidden
        className="absolute top-[73px] left-[13px] h-[3px] w-[13px] bg-[url(/remote/volume-down.svg)] bg-no-repeat"
      />
    </>
  ),
  channel: () => (
    <>
      <MaskIcon className="top-[12px] left-[8px] h-[13px] w-[23px] bg-black/50 mask-[url(/remote/channel-up.svg)] group-hover:bg-black group-active:top-[16px] group-active:left-[11px] group-active:h-[9px] group-active:w-[16px] group-active:bg-black" />
      <span
        className={`absolute top-[39px] left-[9px] font-silkscreen text-[11px] leading-normal font-bold whitespace-nowrap ${KEY_TEXT_COLOR}`}
      >
        ch
      </span>
      <MaskIcon className="top-[67px] left-[8px] h-[13px] w-[23px] -scale-y-100 bg-black/50 mask-[url(/remote/channel-up.svg)]" />
    </>
  ),
  number: (label) => (
    <span
      className={`font-press-start text-[11px] leading-none ${KEY_TEXT_COLOR}`}
    >
      {label}
    </span>
  ),
};

const RemoteButton = ({
  type,
  label,
  className = 'relative',
}: RemoteButtonProps) => {
  return (
    <button
      type="button"
      aria-label={buttonName[type]}
      className={`group shrink-0 overflow-hidden border-3 border-solid ${buttonClassName[type]} ${className}`}
    >
      {renderContent[type](label)}
    </button>
  );
};

export default RemoteButton;
