// 결과 파일 검사 — npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CUSTOM_PREFIX, readPublishedNames } from '../scripts/names.mjs'
import { validateCustomCatalog } from '../scripts/custom-schema.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const catalog = read('noto/catalog.json')
const search = read('noto/search-ko.json')
const custom = read('custom/catalog.json')
const svgFiles = fs.readdirSync(path.join(ROOT, 'noto/svg')).filter((f) => f.endsWith('.svg'))
const emojis = catalog.emojis.map(([name, codeKey, group, subgroup]) => ({ name, codeKey, group, subgroup }))
const notoNames = new Set(emojis.map((e) => e.name))

// ---- 기본 세트(noto) ----
test('noto: 목록 수 = svg 파일 수, 빠짐 · 남음 없음', () => {
  assert.equal(emojis.length, 1661)
  assert.deepEqual(new Set(svgFiles), new Set(emojis.map((e) => `${e.codeKey}.svg`)))
})

test('noto: 이름 겹침 없음 · 패턴 · 디자인팀 접두어 안 씀', () => {
  assert.equal(notoNames.size, emojis.length)
  for (const n of notoNames) {
    assert.match(n, /^[a-z0-9_]+$/)
    assert.ok(!n.startsWith(CUSTOM_PREFIX), n)
  }
})

test('noto: 기본 6개 이름 · 코드 · 순서', () => {
  assert.deepEqual(catalog.defaults, ['thumbs_up', 'pray', 'eyes', 'question', 'check', 'alert'])
  const code = Object.fromEntries(emojis.map((e) => [e.name, e.codeKey]))
  assert.deepEqual(catalog.defaults.map((n) => code[n]), ['1f44d', '1f64f', '1f440', '2753', '2705', '1f6a8'])
})

test('noto: keycap # · * 이름', () => {
  const code = Object.fromEntries(emojis.map((e) => [e.name, e.codeKey]))
  assert.equal(code.keycap_hash, '0023_20e3')
  assert.equal(code.keycap_asterisk, '002a_20e3')
})

test('noto: 그룹 · 묶음 색인이 범위 안', () => {
  assert.equal(catalog.groups.length, 9)
  assert.equal(catalog.subgroups.length, 96)
  for (const e of emojis) {
    assert.ok(catalog.groups[e.group] !== undefined, e.name)
    assert.equal(catalog.subgroups[e.subgroup].group, e.group, e.name)
  }
})

test('noto: svg 를 한 문서에 모아도 id 가 안 겹침 · display:none 없음 · viewBox 있음', () => {
  const ids = new Set()
  for (const f of svgFiles) {
    const s = fs.readFileSync(path.join(ROOT, 'noto/svg', f), 'utf8')
    assert.match(s, /^<svg[^>]*\sviewBox="/, f)
    assert.doesNotMatch(s, /display\s*:\s*none/, f)
    for (const [, id] of s.matchAll(/\sid="([^"]+)"/g)) {
      assert.ok(!ids.has(id), `${f} ${id}`)
      ids.add(id)
    }
  }
})

test('noto: 한국어 검색은 목록 이름만 · 글자 배열', () => {
  for (const [n, words] of Object.entries(search)) {
    assert.ok(notoNames.has(n), n)
    assert.ok(words.length > 0 && words.every((w) => typeof w === 'string' && w), n)
  }
  assert.ok(Object.keys(search).length >= 1600)
  assert.ok(search.party_popper.some((w) => w.includes('축하')))
})

// ---- 디자인팀 세트(custom) ----
test('custom: 항목 규칙', () => {
  assert.deepEqual(validateCustomCatalog(custom, path.join(ROOT, 'custom'), notoNames), [])
})

test('custom 검사기: 맞는 항목은 통과 · 틀린 항목은 걸림', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-emoji-'))
  fs.mkdirSync(path.join(dir, 'files'))
  for (const f of ['cat.webp', 'cat.png']) fs.writeFileSync(path.join(dir, 'files', f), '')
  const good = { name: 'sf_party_cat', file: 'files/cat.webp', format: 'webp', animated: true, still: 'files/cat.png', width: 128, height: 128, ko: ['파티 고양이', '축하'] }
  assert.deepEqual(validateCustomCatalog({ emojis: [good] }, dir, notoNames), [])
  const bad = [
    { ...good, name: 'party_cat' }, // 접두어 없음
    { ...good, name: 'sf_thumbs_up', still: undefined }, // still 없음
    { ...good, format: 'gif', animated: false }, // gif 인데 안 움직임
    { ...good, file: 'files/none.webp' }, // 파일 없음
    { ...good, ko: [] }, // 한국어 이름 없음
  ]
  for (const b of bad) assert.notDeepEqual(validateCustomCatalog({ emojis: [b] }, dir, notoNames), [], JSON.stringify(b))
  assert.ok(validateCustomCatalog({ emojis: [good, good] }, dir, notoNames).some((e) => e.includes('겹침')))
  assert.ok(validateCustomCatalog({ emojis: [{ ...good, name: 'sf_x' }] }, dir, new Set(['sf_x'])).some((e) => e.includes('기본 세트')))
})

// ---- 두 세트 같이 ----
test('두 세트 이름이 안 겹침', () => {
  for (const e of custom.emojis) assert.ok(!notoNames.has(e.name), e.name)
})

test('한 번 나간 이름은 지금도 있음(published-names.txt) · 지금 이름은 모두 목록에 올라 있음', () => {
  const published = readPublishedNames()
  const now = new Set([...notoNames, ...custom.emojis.map((e) => e.name)])
  for (const n of published) assert.ok(now.has(n), `사라진 이름: ${n} — 지우지 말고 hidden 으로`)
  const pub = new Set(published)
  for (const n of now) assert.ok(pub.has(n), `목록에 안 오른 이름: ${n} — npm run build:noto 또는 npm run lock:custom`)
})
