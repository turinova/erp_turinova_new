/** Resolve select value when equipment may have been soft-deleted. */
export function resolveAliveEquipmentId(
  currentId: string | null | undefined,
  aliveEquipment: Array<{ id: string }>
): { equipmentId: string; isOrphan: boolean } {
  const id = currentId?.trim() ?? ''
  if (!id) {
    return { equipmentId: '', isOrphan: false }
  }
  if (aliveEquipment.some((e) => e.id === id)) {
    return { equipmentId: id, isOrphan: false }
  }
  return { equipmentId: '', isOrphan: true }
}

export const ORPHAN_EQUIPMENT_MESSAGE =
  'A korábbi berendezés törölve lett — válassz újat a listából, majd mentsd.'
