import type {ReactNode} from 'react';

import MaskIcon from './MaskIcon';

type RemoteButtonType = 'power' | 'refresh' | 'guide' | 'number';

interface RemoteButtonProps {
  type: RemoteButtonType;
  label?: string;
  className?: string;
}

const KEY_COLOR =
  'border-black/50 bg-peach-100 hover:border-black hover:bg-bg-accent active:border-black active:bg-bg-accent';

const buttonClassName: Record<RemoteButtonType, string> = {
  power:
    'h-[28px] w-[30px] border-ink-900 bg-bg-surface shadow-key-sm hover:bg-bg-accent active:translate-y-[3px] active:bg-ink-700 active:shadow-none',
  refresh: `h-[31px] w-[35px] ${KEY_COLOR} shadow-key-md active:translate-y-[3.387px] active:shadow-none`,
  guide: `h-[31px] w-[35px] ${KEY_COLOR} shadow-key-md active:translate-y-[3.387px] active:shadow-none`,
  number: `flex h-[30px] w-[40px] items-center justify-center ${KEY_COLOR} shadow-key active:translate-y-[3px] active:shadow-key-pressed`,
};

const buttonName: Record<RemoteButtonType, string | undefined> = {
  power: '전원',
  refresh: '새로고침',
  guide: '편성표',
  number: undefined,
};

const renderContent: Record<RemoteButtonType, (label?: string) => ReactNode> = {
  power: () => (
    <MaskIcon className="top-[2px] left-[3px] size-[18px] bg-ink-900 mask-[url(/icons/power.svg)] mask-size-[114.2857%] mask-center group-active:bg-white" />
  ),
  refresh: () => (
    <MaskIcon className="top-[3.77px] left-[6.03px] size-[16.758px] bg-black/50 mask-[url(/icons/refresh.svg)] mask-size-[100%_100%] group-hover:bg-ink-900 group-active:top-[4.887px] group-active:left-[7.147px] group-active:size-[14.524px] group-active:bg-black" />
  ),
  guide: () => (
    <MaskIcon className="top-[3.77px] left-[6.03px] size-[18.0645px] bg-black/50 mask-[url(/icons/list.svg)] mask-size-[100%_100%] group-hover:bg-ink-900 group-active:top-[4.974px] group-active:left-[7.234px] group-active:size-[15.656px] group-active:bg-black" />
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
