import {z} from 'zod';

/**
 * 웹(WebView 안) → 앱으로 보내는 메시지.
 * 웹은 `window.ReactNativeWebView?.postMessage(JSON.stringify(message))`로 보낸다.
 * 앱 밖(일반 브라우저)에서는 `window.ReactNativeWebView`가 없으므로 보내지 않는다.
 */

/** 앱이 햅틱과 효과음으로 함께 표현하는 피드백 종류. */
export const appFeedbackSchema = z.enum([
  // 리모컨 버튼 누름 (숫자·채널·볼륨·새로고침)
  'tap',
  // TV 전원 켜기
  'powerOn',
  // TV 전원 끄기
  'powerOff',
]);

export type AppFeedback = z.infer<typeof appFeedbackSchema>;

export const bridgeMessageSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('feedback'), feedback: appFeedbackSchema}),
]);

export type BridgeMessage = z.infer<typeof bridgeMessageSchema>;
