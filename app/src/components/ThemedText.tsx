import {useMemo} from 'react';
import {Platform, StyleSheet, Text, type TextProps} from 'react-native';

import {Fonts, type ThemeColor} from '@/constants/theme';
import useTheme from '@/hooks/useTheme';

interface ThemedTextProps extends TextProps {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
}

const ThemedText = ({
  style,
  type = 'default',
  themeColor,
  ...rest
}: ThemedTextProps) => {
  const theme = useTheme();
  const color = theme[themeColor ?? 'text'];
  const textStyle = useMemo(
    () => [{color}, styles[type], style],
    [color, type, style],
  );

  return <Text style={textStyle} {...rest} />;
};

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({android: 700}) ?? 500,
    fontSize: 12,
  },
});

export default ThemedText;
