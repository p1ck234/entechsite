export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  telegram?: string;
  photo?: string;
  isActive: boolean;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'; // Статус регистрации
  createdAt: string;
  updatedAt: string;
  userRole?: 'ADMIN' | 'USER'; // Role from users table
  managerId?: string | null;
  orgDisplayMode?: 'person' | 'role';
}

export interface OrgEmployee {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  position: string;
  department: string;
  photo?: string;
  managerId?: string | null;
  orgDisplayMode?: 'person' | 'role';
}

export interface OrgTreeNode {
  employee: OrgEmployee;
  children: OrgTreeNode[];
}

export interface OrgDepartmentGroup {
  department: string;
  employees: OrgEmployee[];
  roots: OrgTreeNode[];
  employeeCount: number;
}

export type OrgViewMode = 'company' | 'departments';

export interface OrgStructureResponse {
  companyName: string;
  total: number;
  roots: OrgTreeNode[];
  employees: OrgEmployee[];
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  googleDriveUrl: string;
  duration?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userProgress?: {
    progress: number;
    completed: boolean;
    startedAt?: string;
    completedAt?: string;
  };
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  googleDriveUrl?: string;
  duration?: number;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userProgress?: {
    completed: boolean;
    startedAt?: string;
    completedAt?: string;
  };
}

export type LessonMaterialType = 'image' | 'video' | 'pdf' | 'audio';

export interface LessonMaterial {
  id: string;
  name: string;
  mimeType?: string;
  ref: string;
  mediaType: LessonMaterialType;
}

export interface LessonMaterialsResponse {
  lessonId: string;
  title: string;
  materials: LessonMaterial[];
}

export interface CourseProgress {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
  completed: boolean;
  startedAt: string;
  completedAt?: string;
  course: {
    id: string;
    title: string;
    description?: string;
    duration?: number;
    googleDriveUrl: string;
  };
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
  approved?: boolean;
  employee?: Employee;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  isNewUser?: boolean;
  needsApproval?: boolean;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface EmployeesResponse {
  employees: Employee[];
  pagination: PaginationInfo;
}

export interface CoursesResponse {
  courses: Course[];
  pagination: PaginationInfo;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface EmployeeForm {
  firstName: string;
  lastName: string;
  middleName?: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  telegram?: string;
  photo?: string;
}

export interface CourseForm {
  title: string;
  description?: string;
  googleDriveUrl: string;
  duration?: number;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  googleDriveUrl: string;
  previewImages: string[];
  eventDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventPhoto {
  id: string;
  name: string;
  mimeType?: string;
  ref: string;
  mediaType?: 'image' | 'video';
}

export interface EventPhotosResponse {
  eventId: string;
  title: string;
  photos: EventPhoto[];
}

export interface EventsResponse {
  events: Event[];
  pagination: PaginationInfo;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  eventTime?: string;
  location?: string;
  isAllDay: boolean;
  createdBy?: number;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramBot {
  id: string;
  name: string;
  type: 'BOT' | 'SITE';
  username?: string; // без @, только для BOT
  url?: string; // только для SITE
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BookingResourceType = 'room' | 'zoom';

export type BookingRecurrenceType = 'none' | 'weekly';

export interface BookingRecurrenceInput {
  type: BookingRecurrenceType;
  weekdays?: number[];
  untilDate?: string;
}

export interface BookingResource {
  id: string;
  name: string;
  type: BookingResourceType;
  zoomUrl?: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  tags?: BookingTag[];
  createdAt: string;
  updatedAt: string;
}

export interface BookingTag {
  id: string;
  name: string;
  createdAt?: string;
}

export interface Booking {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: BookingResourceType;
  zoomUrl?: string;
  userId: string;
  userEmail: string;
  employeeName?: string;
  title: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
  recurrenceGroupId?: string;
  tags?: BookingTag[];
  createdAt: string;
  updatedAt: string;
}

export type SupportQueue = 'public' | 'shadow';
export type SupportPriority = 'P1' | 'P2' | 'P3';
export type SupportStatus = 'new' | 'acknowledged' | 'in_progress' | 'done';

export interface SupportMeFlags {
  canAgentPublic: boolean;
  canShadow: boolean;
  canManageAgents: boolean;
}

export interface SupportTicket {
  id: string;
  queue: SupportQueue;
  requesterUserId: string;
  requesterName: string;
  requesterEmail?: string;
  subject: string;
  body: string;
  category: string;
  priority: SupportPriority;
  status: SupportStatus;
  assigneeUserId?: string | null;
  attachmentUrl?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  acknowledgedAt?: string | null;
  startedAt?: string | null;
  resolvedAt?: string | null;
  responseDueAt?: string | null;
  resolveDueAt?: string | null;
  updatedAt: string;
  todoistTaskId?: string | null;
  responseSlaMet?: boolean | null;
  resolveSlaMet?: boolean | null;
  firstResponseMs?: number | null;
  resolveMs?: number | null;
}

export interface SupportTicketEvent {
  id: string;
  ticketId: string;
  actorUserId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface SupportTicketReply {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName: string;
  isAgent: boolean;
  body: string;
  createdAt: string;
}

export interface SupportKpi {
  queue: SupportQueue;
  total: number;
  byStatus: {
    new: number;
    acknowledged: number;
    inProgress: number;
    done: number;
  };
  avgFirstResponseMs: number | null;
  avgResolveMs: number | null;
  responseSlaCompliance: number | null;
  resolveSlaCompliance: number | null;
  byPriority: Array<{
    priority: SupportPriority;
    total: number;
    doneCount: number;
    avgResolveMs: number | null;
  }>;
}

export interface SupportAgent {
  id: string;
  userId: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}
