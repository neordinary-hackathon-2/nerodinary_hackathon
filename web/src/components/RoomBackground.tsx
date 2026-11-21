import {getImageProps} from 'next/image';

// 첫 화면부터 보이는 배경이라 지연 로딩하지 않는다.
const commonImageProps = {alt: '', sizes: '100vw', loading: 'eager'} as const;

// Figma BG/room: 화면 전체를 덮는 방 일러스트(불투명도 30%) 위에 위쪽이 진한 그라데이션.
// 모바일·PC 그림이 달라 <picture>로 화면 폭에 맞는 그림을 고른다 (Next Image 문서의 Art Direction).
const RoomBackground = () => {
  const {
    props: {srcSet: largeSrcSet},
  } = getImageProps({
    ...commonImageProps,
    src: '/room/room-pc.png',
    width: 1536,
    height: 1024,
  });
  const {
    props: {srcSet: mobileSrcSet, ...imageProps},
  } = getImageProps({
    ...commonImageProps,
    src: '/room/room-mobile.png',
    width: 864,
    height: 1536,
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <picture>
        <source media="(min-width: 64rem)" srcSet={largeSrcSet} />
        <img
          {...imageProps}
          srcSet={mobileSrcSet}
          className="size-full object-cover opacity-30"
        />
      </picture>
      <div className="absolute inset-0 bg-linear-to-b from-room-shade to-transparent" />
    </div>
  );
};

export default RoomBackground;
