import Image from 'next/image';

import OnAirBadge from './OnAirBadge';

interface HeaderProps {
  isLive: boolean;
}

const Header = ({isLive}: HeaderProps) => {
  return (
    <header className="flex items-start gap-4 px-5 pt-2">
      <h1>
        <Image src="/logo/logo.svg" width={90} height={47} alt="밥송국" />
      </h1>
      <div className="mt-[15px]">
        <OnAirBadge isLive={isLive} />
      </div>
    </header>
  );
};

export default Header;
