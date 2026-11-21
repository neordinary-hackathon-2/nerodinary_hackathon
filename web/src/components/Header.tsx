import OnAirBadge from './OnAirBadge';

interface HeaderProps {
  isLive: boolean;
}

const Header = ({isLive}: HeaderProps) => {
  return (
    <header className="flex items-center justify-between pt-[11px] pr-[11px] pl-[19px]">
      <h1 className="font-press-start text-2xl whitespace-nowrap text-text-brand">
        BAPSONGGUK
      </h1>
      <OnAirBadge isLive={isLive} />
    </header>
  );
};

export default Header;
