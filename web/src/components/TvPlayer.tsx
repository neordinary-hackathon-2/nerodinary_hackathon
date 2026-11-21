'use client';

import {useState} from 'react';
import Image from 'next/image';
import ReactPlayer from 'react-player';

import TvLoadingScreen from '@/components/TvLoadingScreen';

interface TvPlayerProps {
  youtubeVideoId: string;
  thumbnailUrl: string;
  /** 0~1 */
  volume: number;
  /** 삭제·비공개·임베드 불가 등으로 재생할 수 없을 때. */
  onError: (youtubeVideoId: string) => void;
}

/**
 * 영상이 바뀔 때마다 key로 새로 만들어, 플레이어가 준비될 때까지 로딩 화면을 덮어 둔다.
 * 준비된 뒤 첫 화면이 나오기 전(버퍼링)에는 유튜브가 검은 화면만 보이므로 썸네일을 덮어 둔다.
 */
const TvPlayer = ({
  youtubeVideoId,
  thumbnailUrl,
  volume,
  onError,
}: TvPlayerProps) => {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

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
        onPlaying={() => setIsPlaying(true)}
        onError={() => onError(youtubeVideoId)}
      />
      {!isReady && <TvLoadingScreen />}
      {isReady && !isPlaying && (
        // pointer-events-none: 자동재생이 막혀 멈춰 있어도 썸네일을 누르면 아래 플레이어가 눌린다.
        // unoptimized: 유튜브 썸네일(i.ytimg.com)을 서버를 거치지 않고 바로 받는다.
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          unoptimized
          className="pointer-events-none object-cover"
        />
      )}
    </>
  );
};

export default TvPlayer;
