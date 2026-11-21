import RemoteButton from './RemoteButton';
import RemoteRocker from './RemoteRocker';

// prettier-ignore
const NUMBER_KEYS = [
  '1', '2', '3', '4', '5', '6',
  '7', '8', '9', '*', '0', '#',
];

type RemoteSize = 'default' | 'big';

interface RemoteProps {
  size?: RemoteSize;
  /** 꺼져 있으면 전원 버튼만 누를 수 있다. */
  isPowerOn: boolean;
  onClickPower: () => void;
  onClickVolumeUp: () => void;
  onClickVolumeDown: () => void;
  onClickChannelUp: () => void;
  onClickChannelDown: () => void;
  onClickRefresh: () => void;
  onClickGuide: () => void;
  onClickNumber: (channelNumber: number) => void;
}

// big은 Figma Pixel Remote의 big size(283x678) 변형. 기본 리모컨을 283/200 배율로 키우고 숫자 키패드를 뺀다.
const sizeClassName: Record<RemoteSize, {frame: string; remote: string}> = {
  default: {frame: 'h-[476px] w-[200px]', remote: ''},
  big: {frame: 'h-[678px] w-[283px]', remote: 'origin-top-left scale-[1.415]'},
};

const Remote = ({
  size = 'default',
  isPowerOn,
  onClickPower,
  onClickVolumeUp,
  onClickVolumeDown,
  onClickChannelUp,
  onClickChannelDown,
  onClickRefresh,
  onClickGuide,
  onClickNumber,
}: RemoteProps) => {
  const isBig = size === 'big';
  const isDisabled = !isPowerOn;

  return (
    <div className={`shrink-0 ${sizeClassName[size].frame}`}>
      <div
        className={`relative h-[476px] w-[200px] ${sizeClassName[size].remote}`}
      >
        <div className="absolute top-0 left-0 h-[469px] w-[191px] overflow-hidden bg-[url(/remote/body.svg)] bg-no-repeat drop-shadow-remote">
          <div className="absolute top-[5px] left-[5px] h-[459px] w-[181px] bg-[url(/remote/body-line.svg)] bg-no-repeat" />
        </div>
        <div className="absolute top-[10px] left-[10px] h-14 w-[171px] bg-[url(/remote/header-band.svg)] bg-no-repeat" />
        <div className="absolute top-[18px] left-[73px] h-2 w-[46px] bg-ink-900" />
        <RemoteButton
          type="power"
          className="absolute top-[26px] left-[20px]"
          onClick={onClickPower}
        />
        <p className="absolute top-[37px] left-[96px] font-silkscreen text-[14px] leading-normal font-bold whitespace-nowrap text-olive-100">
          BAP-TV
        </p>
        <div className="absolute top-[69px] left-[10px] h-2.5 w-[171px] bg-[url(/remote/dither.svg)] bg-no-repeat" />
        <div className="absolute top-[90px] left-0 flex w-[191px] flex-col items-center gap-5">
          <div className="flex items-center gap-2.5">
            <RemoteRocker
              type="volume"
              disabled={isDisabled}
              onClickUp={onClickVolumeUp}
              onClickDown={onClickVolumeDown}
            />
            <div className="flex flex-col gap-3">
              <RemoteButton
                type="refresh"
                disabled={isDisabled}
                onClick={onClickRefresh}
              />
              <RemoteButton
                type="guide"
                disabled={isDisabled}
                onClick={onClickGuide}
              />
            </div>
            <RemoteRocker
              type="channel"
              disabled={isDisabled}
              onClickUp={onClickChannelUp}
              onClickDown={onClickChannelDown}
            />
          </div>
          {!isBig && (
            <div className="grid grid-cols-3 gap-2">
              {NUMBER_KEYS.map((key) => {
                const channelNumber = Number(key);
                // *·# 키는 기능이 없어 항상 비활성이다.
                const isNumber = Number.isInteger(channelNumber);
                return (
                  <RemoteButton
                    key={key}
                    type="number"
                    label={key}
                    disabled={isDisabled || !isNumber}
                    onClick={() => onClickNumber(channelNumber)}
                  />
                );
              })}
            </div>
          )}
        </div>
        <p className="absolute top-[439px] left-[57px] font-silkscreen text-[10px] leading-normal font-normal whitespace-nowrap text-butter-300">
          BAPSONGGUK
        </p>
      </div>
    </div>
  );
};

export default Remote;
