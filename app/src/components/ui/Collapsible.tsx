import {type PropsWithChildren, useMemo, useState} from 'react';
import {Pressable, StyleSheet} from 'react-native';

import {SymbolView} from 'expo-symbols';
import Animated, {FadeIn} from 'react-native-reanimated';

import ThemedText from '@/components/ThemedText';
import ThemedView from '@/components/ThemedView';
import {Spacing} from '@/constants/theme';
import useTheme from '@/hooks/useTheme';

const CHEVRON_ICON_NAME = {
  ios: 'chevron.right',
  android: 'chevron_right',
  web: 'chevron_right',
} as const;

interface CollapsibleProps extends PropsWithChildren {
  title: string;
}

const Collapsible = ({children, title}: CollapsibleProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme();
  const chevronStyle = useMemo(
    () => ({transform: [{rotate: isOpen ? '-90deg' : '90deg'}]}),
    [isOpen],
  );

  const handlePress = () => setIsOpen((value) => !value);

  return (
    <ThemedView>
      <Pressable
        style={({pressed}) => [
          styles.heading,
          pressed && styles.pressedHeading,
        ]}
        onPress={handlePress}
      >
        <ThemedView type="backgroundElement" style={styles.button}>
          <SymbolView
            name={CHEVRON_ICON_NAME}
            size={14}
            weight="bold"
            tintColor={theme.text}
            style={chevronStyle}
          />
        </ThemedView>

        <ThemedText type="small">{title}</ThemedText>
      </Pressable>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(200)}>
          <ThemedView type="backgroundElement" style={styles.content}>
            {children}
          </ThemedView>
        </Animated.View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressedHeading: {
    opacity: 0.7,
  },
  button: {
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    marginLeft: Spacing.four,
    padding: Spacing.four,
  },
});

export default Collapsible;
