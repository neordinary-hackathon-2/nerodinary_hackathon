import {Colors} from '@/constants/theme';
import useColorScheme from '@/hooks/useColorScheme';

const useTheme = () => {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
};

export default useTheme;
