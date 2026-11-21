import Link from 'next/link';

import Header from '@/components/Header';
import PixelTv from '@/components/PixelTv';

const NotFoundScreen = () => {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-mobile flex-col overflow-clip *:shrink-0">
      <Header isLive={false} />
      <div className="mt-[45px] px-5 lg:mt-[98px]">
        <PixelTv screen="noSignal" channelLabel="CH --" />
      </div>
      <div className="mt-8 flex flex-col items-center gap-4 px-5">
        <p className="text-base font-bold text-text-primary">없는 채널이에요</p>
        <Link
          href="/"
          className="border-2 border-border-strong bg-bg-surface px-4 py-2 text-sm font-bold text-text-primary shadow-hard"
        >
          홈으로 가기
        </Link>
      </div>
    </main>
  );
};

export default NotFoundScreen;
