import {Stack} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';

// SplashOverlay(Figma 스플래시 전체 화면)가 그려질 때까지 네이티브 스플래시를 유지한다. 내리는 건 SplashOverlay가 한다.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({duration: 300, fade: true});

const SCREEN_OPTIONS = {headerShown: false};

const RootLayout = () => {
  return (
    <>
      <Stack screenOptions={SCREEN_OPTIONS} />
      {/* 웹 배경이 흰색이라 상태 표시줄 아이콘을 어둡게 고정한다. */}
      <StatusBar style="dark" />
    </>
  );
};

export default RootLayout;
