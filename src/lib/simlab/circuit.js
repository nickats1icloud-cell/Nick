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
  boardW: 330,
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

/** Τύποι pin που μεταφέρουν σήμα — μόνο από αυτά περνάει μια διαδρομή. */
const SIGNAL_TYPES = new Set([
  'din', 'dout', 'pwm', 'aout', 'sda', 'scl', 'sck', 'mosi', 'miso', 'cs',
])

/**
 * Ποιο pin της πλακέτας «βλέπει» ένα pin εξαρτήματος (άμεσα ή μέσω ενός
 * ενδιάμεσου εξαρτήματος όπως MOSFET / level shifter).
 *
 * Η διαδρομή μέσω ενδιάμεσου ακολουθεί ΜΟΝΟ pins σήματος: αλλιώς ένας level
 * shifter με το LV του στο 3V3 θα «απαντούσε» ότι το σήμα πάει στο 3V3.
 * Δοκιμάζεται πρώτα το ίδιο pin (απευθείας πέρασμα, π.χ. πύλη MOSFET) και
 * μετά τα υπόλοιπα pins σήματος.
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
    const candidates = midPart.pins.filter((x) => SIGNAL_TYPES.has(x.type))
    candidates.sort((a, b) => (a.id === mid.pin ? -1 : b.id === mid.pin ? 1 : 0))
    for (const other of candidates) {
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

/* ------------------------------------------------------------------ */
/* Δρομολόγηση καλωδίων                                                */
/* ------------------------------------------------------------------ */

/** Πόσο βγαίνει το καλώδιο ίσια από το pin πριν στρίψει. */
const STUB = 18
/** Απόσταση από τις κάρτες όταν χρειάζεται παράκαμψη. */
const GAP = 26

/** Τα ορθογώνια όλων των καρτών — εμπόδια για τη δρομολόγηση. */
export function cardRects(build, board) {
  const rects = [
    {
      x: build.boardPos.x,
      y: build.boardPos.y,
      w: GEO.boardW,
      h: boardGeometry(board).height,
    },
  ]
  for (const node of build.nodes) {
    const geo = partGeometry(node)
    rects.push({ x: node.x, y: node.y, w: geo.width, h: geo.height })
  }
  return rects
}

/** Τομή ευθύγραμμου τμήματος (οριζόντιου ή κάθετου) με ορθογώνιο. */
function segmentHitsRect(p1, p2, r) {
  const minX = Math.min(p1[0], p2[0])
  const maxX = Math.max(p1[0], p2[0])
  const minY = Math.min(p1[1], p2[1])
  const maxY = Math.max(p1[1], p2[1])
  // Αυστηρές ανισότητες: ένα τμήμα που ξεκινά ακριβώς πάνω στην ακμή και
  // απομακρύνεται δεν θεωρείται σύγκρουση.
  return maxX > r.x && minX < r.x + r.w && maxY > r.y && minY < r.y + r.h
}

function pathClear(pts, rects) {
  for (let i = 0; i < pts.length - 1; i += 1) {
    for (const r of rects) if (segmentHitsRect(pts[i], pts[i + 1], r)) return false
  }
  return true
}

/**
 * Ορθογώνια διαδρομή καλωδίου, σαν πραγματική δεσμίδα καλωδίων.
 *
 * Βγαίνει ίσια από κάθε pin προς τη μεριά που κοιτάει, δοκιμάζει κάθετους
 * «διαδρόμους» και κρατά τον πρώτο που δεν περνάει μέσα από κάρτα. Αν κανένας
 * δεν είναι καθαρός, κάνει παράκαμψη πάνω ή κάτω από όλες τις κάρτες.
 *
 * @param {object} a     άκρο { x, y, side }
 * @param {object} b     άκρο { x, y, side }
 * @param {object[]} rects εμπόδια
 * @param {number} lane  μετατόπιση ώστε παράλληλα καλώδια να μη στοιβάζονται
 */
export function routeWire(a, b, rects = [], lane = 0) {
  const ax = a.x + (a.side === 'left' ? -STUB : STUB)
  const bx = b.x + (b.side === 'left' ? -STUB : STUB)
  const start = [a.x, a.y]
  const sa = [ax, a.y]
  const sb = [bx, b.y]
  const end = [b.x, b.y]

  const mids = [
    (ax + bx) / 2 + lane,
    (ax + bx) / 2 - lane,
    ax + STUB + lane,
    bx - STUB - lane,
  ]
  for (const r of rects) {
    mids.push(r.x - GAP - lane, r.x + r.w + GAP + lane)
  }

  const candidates = mids.map((m) => [start, sa, [m, a.y], [m, b.y], sb, end])

  // Παράκαμψη πάνω ή κάτω από όλα τα εμπόδια.
  if (rects.length) {
    const top = Math.min(...rects.map((r) => r.y)) - GAP - lane
    const bottom = Math.max(...rects.map((r) => r.y + r.h)) + GAP + lane
    for (const y of [bottom, top]) {
      candidates.push([start, sa, [ax, y], [bx, y], sb, end])
    }
  }

  for (const c of candidates) if (pathClear(c, rects)) return c
  return candidates[0]
}

