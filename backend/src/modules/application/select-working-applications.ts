type WorkingApplicationCandidate = {
  id: string;
  submitted_at: Date;
  user: {
    id: string;
    active_application_id?: string | null;
  };
};

export function selectWorkingApplications<
  T extends WorkingApplicationCandidate,
>(
  applications: T[],
  practiceStart: Date,
  now = new Date()
): T[] {
  const byStudent = new Map<string, T[]>();

  for (const application of applications) {
    const current = byStudent.get(application.user.id) ?? [];
    current.push(application);
    byStudent.set(application.user.id, current);
  }

  return [...byStudent.values()].flatMap((studentApplications) => {
    const activeApplicationId =
      studentApplications[0].user.active_application_id ?? null;

    if (activeApplicationId) {
      const selected = studentApplications.find(
        ({ id }) => id === activeApplicationId
      );
      return selected ? [selected] : [];
    }

    if (studentApplications.length === 1 || practiceStart > now) {
      return studentApplications;
    }

    return [
      [...studentApplications].sort(
        (left, right) =>
          left.submitted_at.getTime() - right.submitted_at.getTime()
      )[0],
    ];
  });
}
