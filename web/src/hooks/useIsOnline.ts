import {useSyncExternalStore} from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/** 기기가 네트워크에 연결돼 있는지. 서버 렌더링 때는 연결된 것으로 본다. */
const useIsOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

export default useIsOnline;
