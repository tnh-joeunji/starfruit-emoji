// 디자인팀 세트(custom/catalog.json)의 새 이름을 published-names.txt 에 더한다.
//   npm run lock:custom
// custom 은 손으로 관리하므로 만드는 스크립트가 없다 — 항목을 더한 뒤 이것만 돌리고 npm test.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addPublishedNames } from './names.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'custom', 'catalog.json'), 'utf8'))
console.log(`새 이름 ${addPublishedNames(catalog.emojis.map((e) => e.name))}`)
