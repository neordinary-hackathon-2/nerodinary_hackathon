import Link from 'next/link';

import FigmaFrame from '@/components/FigmaFrame';
import Header from '@/components/Header';
import PixelTv from '@/components/PixelTv';

const NotFoundScreen = () => {
  return (
    <FigmaFrame>
      <div className="mx-auto flex w-mobile flex-col *:shrink-0">
        <Header isLive={false} />
        <div className="mt-[45px] px-5 lg:mt-[98px]">
          <PixelTv screen="noSignal" channelLabel="CH --" />
        </div>
        <div className="mt-8 flex flex-col items-center gap-4 px-5">
          <p className="text-base font-bold text-text-primary">
            없는 채널이에요
          </p>
          <Link
            href="/"
            className="border-2 border-border-strong bg-bg-surface px-4 py-2 text-sm font-bold text-text-primary shadow-hard"
          >
            홈으로 가기
          </Link>
        </div>
      </div>
    </FigmaFrame>
  );
};

export default NotFoundScreen;
