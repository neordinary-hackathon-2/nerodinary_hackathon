import type {AppFeedback, BridgeMessage} from '@shared';

// shared의 appFeedbackSchema 값 목록. 값이 추가·삭제되면 Record 타입 검사에서 컴파일 오류가 난다.
const APP_FEEDBACKS: Record<AppFeedback, true> = {
  tap: true,
  powerOn: true,
  powerOff: true,
};

const isAppFeedback = (value: unknown): value is AppFeedback =>
  typeof value === 'string' && Object.keys(APP_FEEDBACKS).includes(value);

/** WebView onMessage의 data(JSON 문자열)를 메시지로 읽는다. 형식이 맞지 않으면 null. */
export const parseBridgeMessage = (data: string): BridgeMessage | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'type' in parsed &&
    parsed.type === 'feedback' &&
    'feedback' in parsed &&
    isAppFeedback(parsed.feedback)
  ) {
    return {type: 'feedback', feedback: parsed.feedback};
  }

  return null;
};
