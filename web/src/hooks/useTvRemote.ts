import {useState} from 'react';

import type {AppVolumeDirection, RandomChannelVideosDto} from '@shared';

import {
  COLOR_BAR_CHANNEL_NUMBER,
  START_CHANNEL_NUMBER,
  VOLUME_STEP,
} from '@/constants/tv';
import type {TvScreen} from '@/constants/tv';
import useRandomVideos from '@/hooks/useRandomVideos';
import {isInApp, postToApp} from '@/utils/appBridge';

type TvVideo = RandomChannelVideosDto['videos'][number];

interface TvView {
  screen: TvScreen;
  channelLabel: string;
}

const getTvView = ({
  isPowerOn,
  isPending,
  hasNoChannels,
  channelNumber,
  video,
}: {
  isPowerOn: boolean;
  isPending: boolean;
  hasNoChannels: boolean;
  channelNumber: number;
  video: TvVideo | undefined;
}): TvView => {
  // LED 표기: 꺼짐·로딩 "CH -", 에러·방송 준비 중 "CH --", 시청 중 "CH 번호" (03-flow)
  if (!isPowerOn) {
    return {screen: 'off', channelLabel: 'CH -'};
  }
  if (isPending) {
    return {screen: 'loading', channelLabel: 'CH -'};
  }
  if (hasNoChannels) {
    return {screen: 'noSignal', channelLabel: 'CH --'};
  }
  return {
    screen: video ? 'live' : 'noSignal',
    channelLabel: `CH ${channelNumber}`,
  };
};

/**
 * 리모컨으로 조작하는 TV 상태.
 * - 전원: 켜면 채널 목록·영상을 불러와 1번 채널부터, 다시 누르면 꺼짐
 * - 채널 ▲▼: 1~9번 순환 (0번 컬러바는 숫자 키 0으로만 간다)
 * - 채널별 영상: 처음 들어갈 때 랜덤으로 정하고 접속 동안 유지. 새로고침은 지금 채널 영상만 바꾼다
 * - 볼륨: 웹은 유튜브 플레이어 볼륨, 앱 안에서는 앱에 시스템 볼륨 조절을 요청한다
 */
