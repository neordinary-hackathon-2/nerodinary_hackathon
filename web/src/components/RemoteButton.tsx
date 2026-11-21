import type {ReactNode} from 'react';

import MaskIcon from './MaskIcon';

type RemoteButtonType = 'power' | 'refresh' | 'number';

interface RemoteButtonProps {
  type: RemoteButtonType;
  label?: string;
  className?: string;
}

const KEY_COLOR =
  'border-black/50 bg-peach-100 hover:border-black hover:bg-bg-accent active:border-black active:bg-bg-accent';

const buttonClassName: Record<RemoteButtonType, string> = {
  power:
    'h-[28px] w-[30px] border-ink-900 bg-bg-surface shadow-key-sm hover:bg-bg-accent active:bg-ink-700 active:shadow-none',
  refresh: `h-[28px] w-[31px] ${KEY_COLOR} shadow-key-sm active:shadow-none`,
  number: `flex h-[31px] w-[41px] items-center justify-center ${KEY_COLOR} shadow-key active:shadow-key-pressed`,
};

const buttonName: Record<RemoteButtonType, string | undefined> = {
  power: '전원',
  refresh: '새로고침',
  number: undefined,
};

const renderContent: Record<RemoteButtonType, (label?: string) => ReactNode> = {
  power: () => (
    <MaskIcon
      className="top-[2px] left-[3px] size-[18px]"
      iconClassName="-top-[7.1429%] -left-[7.1429%] size-[114.2857%] bg-ink-900 mask-[url(/icons/power.svg)] group-active:bg-white"
    />
  ),
  refresh: () => (
    <MaskIcon
      className="top-[3px] left-[5px] size-[14.8425px] group-active:top-[4px] group-active:left-[6px] group-active:size-[12.8635px]"
      iconClassName="-top-[7.1429%] -left-[7.1429%] size-[114.2857%] bg-black/50 mask-[url(/icons/refresh.svg)] group-hover:bg-ink-900 group-active:bg-black"
    />
  ),
  number: (label) => (
    <span className="font-press-start text-[11px] leading-none text-black/50 group-hover:text-black group-active:text-black">
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
