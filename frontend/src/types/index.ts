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

export interface BookingResource {
  id: string;
  name: string;
  type: BookingResourceType;
  zoomUrl?: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}
