'use client';

import ChannelGuide from '@/components/ChannelGuide';
import Header from '@/components/Header';
import PixelTv from '@/components/PixelTv';
import Remote from '@/components/Remote';
import TvPlayer from '@/components/TvPlayer';
import useChannels from '@/hooks/useChannels';
import useTvRemote from '@/hooks/useTvRemote';

const HomeScreen = () => {
  const {
    isPowerOn,
    isOnboarding,
    screen,
    channelLabel,
    video,
    volume,
    isGuideOpen,
    togglePower,
    goToNextChannel,
    goToPreviousChannel,
    goToChannel,
    refreshVideo,
    volumeUp,
    volumeDown,
    skipFailedVideo,
    openGuide,
    closeGuide,
  } = useTvRemote();
  const guide = useChannels(isGuideOpen);

  const remote = (
    <Remote
      size={isOnboarding ? 'big' : 'default'}
      isPowerOn={isPowerOn}
      onClickPower={togglePower}
      onClickVolumeUp={volumeUp}
      onClickVolumeDown={volumeDown}
      onClickChannelUp={goToNextChannel}
      onClickChannelDown={goToPreviousChannel}
      onClickRefresh={refreshVideo}
      onClickGuide={openGuide}
      onClickNumber={goToChannel}
    />
  );

  return (
    <main className="mx-auto flex h-dvh w-full max-w-mobile flex-col overflow-clip *:shrink-0">
      <Header isLive={screen === 'live'} />
      {/* PC(lg)는 헤더가 페이지 왼쪽 위로 빠지므로 Figma pc 시안의 TV 위치(온보딩 117px, 그 밖 98px)에 맞춘다. */}
      <div
        className={`mt-[45px] px-5 ${isOnboarding ? 'lg:mt-[117px]' : 'lg:mt-[98px]'}`}
      >
        <PixelTv screen={screen} channelLabel={channelLabel}>
          {screen === 'live' && video && (
            <TvPlayer
              key={video.youtubeVideoId}
              youtubeVideoId={video.youtubeVideoId}
              thumbnailUrl={video.thumbnailUrl}
              volume={volume}
              onError={skipFailedVideo}
            />
          )}
        </PixelTv>
      </div>
      {isOnboarding ? (
        // Figma home/default: 처음 접속해 꺼진 TV 아래 "TURN ON !" 안내와 전원 버튼을 가리키는 화살표, 큰 리모컨.
        // 한 번 켠 뒤에는 꺼도 다시 보이지 않는다.
        <div className="mt-[37px] flex flex-col">
          <p className="ml-[43px] font-silkscreen text-[20px] leading-none font-bold text-text-muted">
            TURN ON !
          </p>
          <div
            aria-hidden
            className="mt-[11px] ml-[97px] flex w-6 flex-col items-center"
          >
            <span className="h-1 w-6 bg-text-muted" />
            <span className="h-1 w-4 bg-text-muted" />
            <span className="h-1 w-2 bg-text-muted" />
          </div>
          <div className="mt-[9px] ml-[60px]">{remote}</div>
        </div>
      ) : (
        <div className="mt-4 flex justify-center">{remote}</div>
      )}
      {isGuideOpen && (
        // Figma Channel Guide: 어두운 배경 위 편성표 카드. 카드 밖을 눌러도 닫힌다.
        // z-10: TV 화면(유튜브 iframe)보다 위에 그려야 영상까지 어둡게 덮인다.
        // fixed: PC에서도 화면 컬럼이 아닌 창 전체를 덮고, PC 시안처럼 카드를 세로 가운데에 둔다.
        <div className="fixed inset-0 z-10 flex justify-center bg-black/60 pt-[222px] backdrop-blur-[2px] lg:items-center lg:pt-0">
          <button
            type="button"
            aria-label="편성표 닫기"
            className="absolute inset-0 cursor-default"
            onClick={closeGuide}
          />
          <div className="relative h-fit">
            <ChannelGuide
              channels={guide.channels}
              isPending={guide.isPending}
              isError={guide.isError}
              onClose={closeGuide}
            />
          </div>
        </div>
      )}
    </main>
  );
};

export default HomeScreen;
