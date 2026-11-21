'use client';

import {useState} from 'react';
import ReactPlayer from 'react-player';

import TvLoadingScreen from '@/components/TvLoadingScreen';

interface TvPlayerProps {
  youtubeVideoId: string;
  /** 0~1 */
  volume: number;
  /** 삭제·비공개·임베드 불가 등으로 재생할 수 없을 때. */
  onError: (youtubeVideoId: string) => void;
}

/** 영상이 바뀔 때마다 key로 새로 만들어, 플레이어가 준비될 때까지 로딩 화면을 덮어 둔다. */
const TvPlayer = ({youtubeVideoId, volume, onError}: TvPlayerProps) => {
  const [isReady, setIsReady] = useState(false);

  return (
    <>
      <ReactPlayer
        src={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
        width="100%"
        height="100%"
        playing
        controls
        playsInline
        volume={volume}
        config={{youtube: {rel: 0}}}
        onReady={() => setIsReady(true)}
        onError={() => onError(youtubeVideoId)}
      />
      {!isReady && <TvLoadingScreen />}
    </>
  );
};

export default TvPlayer;
