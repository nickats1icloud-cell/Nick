/** Αποθήκευση κατασκευών στον browser (localStorage) και εξαγωγή/εισαγωγή JSON. */

const KEY_BUILDS = 'simlab.builds'
/** Εξάγεται ώστε οι καρτέλες να ακούν το ίδιο κλειδί για συγχρονισμό. */
export const KEY_CURRENT = 'simlab.current'

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function listSavedBuilds() {
  const all = read(KEY_BUILDS, [])
  return Array.isArray(all) ? all : []
}

export function saveBuild(build) {
  const all = listSavedBuilds()
  const stamped = { ...build, savedAt: new Date().toISOString() }
  const idx = all.findIndex((b) => b.name === build.name)
  if (idx >= 0) all[idx] = stamped
  else all.push(stamped)
  write(KEY_BUILDS, all)
  return all
}

export function deleteBuild(name) {
  const all = listSavedBuilds().filter((b) => b.name !== name)
  write(KEY_BUILDS, all)
  return all
}

export function loadCurrent() {
  return read(KEY_CURRENT, null)
}

export function storeCurrent(build) {
  return write(KEY_CURRENT, build)
}

/** Κατέβασμα αρχείου από τον browser (JSON, .ino, CSV). */
export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function parseBuildJson(text) {
  const data = JSON.parse(text)
  if (!data || typeof data !== 'object') throw new Error('Μη έγκυρο αρχείο')
  if (!Array.isArray(data.nodes) || !Array.isArray(data.wires)) {
    throw new Error('Το αρχείο δεν περιέχει κατασκευή')
  }
  return data
}
