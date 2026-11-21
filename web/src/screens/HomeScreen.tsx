'use client';

import ChannelGuide from '@/components/ChannelGuide';
import Header from '@/components/Header';
import ModalOverlay from '@/components/ModalOverlay';
import PixelTv from '@/components/PixelTv';
import Remote from '@/components/Remote';
import TvPlayer from '@/components/TvPlayer';
import VolumeNotice from '@/components/VolumeNotice';
import useChannels from '@/hooks/useChannels';
import useFitScale from '@/hooks/useFitScale';
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
    isVolumeNoticeOpen,
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
    closeVolumeNotice,
  } = useTvRemote();
  const guide = useChannels(isGuideOpen);
  useFitScale();

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
    // items-center: 화면이 402px보다 좁으면 402px 컬럼이 양옆으로 같은 만큼 넘친 뒤 fit-scale로 줄어든다.
    <main className="mx-auto flex h-dvh w-full max-w-mobile flex-col items-center overflow-clip">
      {/* 모바일은 Figma 프레임(402x874) 그대로 그리고 화면에 맞춰 통째로 줄인다. PC(lg)는 줄이지 않는다. */}
      <div className="flex w-mobile shrink-0 origin-top flex-col *:shrink-0 max-lg:fit-scale">
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
      </div>
      {isGuideOpen && (
        <ModalOverlay closeLabel="편성표 닫기" onClose={closeGuide}>
          <ChannelGuide
            channels={guide.channels}
            isPending={guide.isPending}
            isError={guide.isError}
            onClose={closeGuide}
          />
        </ModalOverlay>
      )}
      {isVolumeNoticeOpen && (
        <ModalOverlay closeLabel="음량 안내 닫기" onClose={closeVolumeNotice}>
          <VolumeNotice onClose={closeVolumeNotice} />
        </ModalOverlay>
      )}
    </main>
  );
};

export default HomeScreen;
