// 디자인팀 세트(custom/catalog.json) 항목 검사 — test 와 쓰는 쪽 확인용.
import fs from 'node:fs'
import path from 'node:path'
import { CUSTOM_NAME_PATTERN } from './names.mjs'

export const CUSTOM_FORMATS = ['svg', 'png', 'webp', 'gif', 'lottie']
/** 늘 움직이는 형식 — still(멈춘 그림)이 꼭 있어야 한다 */
const ALWAYS_ANIMATED = ['gif', 'lottie']
const STILL_FORMATS = ['svg', 'png', 'webp']

/**
 * @param {{ emojis: any[] }} catalog
 * @param {string} customDir  custom/ 폴더 절대 경로
 * @param {Set<string>} otherNames  다른 세트(noto) 이름
 * @returns {string[]} 오류 목록(비면 통과)
 */
export function validateCustomCatalog(catalog, customDir, otherNames = new Set()) {
  const errors = []
  const seen = new Set()
  if (!Array.isArray(catalog?.emojis)) return ['emojis 배열 없음']
  for (const [i, e] of catalog.emojis.entries()) {
    const at = `emojis[${i}] ${e?.name ?? ''}`
    const fileOk = (rel) => typeof rel === 'string' && rel.startsWith('files/') && fs.existsSync(path.join(customDir, rel))
    if (!CUSTOM_NAME_PATTERN.test(e?.name ?? '')) errors.push(`${at}: 이름은 sf_ 로 시작하는 소문자 · 숫자 · _`)
    if (seen.has(e.name)) errors.push(`${at}: 이름 겹침`)
    if (otherNames.has(e.name)) errors.push(`${at}: 기본 세트 이름과 겹침`)
    seen.add(e.name)
    if (!CUSTOM_FORMATS.includes(e.format)) errors.push(`${at}: format 은 ${CUSTOM_FORMATS.join(' · ')}`)
    if (!fileOk(e.file)) errors.push(`${at}: file 이 custom/files/ 안에 없음`)
    if (typeof e.animated !== 'boolean') errors.push(`${at}: animated 는 true/false`)
    if (ALWAYS_ANIMATED.includes(e.format) && e.animated !== true) errors.push(`${at}: ${e.format} 는 animated true`)
    if (e.animated) {
      if (!fileOk(e.still)) errors.push(`${at}: 움직이는 이모지는 still(멈춘 그림)이 custom/files/ 안에 있어야 함`)
      else if (!STILL_FORMATS.includes(path.extname(e.still).slice(1))) errors.push(`${at}: still 은 svg · png · webp`)
    }
    for (const k of ['width', 'height']) if (!Number.isInteger(e[k]) || e[k] <= 0) errors.push(`${at}: ${k} 는 양의 정수`)
    if (!Array.isArray(e.ko) || !e.ko.length || !e.ko.every((w) => typeof w === 'string' && w)) errors.push(`${at}: ko(한국어 이름 · 키워드)는 글자 배열, 첫 칸 = 이름`)
    if (e.en !== undefined && !(Array.isArray(e.en) && e.en.every((w) => typeof w === 'string' && w))) errors.push(`${at}: en 은 글자 배열`)
    if (e.hidden !== undefined && typeof e.hidden !== 'boolean') errors.push(`${at}: hidden 은 true/false`)
  }
  return errors
}
