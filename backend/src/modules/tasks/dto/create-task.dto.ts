export interface CreateTaskDto {
  date: string;
  title: string;
  description: string;
  artifact_link?: string;
}