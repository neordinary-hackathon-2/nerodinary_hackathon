'use client';

import {useState} from 'react';
import ReactPlayer from 'react-player';

import ColorBars from '@/components/ColorBars';

interface TvPlayerProps {
  src: string;
}

const TvPlayer = ({src}: TvPlayerProps) => {
  // 삭제·비공개·임베드 불가 등으로 재생에 실패하면 no signal 화면(컬러바)을 보여준다.
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <ColorBars />;
  }

  return (
    <ReactPlayer
      src={src}
      width="100%"
      height="100%"
      playing
      controls
      playsInline
      config={{youtube: {rel: 0}}}
      onError={() => setHasError(true)}
    />
  );
};

export default TvPlayer;
