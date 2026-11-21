import {Suspense} from 'react';

import ChannelGuide from '@/components/ChannelGuide';
import Header from '@/components/Header';
import PixelTv from '@/components/PixelTv';
import Remote from '@/components/Remote';
import TvPlayer from '@/components/TvPlayer';
import {SAMPLE_VIDEO_URL, isTvScreen} from '@/constants/tv';
import type {TvScreen} from '@/constants/tv';

// 서버 채널 목록 API 연결 전까지 편성표에 보여줄 샘플 (기획 02-features 채널 편성표 기준)
const SAMPLE_CHANNELS = [
  {number: 0, name: '컬러바'},
  {number: 1, name: '예능'},
  {number: 2, name: '금융'},
  {number: 3, name: '뉴스'},
  {number: 4, name: '먹방'},
  {number: 5, name: '요리'},
  {number: 6, name: '동물'},
  {number: 7, name: '음악'},
  {number: 8, name: '스포츠'},
  {number: 9, name: '홈쇼핑'},
];

interface HomeContentProps {
  screen: TvScreen;
  isGuideOpen: boolean;
}

const HomeContent = ({screen, isGuideOpen}: HomeContentProps) => {
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
      {isGuideOpen && (
        <div className="absolute inset-0 flex justify-center bg-black/60 pt-[222px] backdrop-blur-[2px]">
          <ChannelGuide channels={SAMPLE_CHANNELS} />
        </div>
      )}
    </>
  );
};

// searchParams는 요청 시점 값이라 Suspense 안에서 읽어야 정적 셸을 프리렌더할 수 있다.
const HomeContentFromQuery = async ({
  searchParams,
}: Pick<PageProps<'/'>, 'searchParams'>) => {
  const {tv, guide} = await searchParams;

  return (
    <HomeContent
      screen={isTvScreen(tv) ? tv : 'off'}
      isGuideOpen={guide !== undefined}
    />
  );
};

const HomeScreen = ({searchParams}: PageProps<'/'>) => {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-mobile flex-col bg-bg-app">
      <Suspense fallback={<HomeContent screen="off" isGuideOpen={false} />}>
        <HomeContentFromQuery searchParams={searchParams} />
      </Suspense>
    </main>
  );
};

export default HomeScreen;
