export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  enrollments?: Array<{ type: string; enrollment_state: string }>;
  is_favorite?: boolean;
}

export interface CanvasAssignment {
  id: number;
  course_id: number;
  name: string;
  description?: string;
  due_at: string | null;
  points_possible: number;
  submission_types: string[];
  html_url: string;
}

export interface CanvasSubmission {
  assignment_id: number;
  assignment?: CanvasAssignment;
  course_id: number;
  score: number | null;
  grade: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  workflow_state: string;
  html_url?: string;
}

export interface CanvasAnnouncement {
  id: number;
  context_code: string;
  title: string;
  message: string;
  posted_at: string;
  author?: { display_name: string };
  html_url: string;
}

export interface CanvasFileMeta {
  id: number;
  filename: string;
  display_name: string;
  size: number;
  content_type: string;
  updated_at: string;
  url: string;
  folder_id: number;
}

export interface CanvasModule {
  id: number;
  name: string;
  items_count: number;
  items?: CanvasModuleItem[];
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  html_url?: string;
  url?: string;
}

export interface UpcomingEvent {
  type: string;
  title: string;
  html_url: string;
  start_at?: string;
  assignment?: {
    id: number;
    course_id: number;
    due_at: string | null;
    name: string;
    submission_types: string[];
  };
  context_code?: string;
}

export interface TodoItem {
  type: string;
  assignment?: CanvasAssignment;
  quiz?: { id: number; title: string; due_at: string | null };
  html_url?: string;
  context_type?: string;
  course_id?: number;
  ignore: boolean;
  ignore_permanently: boolean;
}
