import RemoteButton from './RemoteButton';
import RemoteRocker from './RemoteRocker';

const NUMBER_KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const Remote = () => {
  return (
    <div className="relative h-[476px] w-[200px] shrink-0">
      <div className="absolute top-0 left-0 h-[469px] w-[191px] overflow-hidden bg-[url(/remote/body.svg)] bg-no-repeat drop-shadow-remote">
        <div className="absolute top-[5px] left-[5px] h-[459px] w-[181px] bg-[url(/remote/body-line.svg)] bg-no-repeat" />
        <div className="absolute top-[201px] left-[26px] flex flex-col gap-2">
          {NUMBER_KEY_ROWS.map((row) => (
            <div key={row.join('')} className="flex gap-2">
              {row.map((key) => (
                <RemoteButton key={key} type="number" label={key} />
              ))}
            </div>
          ))}
        </div>
        <RemoteButton
          type="refresh"
          className="absolute top-[126px] left-[80px]"
        />
      </div>
      <div className="absolute top-[10px] left-[10px] h-14 w-[171px] bg-[url(/remote/header-band.svg)] bg-no-repeat" />
      <div className="absolute top-[18px] left-[73px] h-2 w-[46px] bg-ink-900" />
      <RemoteButton type="power" className="absolute top-[33px] left-[20px]" />
      <p className="absolute top-[37px] left-[96px] font-silkscreen text-[14px] leading-normal font-bold whitespace-nowrap text-olive-100">
        BAP-TV
      </p>
      <div className="absolute top-[69px] left-[10px] h-2.5 w-[171px] bg-[url(/remote/dither.svg)] bg-no-repeat" />
      <RemoteRocker type="volume" className="absolute top-[90px] left-[24px]" />
      <RemoteRocker
        type="channel"
        className="absolute top-[90px] left-[123px]"
      />
      <p className="absolute top-[439px] left-[57px] font-silkscreen text-[10px] leading-normal font-normal whitespace-nowrap text-butter-300">
        BAPSONGGUK
      </p>
    </div>
  );
};

export default Remote;
