export type GeneratedShift = { start: Date; end: Date; assigneeId: string };

export type ScheduleOptions = {
  start: Date;
  end: Date;
  shiftMinutes: number;
  peoplePerShift: number;
  memberIds: string[];
};

/**
 * Build a fair pit-duty rotation. Splits [start, end) into fixed-length slots and,
 * for each slot, picks the members with the least assigned time so far, lightly
 * penalizing back-to-back shifts so duty rotates evenly across the team.
 */
export function generateSchedule(opts: ScheduleOptions): GeneratedShift[] {
  const { start, end, shiftMinutes, peoplePerShift, memberIds } = opts;
  const shifts: GeneratedShift[] = [];
  if (memberIds.length === 0 || shiftMinutes <= 0 || peoplePerShift <= 0) return shifts;

  const slotMs = shiftMinutes * 60_000;
  const endMs = end.getTime();
  if (endMs <= start.getTime()) return shifts;

  const assignedMin = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const lastSlot = new Map<string, number>(memberIds.map((id) => [id, -10]));
  const perSlot = Math.min(peoplePerShift, memberIds.length);

  let slotIndex = 0;
  for (let t = start.getTime(); t + slotMs <= endMs; t += slotMs) {
    const slotStart = new Date(t);
    const slotEnd = new Date(t + slotMs);

    const ranked = [...memberIds].sort((a, b) => {
      const aPenalty = lastSlot.get(a) === slotIndex - 1 ? shiftMinutes : 0;
      const bPenalty = lastSlot.get(b) === slotIndex - 1 ? shiftMinutes : 0;
      return assignedMin.get(a)! + aPenalty - (assignedMin.get(b)! + bPenalty);
    });

    for (const id of ranked.slice(0, perSlot)) {
      shifts.push({ start: slotStart, end: slotEnd, assigneeId: id });
      assignedMin.set(id, assignedMin.get(id)! + shiftMinutes);
      lastSlot.set(id, slotIndex);
    }
    slotIndex += 1;
  }

  return shifts;
}
