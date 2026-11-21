/**
 * iPhone·iPad 브라우저인지. iPadOS 13+ Safari는 데스크톱 Mac처럼 보이는 UA를 쓰므로
 * Mac UA이면서 터치가 되는 경우도 iPad로 본다.
 */
export const isIOS = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const isIPhoneOrOldIPad = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isNewIPad =
    navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1;
  return isIPhoneOrOldIPad || isNewIPad;
};
