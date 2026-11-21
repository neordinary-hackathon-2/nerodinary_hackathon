import {Suspense} from 'react';

import Header from '@/components/Header';
import PixelTv from '@/components/PixelTv';
import Remote from '@/components/Remote';
import TvPlayer from '@/components/TvPlayer';
import {SAMPLE_VIDEO_URL, isTvScreen} from '@/constants/tv';
import type {TvScreen} from '@/constants/tv';

interface HomeContentProps {
  screen: TvScreen;
}

const HomeContent = ({screen}: HomeContentProps) => {
  const channelLabel =
    screen === 'off' || screen === 'loading' ? 'CH -' : 'CH 1';

  return (
    <>
      <Header isLive={screen === 'live'} />
      <div className="mt-6 px-5">
        <PixelTv screen={screen} channelLabel={channelLabel}>
          {screen === 'live' && <TvPlayer src={SAMPLE_VIDEO_URL} />}
        </PixelTv>
      </div>
      <div className="mt-4 flex justify-center">
        <Remote />
      </div>
    </>
  );
};

// searchParams는 요청 시점 값이라 Suspense 안에서 읽어야 정적 셸을 프리렌더할 수 있다.
const HomeContentFromQuery = async ({
  searchParams,
}: Pick<PageProps<'/'>, 'searchParams'>) => {
  const {tv} = await searchParams;

  return <HomeContent screen={isTvScreen(tv) ? tv : 'off'} />;
};

const HomeScreen = ({searchParams}: PageProps<'/'>) => {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col bg-bg-app">
      <Suspense fallback={<HomeContent screen="off" />}>
        <HomeContentFromQuery searchParams={searchParams} />
      </Suspense>
    </main>
  );
};

export default HomeScreen;
