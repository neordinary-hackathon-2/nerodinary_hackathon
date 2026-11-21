import type {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';

import ThemedText from '@/components/ThemedText';
import ThemedView from '@/components/ThemedView';
import {Spacing} from '@/constants/theme';

interface HintRowProps {
  title?: string;
  hint?: ReactNode;
}

const HintRow = ({
  title = 'Try editing',
  hint = 'app/index.tsx',
}: HintRowProps) => {
  return (
    <View style={styles.stepRow}>
      <ThemedText type="small">{title}</ThemedText>
      <ThemedView type="backgroundSelected" style={styles.codeSnippet}>
        <ThemedText themeColor="textSecondary">{hint}</ThemedText>
      </ThemedView>
    </View>
  );
};

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeSnippet: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});

export default HintRow;
