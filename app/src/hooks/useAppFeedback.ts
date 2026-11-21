import {useEffect} from 'react';
import {Platform} from 'react-native';

import type {AppFeedback} from '@shared';
import {setAudioModeAsync, useAudioPlayer} from 'expo-audio';
import type {AudioPlayer} from 'expo-audio';
import * as Haptics from 'expo-haptics';

const TAP_SOUND = require('@/assets/sounds/tap.wav');
const POWER_ON_SOUND = require('@/assets/sounds/power-on.wav');
const POWER_OFF_SOUND = require('@/assets/sounds/power-off.wav');

// Android TOGGLE_ON·TOGGLE_OFF 햅틱은 API 34(Android 14)부터 있다. 그 아래에서는 expo-haptics가 예외를 던져 진동이 나지 않으므로 LONG_PRESS로 대신한다.
const isToggleHapticSupported =
  Platform.OS === 'android' && Number(Platform.Version) >= 34;

// iOS는 Taptic Engine 강도, Android는 시스템 햅틱 상수(VIBRATE 권한 없이 동작)를 쓴다.
const HAPTICS: Record<
  AppFeedback,
  {ios: Haptics.ImpactFeedbackStyle; android: Haptics.AndroidHaptics}
> = {
  tap: {
    ios: Haptics.ImpactFeedbackStyle.Light,
    android: Haptics.AndroidHaptics.Virtual_Key,
  },
  silentTap: {
    ios: Haptics.ImpactFeedbackStyle.Light,
    android: Haptics.AndroidHaptics.Virtual_Key,
  },
  powerOn: {
    ios: Haptics.ImpactFeedbackStyle.Medium,
    android: isToggleHapticSupported
      ? Haptics.AndroidHaptics.Toggle_On
      : Haptics.AndroidHaptics.Long_Press,
  },
  powerOff: {
    ios: Haptics.ImpactFeedbackStyle.Medium,
    android: isToggleHapticSupported
      ? Haptics.AndroidHaptics.Toggle_Off
      : Haptics.AndroidHaptics.Long_Press,
  },
};

/** 웹에서 받은 피드백 종류에 맞춰 햅틱과 효과음을 낸다. */
const useAppFeedback = () => {
  const tapPlayer = useAudioPlayer(TAP_SOUND);
  const powerOnPlayer = useAudioPlayer(POWER_ON_SOUND);
  const powerOffPlayer = useAudioPlayer(POWER_OFF_SOUND);

  useEffect(() => {
    // 효과음이 WebView 영상 소리를 끊지 않도록 섞어서 재생한다.
    // iOS 오디오 세션은 앱 전체(WebView 영상 포함)가 함께 쓰므로, 무음 모드에서도 영상 소리가 나도록 켠다.
    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: true,
    });
  }, []);

  // silentTap(볼륨·채널 버튼)은 효과음 없이 햅틱만 낸다.
  const players: Record<AppFeedback, AudioPlayer | null> = {
    tap: tapPlayer,
    silentTap: null,
    powerOn: powerOnPlayer,
    powerOff: powerOffPlayer,
  };

  const playFeedback = (feedback: AppFeedback) => {
    const player = players[feedback];
    if (player) {
      void player.seekTo(0);
      player.play();
    }
    void (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(HAPTICS[feedback].android)
      : Haptics.impactAsync(HAPTICS[feedback].ios));
  };

  return playFeedback;
};

export default useAppFeedback;
