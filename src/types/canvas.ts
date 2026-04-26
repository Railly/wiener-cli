// Canvas LMS REST API shapes — mirrors Instructure API response structures
// PHASE A WILL REPLACE: this stub will be superseded by Phase A's canonical types

export interface CanvasUser {
  id: number;
  name: string;
  login_id: string;
  email?: string;
  avatar_url?: string;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
  enrollment_term_id?: number;
  start_at?: string | null;
  end_at?: string | null;
  calendar?: { ics: string };
  enrollments?: Array<{ type: string; role: string }>;
  syllabus_body?: string | null;
  term?: { id: number; name: string };
  tabs?: CanvasTab[];
}

export interface CanvasTab {
  id: string;
  label: string;
  html_url: string;
  hidden?: boolean;
  visibility: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string | null;
  due_at?: string | null;
  points_possible: number;
  submission_types: string[];
  workflow_state: string;
  html_url: string;
  course_id: number;
  rubric?: CanvasRubricCriterion[];
  overrides?: CanvasAssignmentOverride[];
}

export interface CanvasRubricCriterion {
  id: string;
  description: string;
  points: number;
  ratings: Array<{ description: string; points: number }>;
}

export interface CanvasAssignmentOverride {
  id: number;
  assignment_id: number;
  title: string;
  due_at?: string | null;
  all_day?: boolean;
  student_ids?: number[];
}

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at?: string | null;
  graded_at?: string | null;
  score?: number | null;
  grade?: string | null;
  workflow_state: string;
  late: boolean;
  missing: boolean;
  excused?: boolean | null;
  submission_comments?: CanvasSubmissionComment[];
  assignment?: CanvasAssignment;
}

export interface CanvasSubmissionComment {
  id: number;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface CanvasUpcomingEvent {
  id: string;
  title: string;
  type: string;
  context_code?: string;
  html_url: string;
  start_at?: string | null;
  all_day?: boolean;
  assignment?: {
    id: number;
    name: string;
    due_at?: string | null;
    points_possible: number;
    course_id: number;
    html_url: string;
    submission: CanvasSubmission | null;
  };
}

export interface CanvasTodoItem {
  type: string;
  assignment: CanvasAssignment & {
    course_id: number;
    submission: CanvasSubmission | null;
  };
  context_type: string;
  course_id?: number;
  html_url: string;
  needs_grading_count?: number;
  ignore?: string;
  ignore_permanently?: string;
}

export interface CanvasPlannerItem {
  course_id?: number | null;
  group_id?: number | null;
  user_id?: number;
  context_type?: string;
  context_name?: string;
  plannable_id: number;
  plannable_type: string;
  planner_override?: CanvasPlannerOverride | null;
  plannable_date: string;
  plannable: CanvasPlannable;
  submissions?: CanvasPlannerSubmissions;
  new_activity?: boolean;
  html_url?: string;
}

export interface CanvasPlannable {
  id: number;
  title?: string;
  name?: string;
  due_at?: string | null;
  points_possible?: number;
  course_id?: number;
  html_url?: string;
}

export interface CanvasPlannerOverride {
  id: number;
  workflow_state: string;
  dismissed: boolean;
  marked_complete: boolean;
}

export interface CanvasPlannerSubmissions {
  submitted?: boolean;
  excused?: boolean;
  graded?: boolean;
  posted_grade?: string | null;
  late?: boolean;
  missing?: boolean;
  needs_grading?: boolean;
}

export interface CanvasEnrollment {
  id: number;
  course_id: number;
  user_id: number;
  type: string;
  role: string;
  enrollment_state: string;
  grades?: {
    current_grade?: string | null;
    current_score?: number | null;
    final_grade?: string | null;
    final_score?: number | null;
  };
  computed_current_grade?: string | null;
  computed_current_score?: number | null;
  computed_final_grade?: string | null;
  computed_final_score?: number | null;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  author: { id: number; display_name: string };
  read_state: string;
  context_code: string;
  html_url: string;
}

export interface CanvasFile {
  id: number;
  "content-type": string;
  url: string;
  size: number;
  display_name: string;
  filename: string;
  folder_id: number;
  created_at: string;
  updated_at: string;
  modified_at: string;
  thumbnail_url?: string | null;
  mime_class?: string;
  hidden?: boolean;
}

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  context_id: number;
  context_type: string;
  parent_folder_id?: number | null;
  files_count: number;
  folders_count: number;
  files_url: string;
  folders_url: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  unlock_at?: string | null;
  require_sequential_progress?: boolean;
  workflow_state: string;
  items_count?: number;
  items?: CanvasModuleItem[];
}

