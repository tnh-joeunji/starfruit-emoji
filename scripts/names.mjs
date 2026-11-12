// 이름 규칙 — 두 세트(noto · custom)가 같이 지킨다.
// 서버에는 이름만 저장되므로(반응 alterText · 본문 { type: "emoji", attrs: { name } }) 한 번 나간 이름은
// 바꾸거나 지우지 않는다. published-names.txt 가 그 목록이고 test 가 지켜본다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const PUBLISHED_NAMES_FILE = path.join(ROOT, 'published-names.txt')

/** 디자인팀 세트 이름 접두어 — 유니코드가 나중에 같은 이름의 이모지를 더해도 겹치지 않게 한다 */
export const CUSTOM_PREFIX = 'sf_'
export const NAME_PATTERN = /^[a-z0-9_]+$/
export const CUSTOM_NAME_PATTERN = /^sf_[a-z0-9_]+$/

export const readPublishedNames = () =>
  fs.existsSync(PUBLISHED_NAMES_FILE)
    ? fs.readFileSync(PUBLISHED_NAMES_FILE, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    : []

/** 새 이름만 더한다(지우지 않음). 더한 수를 돌려준다 */
export function addPublishedNames(names) {
  const current = readPublishedNames()
  const set = new Set(current)
  const added = names.filter((n) => !set.has(n))
  if (added.length) fs.writeFileSync(PUBLISHED_NAMES_FILE, [...current, ...added].join('\n') + '\n')
  return added.length
}
