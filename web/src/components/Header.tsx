import Image from 'next/image';

import OnAirBadge from './OnAirBadge';

interface HeaderProps {
  isLive: boolean;
}

// PC(lg)에서는 Figma pc 시안처럼 가운데 화면 컬럼 밖, 페이지 왼쪽 위에 큰 로고로 둔다.
const Header = ({isLive}: HeaderProps) => {
  return (
    <header className="flex items-start gap-4 px-5 pt-2 lg:absolute lg:top-[52px] lg:left-20 lg:gap-8 lg:p-0">
      <h1>
        <Image
          src="/logo/logo.svg"
          width={90}
          height={47}
          alt="밥송국"
          className="lg:hidden"
        />
        <Image
          src="/logo/logo-large.svg"
          width={203}
          height={106}
          alt="밥송국"
          className="hidden lg:block"
        />
      </h1>
      <div className="mt-[15px] lg:mt-[26px]">
        <OnAirBadge isLive={isLive} />
      </div>
    </header>
  );
};

export default Header;
