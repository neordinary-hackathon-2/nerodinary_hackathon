# 밥송국 앱

밥송국 웹을 iOS·Android 앱에서 WebView로 띄운다. 화면은 웹이 그리고, 앱은 웹에서 받은 메시지로 햅틱·효과음을 낸다.

## 실행

```bash
pnpm install
cp .env.example .env   # EXPO_PUBLIC_WEB_URL을 실행 환경에 맞게 고친다
pnpm start             # Expo Go 또는 개발 빌드에서 연다
```

- 웹 개발 서버(`web/`의 `pnpm dev`)를 먼저 켜 둔다. 주소는 `.env.example`의 주석을 따른다.
- `.env`를 바꾸면 `pnpm start --clear`로 다시 띄운다. `EXPO_PUBLIC_*` 값은 번들에 박힌다.
- WebView·햅틱·오디오는 Expo Go에 포함돼 있어 개발 빌드 없이 확인할 수 있다. 단, 스플래시는 Expo Go와 개발 빌드에서 실제와 다르게 보이므로 release 빌드에서 확인한다.

```bash
npx expo run:ios --configuration Release      # iOS 시뮬레이터 release 빌드
npx expo run:android --variant release        # Android release 빌드
```

## 구조

| 파일                            | 역할                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/screens/HomeScreen.tsx`    | 웹을 띄우는 WebView. 첫 로딩이 끝나면 스플래시를 내린다. Android 뒤로가기는 웹 기록을 따른다 |
| `src/hooks/useAppFeedback.ts`   | 피드백 종류(`tap`, `powerOn`, `powerOff`)별 햅틱·효과음                                      |
| `src/utils/bridge.ts`           | WebView 메시지(JSON 문자열)를 읽는다. 모르는 메시지는 무시한다                               |
| `src/constants/web.ts`          | 웹 주소 (`EXPO_PUBLIC_WEB_URL`)                                                              |
| `assets/sounds/`                | 효과음 (8비트 사각파, 22.05kHz mono)                                                         |
| `assets/images/splash-icon.png` | 스플래시 이미지 (Pixel TV 꺼진 상태, 1024×1024 투명 PNG)                                     |

## 웹 → 앱 메시지

메시지 형식은 [`shared/bridge/messages.ts`](../shared/bridge/messages.ts)에 있다. 웹은 앱 안에서만 보낸다.

```ts
import type {BridgeMessage} from '@shared';

const message: BridgeMessage = {type: 'feedback', feedback: 'tap'};
window.ReactNativeWebView?.postMessage(JSON.stringify(message));
```

| `feedback` | 쓰는 곳          | 햅틱 (iOS / Android)  | 효과음          |
| ---------- | ---------------- | --------------------- | --------------- |
| `tap`      | 리모컨 버튼 누름 | Light / `Virtual_Key` | `tap.wav`       |
| `powerOn`  | TV 전원 켜기     | Medium / `Toggle_On`  | `power-on.wav`  |
| `powerOff` | TV 전원 끄기     | Medium / `Toggle_Off` | `power-off.wav` |

효과음은 영상 소리와 섞여서 나고(`mixWithOthers`), 무음 모드에서도 난다. iOS는 앱 전체가 오디오 세션 하나를 쓰므로, 무음 모드에서 효과음을 끄면 WebView 영상 소리도 같이 꺼지기 때문이다.

## WebView 설정

- `allowsInlineMediaPlayback`: iOS에서 유튜브를 전체화면이 아니라 TV 화면 안에서 재생한다.
- `mediaPlaybackRequiresUserAction={false}`: 전원 버튼으로 TV를 켤 때 소리 있는 자동재생을 허용한다.
- `allowsFullscreenVideo`: Android에서 플레이어 전체화면 버튼(F6)을 쓸 수 있다.

## 앱 정보

| 항목                                   | 값                          |
| -------------------------------------- | --------------------------- |
| 이름                                   | 밥송국                      |
| iOS bundleIdentifier / Android package | `com.neordinary.bapsongguk` |
| 스플래시 배경                          | `#FFEDC5` (cream-100)       |

코드 규칙은 [CONVENTIONS.md](../CONVENTIONS.md)를 따른다. `pnpm lint`, `npx tsc --noEmit`을 통과해야 한다.
