import OnAirBadge from './OnAirBadge';

interface HeaderProps {
  isLive: boolean;
}

const Header = ({isLive}: HeaderProps) => {
  return (
    <header className="flex flex-col items-start gap-2 px-5 pt-2">
      <h1 className="font-press-start text-[28px] leading-[28px] whitespace-nowrap text-text-brand">
        BAPSONGGUK
      </h1>
      <OnAirBadge isLive={isLive} />
    </header>
  );
};

export default Header;
