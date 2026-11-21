import {useEffect, useRef, useState} from 'react';
import {BackHandler, Platform, StyleSheet} from 'react-native';

import * as SplashScreen from 'expo-splash-screen';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Edge} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';

import {Colors} from '@/constants/theme';
import {WEB_URL} from '@/constants/web';
import useAppFeedback from '@/hooks/useAppFeedback';
import {parseBridgeMessage} from '@/utils/bridge';

const WEB_SOURCE = {uri: WEB_URL};
const SAFE_AREA_EDGES: Edge[] = ['top', 'bottom'];

// react-native-webview 14의 WebView 클래스 타입은 추가 props 매개변수 P의 기본값이 undefined라서
// props 타입이 `WebViewProps & undefined` = never가 된다. 아래 ref와 JSX에서 P를 object로 지정한다.
const HomeScreen = () => {
  const webViewRef = useRef<WebView<object>>(null);
  const hasLoadedRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const playFeedback = useAppFeedback();

  // Android 뒤로가기: 웹 안에서 이동한 기록이 있으면 웹에서 뒤로 가고, 없으면 앱 기본 동작(종료)을 따른다.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!canGoBack) {
          return false;
        }
        webViewRef.current?.goBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [canGoBack]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = parseBridgeMessage(event.nativeEvent.data);
    if (message?.type === 'feedback') {
      playFeedback(message.feedback);
    }
  };

  const handleNavigationStateChange = (navigation: WebViewNavigation) => {
    setCanGoBack(navigation.canGoBack);
  };

  // 첫 페이지 로딩이 끝나면(성공·실패 모두) 스플래시를 내린다. 흰 화면 없이 스플래시에서 웹으로 넘어간다.
  const handleLoadEnd = () => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    void SplashScreen.hideAsync();
  };

  return (
    <SafeAreaView style={styles.container} edges={SAFE_AREA_EDGES}>
      <WebView<object>
        ref={webViewRef}
        source={WEB_SOURCE}
        style={styles.webView}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadEnd={handleLoadEnd}
        // iOS: 유튜브를 전체화면으로 띄우지 않고 TV 화면 안에서 재생한다.
        allowsInlineMediaPlayback
        // 전원 버튼으로 TV를 켤 때 소리 있는 자동재생을 허용한다.
        mediaPlaybackRequiresUserAction={false}
        // Android: 플레이어 전체화면 버튼(F6)을 쓸 수 있게 한다.
        allowsFullscreenVideo
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  webView: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});

export default HomeScreen;
