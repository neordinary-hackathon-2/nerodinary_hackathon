import OnAirBadge from './OnAirBadge';

interface HeaderProps {
  isLive: boolean;
}

const Header = ({isLive}: HeaderProps) => {
  return (
    <header className="flex items-center justify-between pt-[11px] pr-[11px] pl-[19px]">
      <h1 className="font-silkscreen text-[32px] font-bold whitespace-nowrap text-text-brand">
        BAPSONGGUK
      </h1>
      <OnAirBadge isLive={isLive} />
    </header>
  );
};

export default Header;
