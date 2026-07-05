const activeCohorts = new Map<string, string>();

export function setActiveCohort(userId: string, cohortId: string) {
  activeCohorts.set(userId, cohortId);
}

export function getActiveCohort(userId: string) {
  return activeCohorts.get(userId);
}
