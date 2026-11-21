# S1 TV 전원 켜기/끄기 프로토타입

Figma 「밥송국」 S1 로딩(node `64:3768`) 기준 바닐라 HTML/CSS/JS 프로토타입. 로티 없이 CSS 애니메이션 1회 재생.

실행: `python3 -m http.server 8765` 후 http://localhost:8765/ (폰트는 CDN, 인터넷 필요)

## 상태
`off → powering-on → loading → live → powering-off → off` ([app.js](app.js))

## 이식 시 참고
- CRT 켜기/끄기: `style.css`의 `crt-on`/`crt-off` 키프레임 (`steps(9)`, 0.52s, `forwards`로 1회 재생)
- 에셋: Figma에서 내려받은 SVG ([assets/](assets/))
- Next.js `web/`으로 옮길 때는 `style` 속성 금지 규칙(CONVENTIONS 11.1)에 맞춰 Tailwind로 변환 필요

## 확인 필요 (Figma에 없어 임의 결정)
- TV 꺼짐 화면(검은 화면 `#14130d`)과 "전원 버튼을 눌러 TV를 켜세요" 문구 위치
- 채널 LED: 시안 "CH --" vs 기획서 로딩 중 "CH -"
- 로딩 2.8초, CRT 0.52초는 임시값
