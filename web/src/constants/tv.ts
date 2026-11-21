import type {ChannelListItemDto} from '@shared';

export type TvScreen = 'off' | 'loading' | 'noSignal' | 'live';

/** 전원을 켜면 처음 나오는 채널. 0번(컬러바)은 숫자 키 0으로만 간다. */
export const START_CHANNEL_NUMBER = 1;

/** 0번 채널: 영상이 없는 컬러바 이스터에그. 채널 ▲▼ 순환에서 빠진다. */
export const COLOR_BAR_CHANNEL_NUMBER = 0;

/**
 * 0번 컬러바 채널 정보. 서버가 0번을 채널 목록·랜덤 영상 응답에서 뺐기 때문에
 * (서버 PR #59 "시딩에서 0번 제거") 클라이언트에서 고정으로 붙인다. 문구는 02-features 편성표 기준.
 */
export const COLOR_BAR_CHANNEL: ChannelListItemDto = {
  channelNumber: COLOR_BAR_CHANNEL_NUMBER,
  name: '컬러바',
  slogan: '잠시 후 방송이 시작됩니다',
};

/** 리모컨 볼륨 버튼 한 번에 바뀌는 플레이어 볼륨 (0~1). */
export const VOLUME_STEP = 0.1;
