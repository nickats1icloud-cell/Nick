import { classInfo } from '../../lib/lmu/constants.js'

/** Το tag της κατηγορίας (Hypercar / LMP2 / LMGT3) στο χρώμα του WEC. */
export default function ClassTag({ classId, short = false }) {
  const info = classInfo(classId)
  return (
    <span
      className="champ__class"
      style={{ '--class-color': info.color }}
      title={info.label}
    >
      {short ? info.short : info.label}
    </span>
  )
}