/** Πολυγραμμή → SVG path με στρογγυλεμένες γωνίες. */
export function polylineToPath(pts, radius = 9) {
  const p = pts.filter(
    (pt, i) => i === 0 || Math.abs(pt[0] - pts[i - 1][0]) > 0.5 || Math.abs(pt[1] - pts[i - 1][1]) > 0.5
  )
  if (p.length < 2) return ''
  let d = `M ${p[0][0]} ${p[0][1]}`
  for (let i = 1; i < p.length - 1; i += 1) {
    const [px, py] = p[i - 1]
    const [cx, cy] = p[i]
    const [nx, ny] = p[i + 1]
    const inLen = Math.hypot(cx - px, cy - py)
    const outLen = Math.hypot(nx - cx, ny - cy)
    const r = Math.min(radius, inLen / 2, outLen / 2)
    if (r < 1) {
      d += ` L ${cx} ${cy}`
      continue
    }
    const i1x = cx - ((cx - px) / inLen) * r
    const i1y = cy - ((cy - py) / inLen) * r
    const o1x = cx + ((nx - cx) / outLen) * r
    const o1y = cy + ((ny - cy) / outLen) * r
    d += ` L ${i1x.toFixed(1)} ${i1y.toFixed(1)} Q ${cx} ${cy} ${o1x.toFixed(1)} ${o1y.toFixed(1)}`
  }
  const last = p[p.length - 1]
  d += ` L ${last[0]} ${last[1]}`
  return d
}

/**
 * Τακτοποίηση: βάζει την πλακέτα στη μέση και μοιράζει τα εξαρτήματα
 * αριστερά/δεξιά ανάλογα με τη στήλη pins που χρησιμοποιούν, ώστε τα καλώδια
 * να μην χρειάζεται να γυρίσουν γύρω από την πλακέτα.
 */
export function autoLayout(build) {
  const board = getBoard(build.boardId)
  const boardGeo = boardGeometry(board)
  const boardY = 60
  const sideOf = new Map(boardGeo.pins.map((p) => [p.id, p.side]))

  // Σε ποια μεριά «κοιτάει» κάθε κόμβος και πόσο μακριά είναι από την πλακέτα.
  const info = new Map()
  for (const node of build.nodes) info.set(node.id, { side: null, depth: null, key: 0 })

  for (const node of build.nodes) {
    const ys = []
    let left = 0
    let right = 0
    for (const w of build.wires) {
      const mine = w.from.node === node.id ? w.from : w.to.node === node.id ? w.to : null
      if (!mine) continue
      const other = w.from.node === node.id ? w.to : w.from
      if (other.node !== BOARD_NODE) continue
      const pin = boardGeo.pins.find((p) => p.id === other.pin)
      if (!pin) continue
      ys.push(pin.y)
      if (sideOf.get(other.pin) === 'left') left += 1
      else right += 1
    }
    if (ys.length) {
      const rec = info.get(node.id)
      rec.side = left > right ? 'left' : 'right'
      rec.depth = 0
      rec.key = ys.reduce((s, y) => s + y, 0) / ys.length
    }
  }

  // Όσα δεν αγγίζουν την πλακέτα κρέμονται από γείτονα (π.χ. load cell → HX711).
  for (let pass = 0; pass < 4; pass += 1) {
    for (const node of build.nodes) {
      const rec = info.get(node.id)
      if (rec.depth !== null) continue
      for (const w of build.wires) {
        const other =
          w.from.node === node.id ? w.to : w.to.node === node.id ? w.from : null
        if (!other || other.node === BOARD_NODE) continue
        const nb = info.get(other.node)
        if (nb && nb.depth !== null) {
          rec.side = nb.side
          rec.depth = nb.depth + 1
          rec.key = nb.key + 0.5
          break
        }
      }
    }
  }
  for (const rec of info.values()) {
    if (rec.depth === null) {
      rec.side = 'right'
      rec.depth = 0
      rec.key = 9999
    }
  }

  // Στοίβαξη ανά στήλη, με τη σειρά των pins ώστε να μη διασταυρώνονται.
  const columns = new Map()
  for (const node of build.nodes) {
    const rec = info.get(node.id)
    const col = `${rec.side}:${rec.depth}`
    if (!columns.has(col)) columns.set(col, [])
    columns.get(col).push({ node, rec })
  }

  // Η πλακέτα μετακινείται δεξιά όσο χρειάζεται ώστε να χωρέσουν όλες οι
  // αριστερές στήλες — αλλιώς η πιο απομακρυσμένη θα έβγαινε εκτός καμβά και
  // θα κουμπωνόταν πάνω στη διπλανή της.
  const step = GEO.partW + 56
  let maxLeftDepth = -1
  for (const [col] of columns) {
    const [side, depthStr] = col.split(':')
    if (side === 'left') maxLeftDepth = Math.max(maxLeftDepth, Number(depthStr))
  }
  const margin = 40
  const boardGap = 64
  const boardX =
    maxLeftDepth < 0 ? margin : margin + maxLeftDepth * step + GEO.partW + boardGap

  const nodes = build.nodes.map((n) => ({ ...n }))
  const byId = new Map(nodes.map((n) => [n.id, n]))

  for (const [col, members] of columns) {
    const [side, depthStr] = col.split(':')
    const depth = Number(depthStr)
    const x =
      side === 'left'
        ? boardX - boardGap - GEO.partW - depth * step
        : boardX + GEO.boardW + boardGap + depth * step

    members.sort((m1, m2) => m1.rec.key - m2.rec.key)
    let y = boardY
    for (const { node } of members) {
      const target = byId.get(node.id)
      target.x = Math.round(x)
      target.y = Math.round(y)
      y += partGeometry(node).height + 34
    }
  }

  return { ...build, boardPos: { x: boardX, y: boardY }, nodes }
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
