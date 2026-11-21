const DEPLOYED_WEB_URL = 'https://bapsongguk-tv.vercel.app';

/** WebView로 띄우는 밥송국 웹 주소. 로컬 웹 개발 서버를 띄울 때만 EXPO_PUBLIC_WEB_URL로 바꾼다. */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || DEPLOYED_WEB_URL;
