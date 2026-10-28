import { useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';

function subscribe(onChange: () => void) {
  const subscription = Dimensions.addEventListener('change', onChange);
  return () => subscription.remove();
}

// Match the server's compact layout during hydration, then read the viewport.
const getServerSnapshot = () => true;
const getSnapshot = () => Dimensions.get('window').width < 600;

export function useCompactLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
