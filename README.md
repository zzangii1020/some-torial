# 💗 썸토리얼 (Some-torial)

**소개팅 40분 실전 시뮬레이션** — 상대가 흘린 것을 놓치지 않는 연습.

소개팅 상황극 「낯섦에서 설렘까지」를 바탕으로 만든 대화 훈련 앱입니다.
당신은 정우가 되어 지현과의 40분을 보냅니다. 20번의 선택마다 지현의 **속마음**과 **호감도**가 바뀝니다.

## 📲 앱 다운로드

| 기기 | 방법 |
|---|---|
| 🤖 **안드로이드** | [**APK 다운로드**](https://github.com/zzangii1020/some-torial/releases/latest/download/sometorial.apk) → 설치 (출처를 알 수 없는 앱 허용 필요) |
| 🍎 **iPhone** | Safari로 [**웹 앱**](https://zzangii1020.github.io/some-torial/) 접속 → 공유 버튼 → **홈 화면에 추가** |
| 💻 **PC / 기타** | [**웹 앱**](https://zzangii1020.github.io/some-torial/) 접속 → 주소창의 설치 아이콘 |

웹 앱은 설치 후 오프라인에서도 동작합니다.

## 🎮 기능

- **시뮬레이션** — 0~40분, 7개 구간, 20개의 선택지
  - **학습 모드**: 💭 남자의 머릿속(힌트) + 선택마다 코치 해설
  - **실전 모드**: 12초 제한 · 힌트 없음 · 선택지 섞임 (시간 초과 = 머리가 하얘짐)
  - 💗 여자의 속마음 · 호감도 게이지 · 4가지 엔딩 · 선택 리포트
  - 중간 저장 / 이어하기
- **⚡ 순발력 훈련** — 지현의 한 마디에 최선의 받기 고르기 (8문항)
- **📌 대화 패턴 20** — 상황극에서 배워야 할 패턴
- **🧠 말문 막힐 때 사고법 10**
- **📝 소개팅 전 암기 6줄**

## 🛠 구조

```
app/                  웹 앱 (PWA) — 빌드 없이 그대로 동작
  index.html
  styles.css
  app.js              게임 엔진
  data.js             시나리오 · 선택지 · 패턴 · 사고법 · 훈련 문항
  sw.js               오프라인 캐시
  manifest.webmanifest
.github/workflows/
  pages.yml           main에 푸시하면 GitHub Pages로 배포
  android.yml         main에 푸시하면 Capacitor로 APK 빌드 → Releases에 업로드
```

로컬 실행: `npx serve app` 후 브라우저에서 열기.

시나리오를 고치려면 `app/data.js`의 `STORY` 배열만 수정하면 됩니다.
