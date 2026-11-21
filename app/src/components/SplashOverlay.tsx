import {Image, StyleSheet} from 'react-native';

import * as SplashScreen from 'expo-splash-screen';
import Animated, {FadeOut} from 'react-native-reanimated';

import {BrandColors} from '@/constants/theme';

const LOGO = require('@/assets/images/splash-logo.png');
const LOADING = require('@/assets/images/splash-loading.png');
const COPYRIGHT = require('@/assets/images/splash-copyright.png');

const EXITING = FadeOut.duration(300);

/**
 * Figma 「splash」 화면. 네이티브 스플래시는 가운데 로고 한 장만 그릴 수 있어서,
 * JS가 뜨자마자 같은 자리에 전체 시안을 덮고 네이티브 스플래시를 내린다. 웹 첫 로딩이 끝나면 사라진다.
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
      <Image source={LOGO} style={styles.logo} />
      <Image source={LOADING} style={styles.loading} />
      <Image source={COPYRIGHT} style={styles.copyright} />
    </Animated.View>
  );
};

// 크기·위치는 Figma 「splash」(402×874) 기준. 로고는 네이티브 스플래시와 같이 화면 정가운데에 둔다.
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.peach400,
  },
  logo: {
    width: 206.4,
    height: 136.4,
  },
  loading: {
    position: 'absolute',
    top: '50%',
    marginTop: 214,
    width: 187.2,
    height: 30.2,
  },
  copyright: {
    position: 'absolute',
    bottom: 73,
    width: 86.4,
    height: 8.4,
  },
});

export default SplashOverlay;
