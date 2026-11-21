import {DarkTheme, DefaultTheme, ThemeProvider} from 'expo-router';
import {useColorScheme} from 'react-native';

import * as SplashScreen from 'expo-splash-screen';

import AnimatedSplashOverlay from '@/components/AnimatedSplashOverlay';
import AppTabs from '@/components/AppTabs';

void SplashScreen.preventAutoHideAsync();

const TabLayout = () => {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
};

export default TabLayout;
