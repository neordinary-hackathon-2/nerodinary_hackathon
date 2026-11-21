import type {BridgeMessage} from '@shared';

declare global {
  interface Window {
    /** 밥송국 앱(react-native-webview) 안에서만 있는 객체. */
    ReactNativeWebView?: {postMessage: (message: string) => void};
  }
}

/** 밥송국 앱의 WebView 안에서 열렸는지. */
export const isInApp = () =>
  typeof window !== 'undefined' && window.ReactNativeWebView !== undefined;

/** 앱에 메시지를 보낸다. 일반 브라우저에서는 아무 일도 하지 않는다. */
export const postToApp = (message: BridgeMessage) => {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
};
