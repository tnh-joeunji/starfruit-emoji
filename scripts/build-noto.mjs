// 기본 이모지(Noto) 세트 만들기 — 손으로 돌린다(쓰는 쪽 빌드 때 돌지 않음).
//   npm run build:noto
// 입력은 아래 고정 버전만 받는다. 받은 파일은 .cache/ 에 두고 다음부터 다시 받지 않는다.
// 결과: noto/svg/<codeKey>.svg · noto/catalog.json · noto/search-ko.json · published-names.txt(새 이름 더함)
// custom/(디자인팀 세트)은 건드리지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimize } from 'svgo'
import { CUSTOM_PREFIX, addPublishedNames } from './names.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'noto')
const CACHE = path.join(ROOT, '.cache')

// ---- 고정 입력 ----
export const NOTO_COMMIT = '99701e07d3d1fe1bdbcdb14964547f0fd592966f' // googlefonts/noto-emoji main, 2026-10-26
const NOTO_SVG_DIR = '2D/svg'
const EMOJI_TEST_URL = 'https://www.unicode.org/Public/18.0.0/emoji/emoji-test.txt' // Unicode Emoji 18.0
const CLDR_VERSION = '47.0.0'
const CLDR_KO_URL = `https://cdn.jsdelivr.net/npm/cldr-annotations-full@${CLDR_VERSION}/annotations/ko/annotations.json`
const CLDR_KO_DERIVED_URL = `https://cdn.jsdelivr.net/npm/cldr-annotations-derived-full@${CLDR_VERSION}/annotationsDerived/ko/annotations.json`

// ---- 이름 규칙 ----
// 기본 6개는 처음부터 쓰던 이름을 그대로 둔다(서버에 이미 저장된 값). 순서 = 메시지 메뉴 기본 순서.
export const DEFAULT_NAMES = ['thumbs_up', 'pray', 'eyes', 'question', 'check', 'alert']
const NAME_OVERRIDES = {
  '1f64f': 'pray', // folded hands
  2753: 'question', // red question mark
  2705: 'check', // check mark button
  '1f6a8': 'alert', // police car light
  '0023_20e3': 'keycap_hash', // keycap: # → keycap_ 와 겹침
  '002a_20e3': 'keycap_asterisk', // keycap: * → keycap_ 와 겹침
}
const NAME_PATTERN = /^[a-z0-9_]+$/
const SKIN_TONE = /^1F3F[B-F]$/i

export const toName = (cldrName) =>
  cldrName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'“”"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

// ---- SVGO ----
// convertTransform 끔: 상속 그라데이션(xlink:href)의 identity gradientTransform 을 지워 🤔 · 🫢 가 깨진다(실측 11-11).
// floatPrecision 2: 1 은 217개가 눈에 띄게 일그러짐. 2 에서 오류 나는 파일은 3 으로.
const svgoConfig = (codeKey, precision) => ({
  multipass: true,
  floatPrecision: precision,
  plugins: [
    { name: 'preset-default', params: { overrides: { removeViewBox: false, convertTransform: false } } },
    { name: 'prefixIds', params: { prefix: `e${codeKey}`, delim: '-' } },
    'removeDimensions',
  ],
})

async function cached(name, url) {
  const file = path.join(CACHE, name)
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const text = await res.text()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return text
}

async function notoTree() {
  const text = await cached(
    `noto-tree-${NOTO_COMMIT}.json`,
    `https://api.github.com/repos/googlefonts/noto-emoji/git/trees/${NOTO_COMMIT}?recursive=1`
  )
  const tree = JSON.parse(text)
  if (tree.truncated) throw new Error('noto tree truncated')
  const re = new RegExp(`^${NOTO_SVG_DIR}/emoji_u([0-9a-f_]+)\\.svg$`)
  return new Set(tree.tree.map((t) => t.path.match(re)?.[1]).filter(Boolean))
}

const notoSvg = (codeKey) =>
  cached(
    `noto-${NOTO_COMMIT}/emoji_u${codeKey}.svg`,
    `https://raw.githubusercontent.com/googlefonts/noto-emoji/${NOTO_COMMIT}/${NOTO_SVG_DIR}/emoji_u${codeKey}.svg`
  )

