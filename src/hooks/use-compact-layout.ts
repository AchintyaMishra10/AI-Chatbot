import { useWindowDimensions } from 'react-native';

export function useCompactLayout() {
  return useWindowDimensions().width < 600;
}
