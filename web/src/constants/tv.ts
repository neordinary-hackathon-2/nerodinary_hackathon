export type TvScreen = 'off' | 'loading' | 'noSignal' | 'live';

/** 전원을 켜면 처음 나오는 채널. 0번(컬러바)은 숫자 키 0으로만 간다. */
export const START_CHANNEL_NUMBER = 1;

/** 0번 채널: 영상이 없는 컬러바 이스터에그. 채널 ▲▼ 순환에서 빠진다. */
export const COLOR_BAR_CHANNEL_NUMBER = 0;

/** 리모컨 볼륨 버튼 한 번에 바뀌는 플레이어 볼륨 (0~1). */
export const VOLUME_STEP = 0.1;

/** TV 전원 켜기·끄기 CRT 연출 길이. globals.css의 crt-on·crt-off 애니메이션 길이와 같다. */
export const CRT_DURATION_MS = 520;
