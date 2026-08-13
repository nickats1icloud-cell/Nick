/**
 * Το μοντέλο της κατασκευής: κόμβοι (εξαρτήματα), καλώδια και δίκτυα.
 *
 * Όλα εδώ είναι καθαρές συναρτήσεις πάνω σε ένα απλό αντικείμενο `build`,
 * ώστε να αποθηκεύεται/φορτώνεται ως JSON χωρίς μετατροπές.
 */

import { getBoard } from './boards.js'
import { getPart, defaultParams } from './parts.js'

export const BUILD_VERSION = 1

/* Γεωμετρία καρτών στον πάγκο — σταθερή, ώστε τα καλώδια να υπολογίζονται
   χωρίς μέτρηση DOM. */
export const GEO = {
  partW: 196,
  boardW: 240,
  headerH: 34,
  rowH: 22,
  padBottom: 12,
  pinR: 5,
}

let seq = 0
function uid(prefix) {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`
}

export const BOARD_NODE = 'board'

/** Ρυθμίσεις firmware που ισχύουν για όλη την κατασκευή. */
export const DEFAULT_SETTINGS = {
  debounceMs: 5,
  filterAlpha: 0.3,
  deadzonePct: 2,
}

export function createBuild(boardId = 'pro-micro', name = 'Νέα κατασκευή') {
  return {
    version: BUILD_VERSION,
    name,
    boardId,
    boardPos: { x: 40, y: 60 },
    nodes: [],
    wires: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

export function updateSettings(build, patch) {
  return { ...build, settings: { ...DEFAULT_SETTINGS, ...build.settings, ...patch } }
}

/* ------------------------------------------------------------------ */
/* Κόμβοι                                                              */
/* ------------------------------------------------------------------ */

export function addNode(build, partId, pos) {
  const part = getPart(partId)
  if (!part) return build
  const node = {
    id: uid('n'),
    partId,
    label: part.name,
    x: Math.round(pos?.x ?? 380),
    y: Math.round(pos?.y ?? 80),
    values: defaultParams(partId),
  }
  return { ...build, nodes: [...build.nodes, node] }
}

export function removeNode(build, nodeId) {
  return {
    ...build,
    nodes: build.nodes.filter((n) => n.id !== nodeId),
    wires: build.wires.filter((w) => w.from.node !== nodeId && w.to.node !== nodeId),
  }
}

export function updateNode(build, nodeId, patch) {
  return {
    ...build,
    nodes: build.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
  }
}

export function updateNodeValues(build, nodeId, patch) {
  return {
    ...build,
    nodes: build.nodes.map((n) =>
      n.id === nodeId ? { ...n, values: { ...n.values, ...patch } } : n
    ),
  }
}

export function duplicateNode(build, nodeId) {
  const src = build.nodes.find((n) => n.id === nodeId)
  if (!src) return build
  const copy = { ...src, id: uid('n'), x: src.x + 28, y: src.y + 28, values: { ...src.values } }
  return { ...build, nodes: [...build.nodes, copy] }
}

export function setBoard(build, boardId) {
  // Αλλάζοντας πλακέτα, τα καλώδια προς pins που δεν υπάρχουν πια πέφτουν.
  const board = getBoard(boardId)
  const valid = new Set(board.pins.map((p) => p.id))
  return {
    ...build,
    boardId,
    wires: build.wires.filter(
      (w) =>
        (w.from.node !== BOARD_NODE || valid.has(w.from.pin)) &&
        (w.to.node !== BOARD_NODE || valid.has(w.to.pin))
    ),
  }
}

/* ------------------------------------------------------------------ */
/* Καλώδια                                                             */
/* ------------------------------------------------------------------ */

export function pinKey(ref) {
  return `${ref.node}:${ref.pin}`
}

export function sameRef(a, b) {
  return a.node === b.node && a.pin === b.pin
}

export function addWire(build, from, to) {
  if (sameRef(from, to)) return build
  if (from.node === to.node) return build
  const exists = build.wires.some(
    (w) => (sameRef(w.from, from) && sameRef(w.to, to)) || (sameRef(w.from, to) && sameRef(w.to, from))
  )
  if (exists) return build
  return { ...build, wires: [...build.wires, { id: uid('w'), from, to }] }
}

export function removeWire(build, wireId) {
  return { ...build, wires: build.wires.filter((w) => w.id !== wireId) }
}

export function wiresAt(build, ref) {
  return build.wires.filter((w) => sameRef(w.from, ref) || sameRef(w.to, ref))
}

export function isConnected(build, ref) {
  return wiresAt(build, ref).length > 0
}

/** Το άλλο άκρο ενός καλωδίου. */
export function otherEnd(wire, ref) {
  return sameRef(wire.from, ref) ? wire.to : wire.from
}

/**
 * Ποιο pin της πλακέτας «βλέπει» ένα pin εξαρτήματος (άμεσα ή μέσω ενός
 * ενδιάμεσου εξαρτήματος όπως MOSFET / level shifter).
 */
export function boardPinFor(build, nodeId, pinId) {
  const direct = wiresAt(build, { node: nodeId, pin: pinId })
    .map((w) => otherEnd(w, { node: nodeId, pin: pinId }))
    .find((r) => r.node === BOARD_NODE)
  if (direct) return direct.pin

  // Έμμεση διαδρομή μέσω ενός ενδιάμεσου (μία στάση).
  for (const wire of wiresAt(build, { node: nodeId, pin: pinId })) {
    const mid = otherEnd(wire, { node: nodeId, pin: pinId })
    const midNode = build.nodes.find((n) => n.id === mid.node)
    const midPart = midNode && getPart(midNode.partId)
    if (!midPart) continue
    if (!['mosfet', 'levelshifter'].includes(midPart.role)) continue
    for (const other of midPart.pins) {
      const ref = { node: mid.node, pin: other.id }
      const hop = wiresAt(build, ref)
        .filter((w) => w.id !== wire.id)
        .map((w) => otherEnd(w, ref))
        .find((r) => r.node === BOARD_NODE)
      if (hop) return hop.pin
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Δίκτυα (nets)                                                       */
/* ------------------------------------------------------------------ */

/** Ομαδοποιεί όλα τα pins σε δίκτυα με union-find πάνω στα καλώδια. */
export function computeNets(build) {
  const parent = new Map()
  const find = (k) => {
    if (!parent.has(k)) parent.set(k, k)
    while (parent.get(k) !== k) {
      parent.set(k, parent.get(parent.get(k)))
      k = parent.get(k)
    }
    return k
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const w of build.wires) union(pinKey(w.from), pinKey(w.to))

  const groups = new Map()
  for (const w of build.wires) {
    for (const ref of [w.from, w.to]) {
      const root = find(pinKey(ref))
      if (!groups.has(root)) groups.set(root, [])
      const list = groups.get(root)
      if (!list.some((r) => sameRef(r, ref))) list.push(ref)
    }
  }
  return [...groups.values()]
}

/* ------------------------------------------------------------------ */
/* Γεωμετρία                                                           */
/* ------------------------------------------------------------------ */

function layoutPins(pins, width) {
  const left = pins.filter((p) => p.side === 'left')
  const right = pins.filter((p) => p.side !== 'left')
  const out = []
  left.forEach((p, i) => {
    out.push({ ...p, x: 0, y: GEO.headerH + i * GEO.rowH + GEO.rowH / 2 })
  })
  right.forEach((p, i) => {
    out.push({ ...p, x: width, y: GEO.headerH + i * GEO.rowH + GEO.rowH / 2 })
  })
  const rows = Math.max(left.length, right.length)
  return { pins: out, height: GEO.headerH + rows * GEO.rowH + GEO.padBottom }
}

/** Γεωμετρία ενός εξαρτήματος: πλάτος, ύψος και θέσεις pins (σχετικές). */
export function partGeometry(node) {
  const part = getPart(node.partId)
  if (!part) return { width: GEO.partW, height: 60, pins: [] }
  const { pins, height } = layoutPins(part.pins, GEO.partW)
  return { width: GEO.partW, height, pins }
}

/** Γεωμετρία της πλακέτας: τα pins μοιράζονται σε δύο στήλες. */
export function boardGeometry(board) {
  const half = Math.ceil(board.pins.length / 2)
  const sided = board.pins.map((p, i) => ({ ...p, side: i < half ? 'left' : 'right' }))
  const { pins, height } = layoutPins(sided, GEO.boardW)
  return { width: GEO.boardW, height, pins }
}

/** Απόλυτη θέση ενός pin στον πάγκο. */
export function pinPosition(build, board, ref) {
  if (ref.node === BOARD_NODE) {
    const geo = boardGeometry(board)
    const pin = geo.pins.find((p) => p.id === ref.pin)
    if (!pin) return null
    return { x: build.boardPos.x + pin.x, y: build.boardPos.y + pin.y, side: pin.side }
  }
  const node = build.nodes.find((n) => n.id === ref.node)
  if (!node) return null
  const geo = partGeometry(node)
  const pin = geo.pins.find((p) => p.id === ref.pin)
  if (!pin) return null
  return { x: node.x + pin.x, y: node.y + pin.y, side: pin.side }
}

/**
 * Διαδρομή Bézier για ένα καλώδιο.
 *
 * Τα σημεία ελέγχου βγαίνουν προς τη μεριά που «κοιτάει» κάθε pin, αλλά
 * περιορίζονται ώστε η καμπύλη να μη βγαίνει έξω από τον καμβά όταν τα δύο
 * άκρα κοιτάνε αντίθετα.
 */
export function wirePath(a, b) {
  const dx = Math.min(170, Math.max(40, Math.abs(b.x - a.x) * 0.5))
  const c1x = a.side === 'left' ? Math.max(8, a.x - dx) : a.x + dx
  const c2x = b.side === 'left' ? Math.max(8, b.x - dx) : b.x + dx
  return `M ${a.x} ${a.y} C ${c1x} ${a.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`
}

/** Τα τοποθετημένα εξαρτήματα μαζί με τον ορισμό τους — βολικό για ανάλυση. */
export function placedParts(build) {
  return build.nodes
    .map((node) => ({ node, part: getPart(node.partId), values: node.values }))
    .filter((x) => x.part)
}

/** Μέγεθος καμβά ώστε να χωράνε όλα τα εξαρτήματα. */
export function canvasSize(build, board) {
  let maxX = build.boardPos.x + GEO.boardW
  let maxY = build.boardPos.y + boardGeometry(board).height
  for (const node of build.nodes) {
    const geo = partGeometry(node)
    maxX = Math.max(maxX, node.x + geo.width)
    maxY = Math.max(maxY, node.y + geo.height)
  }
  return { width: Math.max(1200, maxX + 160), height: Math.max(720, maxY + 160) }
}
