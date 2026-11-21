'use client';

import ReactPlayer from 'react-player';

interface TvPlayerProps {
  src: string;
}

const TvPlayer = ({src}: TvPlayerProps) => {
  return (
    <ReactPlayer
      src={src}
      width="100%"
      height="100%"
      playing
      controls
      playsInline
      config={{youtube: {rel: 0}}}
    />
  );
};

export default TvPlayer;
