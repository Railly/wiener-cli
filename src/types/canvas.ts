export interface CanvasSession {
  token: string;
  validatedAt: string;
  userId: string;
  primaryEmail?: string;
  name?: string;
}

export interface CanvasUser {
  id: string;
  name: string;
  primary_email?: string;
  login_id?: string;
}

export interface CanvasPaginationResult<T> {
  data: T[];
  nextUrl: string | null;
}

export interface RateLimit {
  remaining: number | null;
  requestCostEstimate: number | null;
}

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
  lock_at?: string | null;
  unlock_at?: string | null;
  points_possible: number;
  submission_types: string[];
  allowed_attempts?: number;
  allowed_extensions?: string[];
  html_url: string;
  rubric?: Array<{ description: string; points: number }>;
  submission?: CanvasSubmission | null;
}

export interface CanvasSubmission {
  id?: number;
  assignment_id: number;
  assignment?: CanvasAssignment;
  course_id: number;
  score: number | null;
  grade: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  workflow_state: string;
  attempt?: number | null;
  late?: boolean;
  missing?: boolean;
  late_policy_status?: string | null;
  html_url?: string;
  submission_comments?: Array<{ author_name: string; comment: string; created_at: string }>;
}

export interface CanvasUploadParams {
  upload_url: string;
  upload_params: Record<string, string>;
}

export interface CanvasUploadedFile {
  id: number;
  display_name: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
}

export interface CanvasSubmissionResponse {
  id: number;
  assignment_id: number;
  user_id: number | string;
  submitted_at: string | null;
  workflow_state: string;
  attempt: number | null;
  late: boolean;
  missing: boolean;
  score: number | null;
  grade: string | null;
  attachments?: CanvasUploadedFile[];
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
  content_id?: number;
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
    points_possible: number;
    html_url: string;
    submission?: CanvasSubmission | null;
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

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at?: string;
  end_at?: string;
  context_code: string;
  html_url: string;
  assignment?: CanvasAssignment;
}

export type CanvasUpcomingEvent = UpcomingEvent;
export type CanvasTodoItem = TodoItem;

export type CanvasFile = CanvasFileMeta;

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  folders_count: number;
  files_count: number;
  parent_folder_id?: number;
  updated_at: string;
}

export interface CanvasConversationParticipant {
  id: number;
  name: string;
}

export interface CanvasConversationMessage {
  id: number;
  created_at: string;
  body: string;
  author_id: number;
  generated?: boolean;
}

export interface CanvasConversation {
  id: number;
  subject?: string;
  workflow_state: string;
  last_message?: string;
  last_message_at?: string;
  message_count: number;
  subscribed?: boolean;
  private?: boolean;
  starred?: boolean;
  participants?: CanvasConversationParticipant[];
  context_name?: string;
  unread_count?: number;
  messages?: CanvasConversationMessage[];
}
