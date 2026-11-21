// 빌드 후 dist/main.js 진입점을 만든다.
//
// 레포 루트의 shared/ 를 함께 컴파일하느라 결과물이 dist/server/src/ 와 dist/shared/ 로 나뉜다.
// 실행 경로(pm2, start:prod)를 dist/main.js 로 고정해 두기 위해 실제 진입점을 불러오는 파일을 둔다.
import {writeFileSync} from 'node:fs';

writeFileSync(
  new URL('../dist/main.js', import.meta.url),
  "import './server/src/main.js';\n",
);
