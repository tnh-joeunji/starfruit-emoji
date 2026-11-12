# starfruit-emoji

starfruit 웹(starfruit-front) · 모바일(starfruit-native)이 같이 쓰는 이모지 데이터. 그림 · 목록 · 검색어만 들어 있고 그리는 코드는 없다 — 그리는 방법은 쓰는 쪽이 정한다.

세트 두 개를 따로 관리한다.

| 폴더 | 세트 | 관리 |
|---|---|---|
| `noto/` | **기본 이모지** — Noto 1,661개(정지 SVG) | `npm run build:noto` 가 만든다. 손으로 고치지 않는다 |
| `custom/` | **디자인팀 이모지** — 움직이는 것 포함(지금 비어 있음) | 손으로 더한다(아래 "디자인팀 이모지 더하기") |
| `published-names.txt` | 두 세트에서 한 번이라도 나간 이름 전부 | 더하기만 한다. test 가 지켜본다 |

## 쓰는 법
배포 · 버전이 없다. 쓰는 쪽은 GitHub 의존성으로 받고, lockfile 이 받은 커밋을 고정한다.
```jsonc
// package.json
"starfruit-emoji": "github:tnh-joeunji/starfruit-emoji"
```
- 새 내용 받기: 쓰는 쪽에서 `pnpm update starfruit-emoji` → lockfile 커밋이 바뀐다 → 그 PR 로 확인.
- 특정 커밋으로 고정하고 싶으면 `github:tnh-joeunji/starfruit-emoji#<커밋>`.
```js
import noto from 'starfruit-emoji/noto/catalog.json'
import custom from 'starfruit-emoji/custom/catalog.json'
// 그림: node_modules/starfruit-emoji/noto/svg/<codeKey>.svg · node_modules/starfruit-emoji/custom/files/<파일>
```

## 이름 — 두 세트 공통
- 이름은 서버에 저장되는 값이다(반응 `alterText` · 본문 `{ type: "emoji", attrs: { name } }`). **한 번 나간 이름은 바꾸거나 지우지 않는다.** 그만 쓰는 이모지는 `hidden` 으로 판에서만 숨긴다 — 예전 메시지에는 계속 그려져야 한다.
- 패턴 `^[a-z0-9_]+$`. **디자인팀 이름은 `sf_` 로 시작**한다(`sf_party_cat`) — 유니코드가 나중에 같은 이름을 더해도 안 겹친다. 기본 세트는 `sf_` 로 시작하는 이름을 만들지 않는다.
- 쓰는 쪽이 모르는 이름(새 커밋을 아직 안 받은 앱)은 `:name:` 글자로 보여 준다.

## noto/catalog.json
```jsonc
{
  "schema": 1,                                    // 파일 모양이 바뀔 때만 올림
  "source": { "noto": "<커밋>", "unicode": "18.0", "cldr": "47.0.0" },
  "fields": ["name", "codeKey", "group", "subgroup"],
  "defaults": ["thumbs_up", "pray", "eyes", "question", "check", "alert"], // 메시지 메뉴 기본 6개 · 순서
  "groups": ["Smileys & Emotion", …],            // 9개, 판 카테고리 순서
  "subgroups": [{ "id": "face-smiling", "group": 0 }, …], // 96개, 그림을 나눠 받는 단위
  "emojis": [["grinning_face", "1f600", 0, 0], …] // fields 순서, 유니코드 순서
}
```
- `codeKey`: 코드포인트 소문자 16진수(4자리 이상)를 `_` 로 이음, FE0F 뺌(`2764`, `0023_20e3`, `1f469_200d_1f4bb`). 글자는 `String.fromCodePoint(...codeKey.split('_').map((h) => parseInt(h, 16)))`.
- `noto/search-ko.json`: `{ [name]: [한국어 이름, 키워드…] }`(1,644개). 없는 이모지는 영어 이름으로만 찾는다.
- 범위: Unicode `emoji-test.txt` fully-qualified 중 그룹 Component 빼고 · 피부색(1F3FB~1F3FF) 든 것 빼고 · Noto `2D/svg` 에 그림이 있는 것. 나라 국기는 Noto `2D/svg` 에 없어 빠진다.
- 이름 = CLDR 영어 이름 → 악센트 제거 · 소문자 · `&`→`and` · 따옴표 제거 · 영숫자 밖은 `_`. 덮어쓰기: `1f64f` pray · `2753` question · `2705` check · `1f6a8` alert(처음 쓰던 이름) · `0023_20e3` keycap_hash · `002a_20e3` keycap_asterisk(겹침).

## custom/catalog.json — 디자인팀 이모지
```jsonc
{
  "schema": 1,
  "emojis": [
    {
      "name": "sf_party_cat",          // sf_ 로 시작, 한 번 나가면 안 바꿈
      "file": "files/party_cat.webp",  // custom/files/ 안
      "format": "webp",                // svg · png · webp · gif · lottie
      "animated": true,                // gif · lottie 는 늘 true
      "still": "files/party_cat.png",  // animated 면 꼭 — 움직이지 않는 곳(방 목록 · 알림 · 움직임 줄이기)에 씀. svg · png · webp
      "width": 128, "height": 128,
      "ko": ["파티 고양이", "축하"],    // 첫 칸 = 판에 보이는 이름, 나머지 = 검색어
      "en": ["party cat"],             // 선택
      "hidden": false                  // 선택 — true 면 판에서만 숨김(예전 메시지엔 그려짐)
    }
  ]
}
```
### 디자인팀 이모지 더하기
1. 파일을 `custom/files/` 에 넣는다(움직이는 것은 멈춘 그림도 같이).
2. `custom/catalog.json` 에 항목을 더한다.
3. `npm run lock:custom` → `published-names.txt` 에 새 이름이 더해진다.
4. `npm test` → 커밋 · 푸시. 쓰는 쪽은 `pnpm update starfruit-emoji`.

## 기본 이모지 다시 만들기
```sh
npm install
npm run build:noto   # 고정 입력을 받아(.cache/) noto/ 를 다시 만든다. 이름 겹침 · id 겹침이면 멈춘다
npm test
```
입력을 바꿀 때는 `scripts/build-noto.mjs` 맨 위 고정 값(Noto 커밋 · 유니코드 · CLDR 버전)을 고친다. 유니코드 · CLDR 이 이름을 바꿔도 `published-names.txt` 에 있는 옛 이름이 사라지면 test 가 멈춘다 — `NAME_OVERRIDES` 로 옛 이름을 지킨다.

### SVGO 설정에서 지킬 것
- `convertTransform` 끔 — 상속 그라데이션(`xlink:href`)의 identity `gradientTransform` 을 지워 🤔 · 🫢 가 단색이 된다.
- `floatPrecision` 2 — 1 은 217개가 눈에 띄게 일그러진다. 2 에서 오류 나는 파일은 3.
- 웹에서 스프라이트로 모을 때 `display:none` 으로 숨기면 그라데이션이 빠진다(크기 0 칸으로 숨긴다).

라이선스: 기본 세트 그림 Apache 2.0(Noto) · 목록 · 한국어 Unicode License v3 · 디자인팀 세트는 회사 소유 — `THIRD_PARTY_NOTICES.md`.