function parseEmojiTest(text, available) {
  const out = []
  let group = ''
  let subgroup = ''
  for (const line of text.split('\n')) {
    const g = line.match(/^# group: (.+)/)
    if (g) { group = g[1].trim(); continue }
    const s = line.match(/^# subgroup: (.+)/)
    if (s) { subgroup = s[1].trim(); continue }
    const m = line.match(/^([0-9A-F ]+?)\s*; fully-qualified\s*#\s*(\S+)\s+E[\d.]+\s+(.+)$/)
    if (!m || group === 'Component') continue
    const cps = m[1].trim().split(' ')
    if (cps.some((c) => SKIN_TONE.test(c))) continue // 피부색 고르기 없음
    const codeKey = cps.filter((c) => c !== 'FE0F').map((c) => c.toLowerCase()).join('_')
    if (!available.has(codeKey)) continue
    out.push({ codeKey, char: m[2], group, subgroup, cldrName: m[3].trim() })
  }
  return out
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i], i)
      }
    })
  )
  return results
}

function optimizeSvg(raw, codeKey) {
  try {
    return optimize(raw, svgoConfig(codeKey, 2)).data
  } catch {
    return optimize(raw, svgoConfig(codeKey, 3)).data
  }
}

async function main() {
  const available = await notoTree()
  const list = parseEmojiTest(await cached('emoji-test-18.0.txt', EMOJI_TEST_URL), available)

  // 이름
  const seen = new Map()
  for (const e of list) {
    e.name = NAME_OVERRIDES[e.codeKey] ?? toName(e.cldrName)
    if (!NAME_PATTERN.test(e.name)) throw new Error(`이름 패턴 위반: ${e.codeKey} ${e.name}`)
    if (e.name.startsWith(CUSTOM_PREFIX)) throw new Error(`디자인팀 접두어와 겹침: ${e.codeKey} ${e.name}`)
    if (seen.has(e.name)) throw new Error(`이름 겹침: ${e.name} (${seen.get(e.name)} · ${e.codeKey})`)
    seen.set(e.name, e.codeKey)
  }
  for (const n of DEFAULT_NAMES) if (!seen.has(n)) throw new Error(`기본 이름 없음: ${n}`)

  // 그림
  const svgDir = path.join(OUT, 'svg')
  fs.rmSync(svgDir, { recursive: true, force: true })
  fs.mkdirSync(svgDir, { recursive: true })
  const ids = new Map()
  await mapLimit(list, 16, async (e) => {
    const out = optimizeSvg(await notoSvg(e.codeKey), e.codeKey)
    if (/display\s*:\s*none/.test(out)) throw new Error(`display:none: ${e.codeKey}`)
    for (const [, id] of out.matchAll(/\sid="([^"]+)"/g)) {
      if (ids.has(id)) throw new Error(`id 겹침: ${id} (${ids.get(id)} · ${e.codeKey})`)
      ids.set(id, e.codeKey)
    }
    fs.writeFileSync(path.join(svgDir, `${e.codeKey}.svg`), out + '\n')
  })

  // 목록
  const groups = [...new Set(list.map((e) => e.group))]
  const subgroups = []
  for (const e of list) if (!subgroups.some((s) => s.id === e.subgroup)) subgroups.push({ id: e.subgroup, group: groups.indexOf(e.group) })
  const catalog = {
    schema: 1, // 이 파일 모양이 바뀔 때만 올린다(쓰는 쪽 읽는 코드가 따라 바뀜)
    source: { noto: NOTO_COMMIT, unicode: '18.0', cldr: CLDR_VERSION },
    fields: ['name', 'codeKey', 'group', 'subgroup'],
    defaults: DEFAULT_NAMES,
    groups,
    subgroups,
    emojis: list.map((e) => [e.name, e.codeKey, groups.indexOf(e.group), subgroups.findIndex((s) => s.id === e.subgroup)]),
  }
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog) + '\n')

  // 한국어 검색
  const ko = JSON.parse(await cached(`cldr-${CLDR_VERSION}-ko.json`, CLDR_KO_URL)).annotations.annotations
  const koDerived = JSON.parse(await cached(`cldr-${CLDR_VERSION}-ko-derived.json`, CLDR_KO_DERIVED_URL)).annotationsDerived.annotations
  const search = {}
  for (const e of list) {
    const bare = e.char.replace(/\uFE0F/g, '')
    const a = ko[e.char] ?? ko[bare] ?? koDerived[e.char] ?? koDerived[bare]
    if (!a) continue
    const tts = a.tts?.[0]
    const words = [...new Set([tts, ...(a.default ?? [])].filter(Boolean))]
    if (words.length) search[e.name] = words
  }
  fs.writeFileSync(path.join(OUT, 'search-ko.json'), JSON.stringify(search) + '\n')

  // 한 번 나간 이름 목록에 새 이름을 더한다(빼지는 않는다)
  const added = addPublishedNames(list.map((e) => e.name))

  console.log(`이모지 ${list.length} · 묶음 ${subgroups.length} · 한국어 ${Object.keys(search).length} · 새 이름 ${added}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