const useTvRemote = () => {
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [channelNumber, setChannelNumber] = useState(START_CHANNEL_NUMBER);
  // 채널별로 처음 들어갈 때 뽑은 0~1 난수. 영상 목록에서의 위치를 정한다.
  const [videoPicks, setVideoPicks] = useState<Record<number, number>>({});
  // 재생에 실패한 영상(삭제·비공개·임베드 불가). 같은 채널의 다른 영상으로 넘어간다.
  const [failedVideoIds, setFailedVideoIds] = useState<
    Record<number, string[]>
  >({});
  const [volume, setVolume] = useState(1);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const {channels, isPending, isError, refetch} = useRandomVideos(isPowerOn);

  const channel = channels?.find(
    (item) => item.channelNumber === channelNumber,
  );
  const failedIds = failedVideoIds[channelNumber] ?? [];
  const availableVideos =
    channel?.videos.filter(
      (item) => !failedIds.includes(item.youtubeVideoId),
    ) ?? [];
  const pick = videoPicks[channelNumber] ?? 0;
  const videoIndex = Math.floor(pick * availableVideos.length);
  const video = availableVideos[videoIndex];

  const hasNoChannels = isError || channels?.length === 0;
  const {screen, channelLabel} = getTvView({
    isPowerOn,
    isPending,
    hasNoChannels,
    channelNumber,
    video,
  });

  const cycleChannelNumbers =
    channels
      ?.map((item) => item.channelNumber)
      .filter((number) => number !== COLOR_BAR_CHANNEL_NUMBER)
      .sort((a, b) => a - b) ?? [];

  const enterChannel = (nextChannelNumber: number) => {
    setChannelNumber(nextChannelNumber);
    setVideoPicks((prev) =>
      nextChannelNumber in prev
        ? prev
        : {...prev, [nextChannelNumber]: Math.random()},
    );
  };

  const togglePower = () => {
    if (isPowerOn) {
      setIsPowerOn(false);
      setIsGuideOpen(false);
      postToApp({type: 'feedback', feedback: 'powerOff'});
      return;
    }
    setIsPowerOn(true);
    enterChannel(START_CHANNEL_NUMBER);
    postToApp({type: 'feedback', feedback: 'powerOn'});
  };

  const moveChannel = (offset: 1 | -1) => {
    postToApp({type: 'feedback', feedback: 'tap'});
    const count = cycleChannelNumbers.length;
    if (count === 0) {
      return;
    }
    const index = cycleChannelNumbers.indexOf(channelNumber);
    // 0번처럼 순환에 없는 채널에서는 ▲가 첫 채널(1번), ▼가 마지막 채널(9번)로 간다.
    const fallbackIndex = offset === 1 ? 0 : count - 1;
    const nextIndex =
      index === -1 ? fallbackIndex : (index + offset + count) % count;
    enterChannel(cycleChannelNumbers[nextIndex]);
  };

  const goToChannel = (nextChannelNumber: number) => {
    postToApp({type: 'feedback', feedback: 'tap'});
    const exists = channels?.some(
      (item) => item.channelNumber === nextChannelNumber,
    );
    // 없는 번호는 무시하고, 지금 채널과 같은 번호는 아무 일도 하지 않는다 (02-features F3).
    if (!exists || nextChannelNumber === channelNumber) {
      return;
    }
    enterChannel(nextChannelNumber);
  };

  const refreshVideo = () => {
    postToApp({type: 'feedback', feedback: 'tap'});
    // 서버 오류 화면에서는 다시 시도한다.
    if (isError) {
      void refetch();
      return;
    }
    const count = availableVideos.length;
    // 바꿀 다른 영상이 없으면(0번 컬러바, 영상 0~1개) 그대로 둔다.
    if (count < 2) {
      return;
    }
    // 지금 영상을 뺀 나머지에서 고르고, 그 위치를 가리키는 난수로 바꿔 둔다.
    const nextIndex =
      (videoIndex + 1 + Math.floor(Math.random() * (count - 1))) % count;
    setVideoPicks((prev) => ({
      ...prev,
      [channelNumber]: (nextIndex + 0.5) / count,
    }));
  };

  const changeVolume = (direction: AppVolumeDirection) => {
    postToApp({type: 'feedback', feedback: 'tap'});
    if (isInApp()) {
      postToApp({type: 'volume', direction});
      return;
    }
    const delta = direction === 'up' ? VOLUME_STEP : -VOLUME_STEP;
    // 0.1씩 더하면 부동소수점 오차가 쌓이므로 소수 첫째 자리로 맞춘다.
    setVolume((prev) =>
      Math.min(1, Math.max(0, Number((prev + delta).toFixed(1)))),
    );
  };

  const skipFailedVideo = (youtubeVideoId: string) => {
    setFailedVideoIds((prev) => ({
      ...prev,
      [channelNumber]: [...(prev[channelNumber] ?? []), youtubeVideoId],
    }));
  };

  const openGuide = () => {
    postToApp({type: 'feedback', feedback: 'tap'});
    setIsGuideOpen(true);
  };

  const closeGuide = () => {
    postToApp({type: 'feedback', feedback: 'tap'});
    setIsGuideOpen(false);
  };

  return {
    isPowerOn,
    screen,
    channelLabel,
    video,
    volume,
    isGuideOpen,
    togglePower,
    goToNextChannel: () => moveChannel(1),
    goToPreviousChannel: () => moveChannel(-1),
    goToChannel,
    refreshVideo,
    volumeUp: () => changeVolume('up'),
    volumeDown: () => changeVolume('down'),
    skipFailedVideo,
    openGuide,
    closeGuide,
  };
};

export default useTvRemote;
