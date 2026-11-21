# 밥송국 앱

밥송국 웹을 iOS·Android 앱에서 WebView로 띄운다. 화면은 웹이 그리고, 앱은 웹에서 받은 메시지로 햅틱·효과음을 내고 기기 미디어 볼륨을 조절한다.

## 실행

```bash
pnpm install
pnpm android   # npx expo run:android, 연결된 기기·에뮬레이터에 개발 빌드
pnpm ios       # npx expo run:ios
```

- 기본으로 배포된 웹(`https://bapsongguk-tv.vercel.app`)을 띄운다. 로컬 웹 개발 서버(`web/`의 `pnpm dev`)를 보려면 `.env.example`을 `.env`로 복사하고 `EXPO_PUBLIC_WEB_URL`을 고친 뒤 `pnpm start --clear`로 다시 띄운다. `EXPO_PUBLIC_*` 값은 번들에 박힌다.
- 볼륨 조절은 로컬 네이티브 모듈(`modules/system-volume`)을 쓰므로 **Expo Go에서는 동작하지 않는다.** 개발 빌드나 release 빌드로 확인한다.
- 스플래시는 개발 빌드에서 실제와 다르게 보이므로 release 빌드에서 확인한다.

```bash
npx expo run:ios --configuration Release      # iOS 시뮬레이터 release 빌드
npx expo run:android --variant release        # Android release 빌드
```

## 구조

| 파일                               | 역할                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/screens/HomeScreen.tsx`       | 웹을 띄우는 WebView. 첫 로딩이 끝날 때까지 스플래시를 덮어 둔다. Android 뒤로가기는 웹 기록을 따른다  |
| `src/components/SplashOverlay.tsx` | Figma 「splash」 전체 화면. 네이티브 스플래시를 이어받아 웹 첫 로딩이 끝나면 사라진다                 |
| `src/hooks/useAppFeedback.ts`      | 피드백 종류(`tap`, `powerOn`, `powerOff`)별 햅틱·효과음                                               |
| `src/utils/bridge.ts`              | WebView 메시지(JSON 문자열)를 읽는다. 모르는 메시지는 무시한다                                        |
| `src/constants/web.ts`             | 웹 주소. 기본은 배포 주소, `EXPO_PUBLIC_WEB_URL`이 있으면 그 주소                                     |
| `modules/system-volume/`           | 기기 미디어 볼륨을 한 단계 올리고 내리는 로컬 Expo 모듈 (Android `AudioManager`, iOS `MPVolumeView`)  |
| `assets/sounds/`                   | 효과음 (8비트 사각파, 22.05kHz mono)                                                                  |
| `assets/images/splash-*.png`       | 스플래시 이미지. Figma 「splash」를 5배로 잘라 배경(`#FABD7E`)을 투명하게 뺀 PNG (로고·로딩줄·저작권) |

## 웹 → 앱 메시지

메시지 형식은 [`shared/bridge/messages.ts`](../shared/bridge/messages.ts)에 있다. 웹은 앱 안에서만 보낸다.

```ts
import type {BridgeMessage} from '@shared';

const message: BridgeMessage = {type: 'feedback', feedback: 'tap'};
window.ReactNativeWebView?.postMessage(JSON.stringify(message));
```

| `feedback`  | 쓰는 곳                                           | 햅틱 (iOS / Android)  | 효과음          |
| ----------- | ------------------------------------------------- | --------------------- | --------------- |
| `tap`       | 리모컨 버튼 누름 (숫자·새로고침·편성표 열고 닫기) | Light / `Virtual_Key` | `tap.wav`       |
| `silentTap` | 리모컨 볼륨 +/−, 채널 ▲/▼ 누름                    | Light / `Virtual_Key` | 없음            |
| `powerOn`   | TV 전원 켜기                                      | Medium / `Toggle_On`  | `power-on.wav`  |
| `powerOff`  | TV 전원 끄기                                      | Medium / `Toggle_Off` | `power-off.wav` |

Android `Toggle_On`·`Toggle_Off`는 Android 14(API 34)부터 있어서, 그 아래 버전에서는 전원 햅틱을 `Long_Press`로 낸다. Android 햅틱은 시스템 터치 진동 설정을 따르므로 무음 모드나 터치 진동을 끈 기기에서는 진동이 나지 않는다.

효과음은 영상 소리와 섞여서 나고(`mixWithOthers`), 무음 모드에서도 난다. iOS는 앱 전체가 오디오 세션 하나를 쓰므로, 무음 모드에서 효과음을 끄면 WebView 영상 소리도 같이 꺼지기 때문이다.

`{type: 'volume', direction: 'up' | 'down'}`을 받으면 기기 미디어 볼륨을 한 칸 움직이고 시스템 볼륨 UI를 띄운다. iOS WebView는 웹에서 영상 소리 크기를 바꿀 수 없어서, 웹은 앱 안에서는 자체 볼륨 대신 이 메시지를 보낸다.

## 스플래시

네이티브 스플래시는 가운데 이미지 한 장만 그릴 수 있어서 두 단계로 보여 준다.

1. 네이티브 스플래시: 배경 `#FABD7E`. iOS는 가운데에 Figma와 같은 크기(206dp)의 로고(`splash-logo.png`)를 그린다.
2. JS가 뜨면 `SplashOverlay`가 Figma 시안 전체(로고·로딩줄·저작권)를 같은 자리에 덮고 네이티브 스플래시를 내린다. 웹 첫 로딩이 끝나면 페이드아웃한다.

Android 12 이상은 스플래시 아이콘을 지름 192dp 원으로 자른다. 로고를 원에 맞춰 줄이면 `SplashOverlay`의 실제 크기 로고와 겹쳐 보이므로, Android 네이티브 스플래시는 배경색만 쓰고 로고는 `SplashOverlay`부터 보여 준다.

## WebView 설정

- `allowsInlineMediaPlayback`: iOS에서 유튜브를 전체화면이 아니라 TV 화면 안에서 재생한다.
- `mediaPlaybackRequiresUserAction={false}`: 전원 버튼으로 TV를 켤 때 소리 있는 자동재생을 허용한다.
- `allowsFullscreenVideo`: Android에서 플레이어 전체화면 버튼(F6)을 쓸 수 있다.

## 앱 정보

| 항목                                   | 값                          |
| -------------------------------------- | --------------------------- |
| 이름                                   | 밥송국                      |
| iOS bundleIdentifier / Android package | `com.neordinary.bapsongguk` |
| 스플래시 배경                          | `#FABD7E` (peach-400)       |

코드 규칙은 [CONVENTIONS.md](../CONVENTIONS.md)를 따른다. `pnpm lint`, `npx tsc --noEmit`을 통과해야 한다.
