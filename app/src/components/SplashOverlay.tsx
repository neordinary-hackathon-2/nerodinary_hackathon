import {Image, StyleSheet} from 'react-native';

import * as SplashScreen from 'expo-splash-screen';
import Animated, {FadeOut} from 'react-native-reanimated';

import {BrandColors} from '@/constants/theme';

const SPLASH = require('@/assets/images/splash.png');

// splash.png는 Figma 「splash」(402×874)의 TV·로고·로딩줄을 화면 정가운데 기준 526×526dp 정사각형에 그린 그림이다.
// iOS 네이티브 스플래시(app.json imageWidth 526)와 같은 크기·자리라서 넘어갈 때 그림이 움직이지 않는다.
const SPLASH_SIZE = 526;

const EXITING = FadeOut.duration(300);

/**
 * Figma 「splash」 화면. JS가 뜨자마자 네이티브 스플래시와 같은 자리에 덮고 네이티브 스플래시를 내린다.
 * Android 네이티브 스플래시는 배경색만 쓰므로(12 이상은 아이콘을 원으로 잘라서) 이 화면부터 그림이 보인다.
 */
const SplashOverlay = () => {
  const handleLayout = () => {
    void SplashScreen.hideAsync();
  };

  return (
    <Animated.View
      style={styles.container}
      exiting={EXITING}
      onLayout={handleLayout}
    >
      <Image source={SPLASH} style={styles.image} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.peach400,
  },
  image: {
    width: SPLASH_SIZE,
    height: SPLASH_SIZE,
  },
});

export default SplashOverlay;
