import {z} from 'zod';

/**
 * 웹(WebView 안) → 앱으로 보내는 메시지.
 * 웹은 `window.ReactNativeWebView?.postMessage(JSON.stringify(message))`로 보낸다.
 * 앱 밖(일반 브라우저)에서는 `window.ReactNativeWebView`가 없으므로 보내지 않는다.
 */

/** 앱이 햅틱과 효과음으로 표현하는 피드백 종류. */
export const appFeedbackSchema = z.enum([
  // 리모컨 버튼 누름 (숫자·새로고침·편성표). 햅틱 + 효과음
  'tap',
  // 리모컨 볼륨·채널 ▲▼ 누름. 효과음 없이 햅틱만
  'silentTap',
  // TV 전원 켜기
  'powerOn',
  // TV 전원 끄기
  'powerOff',
]);

export type AppFeedback = z.infer<typeof appFeedbackSchema>;

/** 리모컨 볼륨 버튼. 앱은 기기 시스템 볼륨을 한 단계 올리거나 내린다. */
export const appVolumeDirectionSchema = z.enum(['up', 'down']);

export type AppVolumeDirection = z.infer<typeof appVolumeDirectionSchema>;

export const bridgeMessageSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('feedback'), feedback: appFeedbackSchema}),
  z.object({type: z.literal('volume'), direction: appVolumeDirectionSchema}),
]);

export type BridgeMessage = z.infer<typeof bridgeMessageSchema>;
