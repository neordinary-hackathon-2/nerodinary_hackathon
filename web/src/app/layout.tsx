import type {Metadata} from 'next';
import {Press_Start_2P, Silkscreen} from 'next/font/google';

import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';

import Providers from '@/components/Providers';
import RoomBackground from '@/components/RoomBackground';

const silkscreen = Silkscreen({
  variable: '--font-next-silkscreen',
  weight: '700',
  subsets: ['latin'],
});

const pressStart2P = Press_Start_2P({
  variable: '--font-next-press-start',
  weight: '400',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '밥송국',
  description: '당신의 밥메이트 밥송국',
};

const RootLayout = ({children}: LayoutProps<'/'>) => {
  return (
    <html
      lang="en"
      className={`${silkscreen.variable} ${pressStart2P.variable} h-full antialiased`}
    >
      {/* isolate: 배경(-z-10)이 body 배경 아래로 숨지 않고 화면 콘텐츠 바로 뒤에 그려지게 한다. */}
      <body className="isolate min-h-full flex flex-col bg-bg-app text-text-primary">
        <RoomBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;