export interface CanvasModuleItem {
  id: number;
  module_id: number;
  position: number;
  title: string;
  indent?: number;
  type: "File" | "Page" | "Discussion" | "Assignment" | "Quiz" | "SubHeader" | "ExternalUrl" | "ExternalTool";
  content_id?: number;
  html_url?: string;
  url?: string;
  page_url?: string;
  external_url?: string;
  completion_requirement?: {
    type: string;
    completed?: boolean;
    min_score?: number;
  };
}

export interface CanvasPage {
  url: string;
  title: string;
  body?: string;
  created_at: string;
  updated_at: string;
  published: boolean;
  editing_roles?: string;
  last_edited_by?: { id: number; display_name: string };
}

export interface CanvasDiscussion {
  id: number;
  title: string;
  message: string;
  html_url: string;
  posted_at: string;
  last_reply_at?: string | null;
  delayed_post_at?: string | null;
  lock_at?: string | null;
  user_name?: string;
  author: { id: number; display_name: string; avatar_image_url?: string };
  unread_count: number;
  discussion_subentry_count: number;
  read_state?: string;
  subscribed?: boolean;
  workflow_state: string;
}

export interface CanvasQuiz {
  id: number;
  title: string;
  html_url: string;
  mobile_url?: string;
  description?: string;
  quiz_type: string;
  time_limit?: number | null;
  shuffle_answers?: boolean;
  allowed_attempts: number;
  due_at?: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  workflow_state: string;
  points_possible?: number | null;
  question_count?: number;
}

export interface CanvasConference {
  id: number;
  conference_type: string;
  conference_key?: string;
  description?: string;
  duration?: number;
  ended_at?: string | null;
  started_at?: string | null;
  title: string;
  users: number[];
  has_advanced_settings?: boolean;
  long_running?: boolean;
  user_settings?: Record<string, unknown>;
  recordings?: CanvasConferenceRecording[];
  url?: string;
  join_url?: string;
}

export interface CanvasConferenceRecording {
  duration_minutes: number;
  playback_url: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasCalendarEvent {
  id: string;
  title: string;
  start_at?: string | null;
  end_at?: string | null;
  all_day: boolean;
  description?: string | null;
  location_name?: string | null;
  workflow_state: string;
  context_code: string;
  effective_context_code?: string;
  html_url: string;
  url?: string;
  child_events?: CanvasCalendarEvent[];
}

export interface CanvasConversation {
  id: number;
  subject?: string;
  workflow_state: "read" | "unread" | "archived";
  last_message?: string;
  last_message_at?: string;
  message_count: number;
  subscribed: boolean;
  private: boolean;
  starred: boolean;
  participants: Array<{ id: number; name: string; avatar_url?: string }>;
  audience?: number[];
  audience_contexts?: Record<string, Record<string, string[]>>;
  avatar_url?: string;
  unread_count?: number;
  context_name?: string;
  messages?: CanvasConversationMessage[];
}

export interface CanvasConversationMessage {
  id: number;
  created_at: string;
  body: string;
  author_id: number;
  author_name?: string;
  generated: boolean;
  media_comment?: unknown;
  forwarded_messages?: CanvasConversationMessage[];
  attachments?: CanvasFile[];
}
