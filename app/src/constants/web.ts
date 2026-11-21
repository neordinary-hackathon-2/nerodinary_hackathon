const webUrl = process.env.EXPO_PUBLIC_WEB_URL;

if (!webUrl) {
  throw new Error(
    'EXPO_PUBLIC_WEB_URL이 없습니다. app/.env 또는 app/.env.local에 웹 주소를 넣어 주세요.',
  );
}

/** WebView로 띄우는 밥송국 웹 주소. */
export const WEB_URL = webUrl;
