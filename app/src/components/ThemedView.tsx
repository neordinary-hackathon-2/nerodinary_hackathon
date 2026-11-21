import {useMemo} from 'react';
import {View, type ViewProps} from 'react-native';

import {type ThemeColor} from '@/constants/theme';
import useTheme from '@/hooks/useTheme';

interface ThemedViewProps extends ViewProps {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
}

const ThemedView = ({
  style,
  lightColor: _lightColor,
  darkColor: _darkColor,
  type,
  ...otherProps
}: ThemedViewProps) => {
  const theme = useTheme();
  const backgroundColor = theme[type ?? 'background'];
  const viewStyle = useMemo(
    () => [{backgroundColor}, style],
    [backgroundColor, style],
  );

  return <View style={viewStyle} {...otherProps} />;
};

export default ThemedView;
