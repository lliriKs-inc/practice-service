export interface CreateCohortDto {
  name: string;
  description?: string;
  application_start: string;
  application_end: string;
  practice_start: string;
  practice_end: string;
}

export interface UpdateCohortDto {
  name?: string;
  description?: string;
  application_start?: string;
  application_end?: string;
  practice_start?: string;
  practice_end?: string;
}