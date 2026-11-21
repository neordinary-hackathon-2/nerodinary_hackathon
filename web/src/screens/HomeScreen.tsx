'use client';

import Header from '@/components/Header';
import PixelTv from '@/components/PixelTv';
import Remote from '@/components/Remote';
import TvPlayer from '@/components/TvPlayer';
import useTvRemote from '@/hooks/useTvRemote';

const HomeScreen = () => {
  const {
    isPowerOn,
    screen,
    channelLabel,
    video,
    volume,
    togglePower,
    goToNextChannel,
    goToPreviousChannel,
    goToChannel,
    refreshVideo,
    volumeUp,
    volumeDown,
    skipFailedVideo,
  } = useTvRemote();

  const remote = (
    <Remote
      size={isPowerOn ? 'default' : 'big'}
      isPowerOn={isPowerOn}
      onClickPower={togglePower}
      onClickVolumeUp={volumeUp}
      onClickVolumeDown={volumeDown}
      onClickChannelUp={goToNextChannel}
      onClickChannelDown={goToPreviousChannel}
      onClickRefresh={refreshVideo}
      onClickNumber={goToChannel}
    />
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col bg-bg-app">
      <Header isLive={screen === 'live'} />
      <div className="mt-6 px-5">
        <PixelTv screen={screen} channelLabel={channelLabel}>
          {screen === 'live' && video && (
            <TvPlayer
              key={video.youtubeVideoId}
              youtubeVideoId={video.youtubeVideoId}
              volume={volume}
              onError={skipFailedVideo}
            />
          )}
        </PixelTv>
      </div>
      {isPowerOn ? (
        <div className="mt-4 flex justify-center">{remote}</div>
      ) : (
        // Figma home/default: 꺼진 TV 아래 "TURN ON !" 안내와 전원 버튼을 가리키는 화살표, 큰 리모컨.
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
      )}
    </main>
  );
};

export default HomeScreen;
