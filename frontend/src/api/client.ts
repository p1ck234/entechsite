import axios from 'axios';
import { AuthResponse, User, Employee, Course, Lesson, LessonMaterialsResponse, CourseProgress, EmployeesResponse, CoursesResponse, Event, EventsResponse, EventPhotosResponse, CalendarEvent, TelegramBot, BookingResource, Booking, BookingRecurrenceInput, BookingTag, PaginationInfo, OrgStructureResponse, OrgEmployee } from '../types';

import { API_BASE_URL } from '../config/api';
import { clearEventPhotosCache, getCachedEventPhotos, rememberEventPhotos } from '../utils/eventPhotosCache';
import { buildOrgTree } from '../utils/orgStructure';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 секунд таймаут
});

const DRIVE_SYNC_TIMEOUT_MS = 180000;

// API для загрузки файлов (с FormData)
const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 секунд для загрузки файлов
});

type TelegramOAuthPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

// Request interceptor to add auth token
const addAuthToken = (config: any) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(addAuthToken, (error) => {
  return Promise.reject(error);
});

// Request interceptor для upload API
uploadApi.interceptors.request.use(addAuthToken, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle auth errors and network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Логируем все ошибки для отладки
    console.error('API Error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config?.baseURL + error.config?.url
    });

    if (error.response?.status === 401) {
      console.log('Unauthorized access, redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Use replace to avoid back button issues
      window.location.replace('/login');
    }
    
    // Обработка сетевых ошибок
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        error.message = 'Превышено время ожидания. Проверьте подключение к интернету.';
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        error.message = `Ошибка сети. Не удалось подключиться к серверу. URL: ${error.config?.baseURL || API_BASE_URL}`;
      } else {
        error.message = `Ошибка подключения: ${error.message || 'Неизвестная ошибка'}`;
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (email: string, password: string, telegramUsername: string, firstName: string, lastName: string, position?: string, department?: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', { 
      email, 
      password, 
      telegramUsername,
      firstName,
      lastName,
      position,
      department
    });
    return response.data;
  },

  loginTelegram: async (initData: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/telegram', { initData });
    return response.data;
  },

  loginTelegramOAuth: async (payload: TelegramOAuthPayload): Promise<AuthResponse> => {
    const response = await api.post('/auth/telegram-oauth', payload);
    return response.data;
  },

  registerTelegram: async (initData: string, firstName: string, lastName: string, position?: string, department?: string, phone?: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/register-telegram', { 
      initData, 
      firstName, 
      lastName, 
      position, 
      department, 
      phone 
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Employees API
export const employeesAPI = {
      getEmployees: async (params?: {
        page?: number;
        limit?: number;
        search?: string;
        department?: string;
        showInactive?: boolean;
        status?: 'APPROVED' | 'PENDING' | 'REJECTED'; // Changed to match backend format
      }): Promise<EmployeesResponse> => {
    const response = await api.get('/employees', { params });
    
    // Transform snake_case to camelCase
    const transformedEmployees = response.data.employees.map((emp: any) => ({
      id: emp.id,
      firstName: emp.first_name,
      lastName: emp.last_name,
      middleName: emp.middle_name,
      position: emp.position,
      department: emp.department,
      email: emp.email,
      phone: emp.phone,
      telegram: emp.telegram,
      photo: emp.photo,
      isActive: emp.is_active,
      createdAt: emp.created_at,
      updatedAt: emp.updated_at,
      userRole: emp.user_role,
      status: emp.status, // Добавляем статус
      managerId: emp.manager_id ? String(emp.manager_id) : null,
    }));

    return {
      employees: transformedEmployees,
      pagination: response.data.pagination
    };
  },

  getCurrentEmployee: async (): Promise<Employee | null> => {
    try {
      const response = await api.get('/employees/me');
      const emp = response.data;
      
      // Transform snake_case to camelCase
      return {
        id: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name,
        middleName: emp.middle_name,
        position: emp.position,
        department: emp.department,
        email: emp.email,
        phone: emp.phone,
        telegram: emp.telegram,
        photo: emp.photo,
        isActive: emp.is_active,
        createdAt: emp.created_at,
        updatedAt: emp.updated_at,
        userRole: emp.user_role,
        managerId: emp.manager_id ? String(emp.manager_id) : null,
      };
    } catch (error: any) {
      // If employee not found (404), return null instead of throwing
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  getEmployee: async (id: string): Promise<Employee> => {
    const response = await api.get(`/employees/${id}`);
    const emp = response.data;
    
    // Transform snake_case to camelCase
    return {
      id: emp.id,
      firstName: emp.first_name,
      lastName: emp.last_name,
      middleName: emp.middle_name,
      position: emp.position,
      department: emp.department,
      email: emp.email,
      phone: emp.phone,
      telegram: emp.telegram,
      photo: emp.photo,
      isActive: emp.is_active,
      createdAt: emp.created_at,
      updatedAt: emp.updated_at,
      userRole: emp.user_role,
      managerId: emp.manager_id ? String(emp.manager_id) : null,
    };
  },

  createEmployee: async (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ message: string; employee: Employee }> => {
    const response = await api.post('/employees', employee);
    return response.data;
  },

  updateEmployee: async (id: string, employee: Partial<Employee>): Promise<{ message: string; employee: Employee }> => {
    const response = await api.put(`/employees/${id}`, employee);
    return response.data;
  },

  deleteEmployee: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },
};

const mapEmployeeToOrg = (employee: Employee): OrgEmployee => ({
  id: employee.id,
  firstName: employee.firstName,
  lastName: employee.lastName,
  middleName: employee.middleName,
  position: employee.position,
  department: employee.department,
  photo: employee.photo,
  managerId: employee.managerId || null,
  orgDisplayMode: employee.orgDisplayMode,
});

const fetchAllApprovedEmployees = async (): Promise<Employee[]> => {
  const employees: Employee[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await employeesAPI.getEmployees({
      page,
      limit: 100,
      status: 'APPROVED',
    });
    employees.push(...response.employees.filter((employee) => employee.isActive));
    totalPages = response.pagination.pages;
    page += 1;
  } while (page <= totalPages);

  return employees;
};

const buildTreeFromEmployees = async (): Promise<OrgStructureResponse> => {
  const employees = await fetchAllApprovedEmployees();
  const orgEmployees = employees.map(mapEmployeeToOrg);

  return {
    companyName: 'EnTech',
    total: orgEmployees.length,
    roots: buildOrgTree(orgEmployees),
    employees: orgEmployees,
  };
};

const extractApiErrorMessage = (error: any, fallback: string): string => {
  const data = error?.response?.data;
  if (!data) {
    return error?.message || fallback;
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  const validationMessage = data.errors?.[0]?.msg;
  if (typeof validationMessage === 'string' && validationMessage.trim()) {
    return validationMessage;
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  const status = error?.response?.status;
  if (status === 404) {
    return 'Маршрут API не найден — нужен redeploy backend';
  }

  return fallback;
};

export const orgStructureAPI = {
  getTree: async (): Promise<OrgStructureResponse> => {
    const endpoints = ['/org-structure/tree', '/employees/org-tree'];

    for (const endpoint of endpoints) {
      try {
        const response = await api.get(endpoint);
        return response.data;
      } catch (error: any) {
        console.warn(`Org tree endpoint failed (${endpoint}):`, error.response?.status, error.response?.data);
      }
    }

    return buildTreeFromEmployees();
  },

  updateManager: async (
    employeeId: string,
    managerId: string | null
  ): Promise<{ message: string }> => {
    const normalizedManagerId = managerId ? String(managerId) : null;
    const payload = {
      managerId: normalizedManagerId ? Number(normalizedManagerId) : null,
    };
    const attempts: Array<() => Promise<{ message: string }>> = [
      async () => {
        const response = await api.patch(`/employees/${employeeId}/manager`, payload);
        return response.data;
      },
      async () => {
        const response = await api.patch(`/org-structure/employees/${employeeId}/manager`, payload);
        return response.data;
      },
      async () => {
        const response = await employeesAPI.updateEmployee(employeeId, {
          managerId: normalizedManagerId,
        });
        return { message: response.message };
      },
    ];

    let lastError: any;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error: any) {
        lastError = error;
        console.warn('Update manager attempt failed:', error.response?.status, error.response?.data);
      }
    }

    throw new Error(extractApiErrorMessage(lastError, 'Не удалось сохранить руководителя'));
  },

  createRole: async (payload: {
    position: string;
    department: string;
    managerId?: string | null;
  }): Promise<{ message: string; employee: OrgEmployee }> => {
    const response = await api.post('/org-structure/roles', {
      position: payload.position,
      department: payload.department,
      managerId: payload.managerId ? Number(payload.managerId) : null,
    });
    return response.data;
  },

  updateDisplayMode: async (
    employeeId: string,
    orgDisplayMode: 'person' | 'role'
  ): Promise<{ message: string; employee: OrgEmployee }> => {
    const response = await api.patch(`/org-structure/employees/${employeeId}/display-mode`, {
      orgDisplayMode,
    });
    return response.data;
  },
};

// Courses API
export const coursesAPI = {
  getCourses: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<CoursesResponse> => {
    const response = await api.get('/courses', { params });
    
    // Transform snake_case to camelCase
    const transformedCourses = response.data.courses.map((course: any) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      googleDriveUrl: course.google_drive_url,
      duration: course.duration,
      isActive: course.is_active,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
      userProgress: course.userProgress
    }));

    return {
      courses: transformedCourses,
      pagination: response.data.pagination
    };
  },

  getCourse: async (id: string): Promise<Course> => {
    const response = await api.get(`/courses/${id}`);
    const course = response.data;
    
    // Transform snake_case to camelCase
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      googleDriveUrl: course.google_drive_url,
      duration: course.duration,
      isActive: course.is_active,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
      userProgress: course.userProgress
    };
  },

  createCourse: async (course: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'userProgress'>): Promise<{ message: string; course: Course }> => {
    const response = await api.post('/courses', course);
    return response.data;
  },

  updateCourse: async (id: string, course: Partial<Course>): Promise<{ message: string; course: Course }> => {
    const response = await api.put(`/courses/${id}`, course);
    return response.data;
  },

  deleteCourse: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/courses/${id}`);
    return response.data;
  },

  updateProgress: async (courseId: string, progress: number, completed?: boolean): Promise<{ message: string; progress: CourseProgress }> => {
    const response = await api.post(`/courses/${courseId}/progress`, { progress, completed });
    return response.data;
  },

  getUserProgress: async (): Promise<{ progress: CourseProgress[] }> => {
    const response = await api.get('/courses/progress/user');
    return response.data;
  },

  syncTrainingFromDrive: async (): Promise<{
    message: string;
    coursesFound: number;
    coursesCreated: number;
    coursesUpdated: number;
    coursesUnchanged: number;
    lessonsCreated: number;
    lessonsUpdated: number;
    lessonsUnchanged: number;
    lessonsArchived: number;
  }> => {
    const response = await api.post('/drive/sync-training', undefined, {
      timeout: DRIVE_SYNC_TIMEOUT_MS,
    });
    return response.data;
  },
};

// Lessons API
export const lessonsAPI = {
  getLessons: async (courseId: string): Promise<{ lessons: Lesson[] }> => {
    const response = await api.get(`/lessons/course/${courseId}`);
    
    // Transform snake_case to camelCase
    const transformedLessons = response.data.lessons.map((lesson: any) => ({
      id: lesson.id,
      courseId: lesson.course_id,
      title: lesson.title,
      description: lesson.description,
      googleDriveUrl: lesson.google_drive_url,
      duration: lesson.duration,
      orderIndex: lesson.order_index,
      isActive: lesson.is_active,
      createdAt: lesson.created_at,
      updatedAt: lesson.updated_at,
      userProgress: lesson.userProgress
    }));

    return {
      lessons: transformedLessons
    };
  },

  getLesson: async (id: string): Promise<Lesson> => {
    const response = await api.get(`/lessons/${id}`);
    const lesson = response.data;
    
    // Transform snake_case to camelCase
    return {
      id: lesson.id,
      courseId: lesson.course_id,
      title: lesson.title,
      description: lesson.description,
      googleDriveUrl: lesson.google_drive_url,
      duration: lesson.duration,
      orderIndex: lesson.order_index,
      isActive: lesson.is_active,
      createdAt: lesson.created_at,
      updatedAt: lesson.updated_at,
      userProgress: lesson.userProgress
    };
  },

  getLessonMaterials: async (id: string): Promise<LessonMaterialsResponse> => {
    const response = await api.get(`/lessons/${id}/materials`);
    return response.data;
  },

  createLesson: async (lesson: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt' | 'userProgress'>): Promise<{ message: string; lesson: Lesson }> => {
    const response = await api.post('/lessons', lesson);
    return response.data;
  },

  updateLesson: async (id: string, lesson: Partial<Lesson>): Promise<{ message: string; lesson: Lesson }> => {
    const response = await api.put(`/lessons/${id}`, lesson);
    return response.data;
  },

  deleteLesson: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/lessons/${id}`);
    return response.data;
  },

  updateProgress: async (lessonId: string, completed: boolean): Promise<{ message: string; progress: any }> => {
    const response = await api.post(`/lessons/${lessonId}/progress`, { completed });
    return response.data;
  },
};

// Users API (Admin only)
export const usersAPI = {
  createUser: async (userData: {
    email: string;
    password: string;
    role: 'ADMIN' | 'USER';
    firstName: string;
    lastName: string;
    middleName?: string;
    position: string;
    department: string;
    phone: string;
    telegram?: string;
    photo?: string;
  }): Promise<{ message: string; user: User; employee: Employee }> => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  changeUserPassword: async (email: string, newPassword: string): Promise<{ message: string; email: string }> => {
    const response = await api.put('/users/password-by-email', { email, newPassword });
    return response.data;
  },

  getPendingRegistrations: async (): Promise<{ registrations: any[] }> => {
    const response = await api.get('/users/pending-registrations');
    return response.data;
  },

  approveRegistration: async (id: string): Promise<{ message: string; employee: any }> => {
    const response = await api.post(`/users/approve-registration/${id}`);
    return response.data;
  },

  rejectRegistration: async (id: string): Promise<{ message: string; employee: any }> => {
    const response = await api.post(`/users/reject-registration/${id}`);
    return response.data;
  },
};

// Events API
export const eventsAPI = {
  getEvents: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<EventsResponse> => {
    const response = await api.get('/events', { params });
    
    // Transform snake_case to camelCase
    const transformedEvents = response.data.events.map((event: any) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      googleDriveUrl: event.google_drive_url,
      previewImages: event.preview_images || [],
      eventDate: event.event_date,
      isActive: event.is_active,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    }));

    return {
      events: transformedEvents,
      pagination: response.data.pagination
    };
  },

  getEvent: async (id: string): Promise<Event> => {
    const response = await api.get(`/events/${id}`);
    const event = response.data;
    
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      googleDriveUrl: event.google_drive_url,
      previewImages: event.preview_images || [],
      eventDate: event.event_date,
      isActive: event.is_active,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    };
  },

  getEventPhotos: async (id: string, options?: { refresh?: boolean }): Promise<EventPhotosResponse> => {
    if (!options?.refresh) {
      const cached = getCachedEventPhotos(id);
      if (cached) {
        return cached;
      }
    }

    const response = await api.get(`/events/${id}/photos`, {
      params: options?.refresh ? { refresh: '1' } : undefined,
    });
    rememberEventPhotos(id, response.data);
    return response.data;
  },

  clearEventPhotosCache,

  createEvent: async (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ message: string; event: Event }> => {
    const response = await api.post('/events', event);
    return response.data;
  },

  updateEvent: async (id: string, event: Partial<Event>): Promise<{ message: string; event: Event }> => {
    const response = await api.put(`/events/${id}`, event);
    return response.data;
  },

  deleteEvent: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },

  syncLifeFromDrive: async (): Promise<{
    message: string;
    eventsFound: number;
    eventsCreated: number;
    eventsUpdated: number;
    eventsUnchanged: number;
    eventsArchived: number;
    eventsSkippedNoDate: number;
  }> => {
    const response = await api.post('/drive/sync-life', undefined, {
      timeout: DRIVE_SYNC_TIMEOUT_MS,
    });
    return response.data;
  },
};

// Calendar API
export const calendarAPI = {
  getEvents: async (params?: {
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }): Promise<{ events: CalendarEvent[] }> => {
    const response = await api.get('/calendar', { params });
    
    // Transform snake_case to camelCase
    const transformedEvents = response.data.events.map((event: any) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventDate: event.event_date,
      eventTime: event.event_time,
      location: event.location,
      isAllDay: event.is_all_day,
      createdBy: event.created_by,
      createdByEmail: event.created_by_email,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    }));

    return {
      events: transformedEvents
    };
  },

  getEvent: async (id: string): Promise<CalendarEvent> => {
    const response = await api.get(`/calendar/${id}`);
    const event = response.data;
    
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      eventDate: event.event_date,
      eventTime: event.event_time,
      location: event.location,
      isAllDay: event.is_all_day,
      createdBy: event.created_by,
      createdByEmail: event.created_by_email,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    };
  },

  createEvent: async (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByEmail'>): Promise<{ message: string; event: CalendarEvent }> => {
    console.log('calendarAPI.createEvent called with:', event);
    try {
      const response = await api.post('/calendar', event);
      console.log('calendarAPI.createEvent response:', response.data);
      return response.data;
    } catch (error) {
      console.error('calendarAPI.createEvent error:', error);
      throw error;
    }
  },

  updateEvent: async (id: string, event: Partial<CalendarEvent>): Promise<{ message: string; event: CalendarEvent }> => {
    const response = await api.put(`/calendar/${id}`, event);
    return response.data;
  },

  deleteEvent: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/calendar/${id}`);
    return response.data;
  },
};

export const bookingTagsAPI = {
  getTags: async (): Promise<{ tags: BookingTag[] }> => {
    const response = await api.get('/booking-tags');
    return response.data;
  },

  createTag: async (name: string): Promise<{ message: string; tag: BookingTag }> => {
    const response = await api.post('/booking-tags', { name });
    return response.data;
  },
};

export const bookingResourcesAPI = {
  getResources: async (): Promise<{ resources: BookingResource[] }> => {
    const response = await api.get('/booking-resources');
    return response.data;
  },

  getAllResources: async (): Promise<{ resources: BookingResource[] }> => {
    const response = await api.get('/booking-resources/all');
    return response.data;
  },

  createResource: async (resource: {
    name: string;
    type: 'room' | 'zoom';
    zoomUrl?: string;
    description?: string;
    sortOrder?: number;
    tagIds?: string[];
  }): Promise<{ message: string; resource: BookingResource }> => {
    const response = await api.post('/booking-resources', resource);
    return response.data;
  },

  updateResource: async (
    id: string,
    resource: Partial<{
      name: string;
      type: 'room' | 'zoom';
      zoomUrl: string | null;
      description: string;
      sortOrder: number;
      isActive: boolean;
      tagIds: string[];
    }>
  ): Promise<{ message: string; resource: BookingResource }> => {
    const response = await api.put(`/booking-resources/${id}`, resource);
    return response.data;
  },

  deleteResource: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/booking-resources/${id}`);
    return response.data;
  },
};

export const bookingsAPI = {
  getBookings: async (params?: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    type?: 'room' | 'zoom';
    resourceId?: string;
    mine?: boolean;
  }): Promise<{ bookings: Booking[] }> => {
    const response = await api.get('/bookings', { params });
    return response.data;
  },

  createBooking: async (booking: {
    resourceId: string;
    title: string;
    description?: string;
    date: string;
    startTime: string;
    endTime: string;
    tagIds?: string[];
    recurrence?: BookingRecurrenceInput;
  }): Promise<{ message: string; booking: Booking; createdCount?: number }> => {
    const response = await api.post('/bookings', booking);
    return response.data;
  },

  updateBooking: async (
    id: string,
    booking: Partial<{
      title: string;
      description: string;
      date: string;
      startTime: string;
      endTime: string;
      tagIds: string[];
    }>
  ): Promise<{ message: string; booking: Booking }> => {
    const response = await api.put(`/bookings/${id}`, booking);
    return response.data;
  },

  cancelBooking: async (id: string, scope: 'single' | 'series' = 'single'): Promise<{ message: string; cancelledCount?: number }> => {
    const response = await api.delete(`/bookings/${id}`, {
      params: scope === 'series' ? { scope } : undefined,
    });
    return response.data;
  },
};

// Bots API
export const botsAPI = {
  getBots: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ bots: TelegramBot[]; pagination: PaginationInfo }> => {
    const response = await api.get('/bots', { params });
    
    // Transform snake_case to camelCase
    const transformedBots = response.data.bots.map((bot: any) => ({
      id: String(bot.id),
      name: bot.name,
      type: bot.type || 'BOT',
      username: bot.username,
      url: bot.url,
      description: bot.description,
      isActive: bot.is_active,
      createdAt: bot.created_at,
      updatedAt: bot.updated_at
    }));

    return {
      bots: transformedBots,
      pagination: response.data.pagination
    };
  },

  getBot: async (id: string): Promise<TelegramBot> => {
    const response = await api.get(`/bots/${id}`);
    const bot = response.data;
    
    return {
      id: String(bot.id),
      name: bot.name,
      type: bot.type || 'BOT',
      username: bot.username,
      url: bot.url,
      description: bot.description,
      isActive: bot.is_active,
      createdAt: bot.created_at,
      updatedAt: bot.updated_at
    };
  },

  createBot: async (bot: Omit<TelegramBot, 'id' | 'createdAt' | 'updatedAt'>): Promise<TelegramBot> => {
    const response = await api.post('/bots', {
      name: bot.name,
      type: bot.type,
      username: bot.username,
      url: bot.url,
      description: bot.description,
      is_active: bot.isActive
    });
    const createdBot = response.data;
    
    return {
      id: String(createdBot.id),
      name: createdBot.name,
      type: createdBot.type || 'BOT',
      username: createdBot.username,
      url: createdBot.url,
      description: createdBot.description,
      isActive: createdBot.is_active,
      createdAt: createdBot.created_at,
      updatedAt: createdBot.updated_at
    };
  },

  updateBot: async (id: string, bot: Partial<TelegramBot>): Promise<TelegramBot> => {
    const response = await api.put(`/bots/${id}`, {
      name: bot.name,
      type: bot.type,
      username: bot.username,
      url: bot.url,
      description: bot.description,
      is_active: bot.isActive
    });
    const updatedBot = response.data;
    
    return {
      id: String(updatedBot.id),
      name: updatedBot.name,
      type: updatedBot.type || 'BOT',
      username: updatedBot.username,
      url: updatedBot.url,
      description: updatedBot.description,
      isActive: updatedBot.is_active,
      createdAt: updatedBot.created_at,
      updatedAt: updatedBot.updated_at
    };
  },

  deleteBot: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/bots/${id}`);
    return response.data;
  },
};

// Upload API
export const uploadAPI = {
  uploadPhoto: async (file: File): Promise<{ url: string; filename: string; message: string }> => {
    const formData = new FormData();
    formData.append('photo', file);
    
    // НЕ устанавливаем Content-Type вручную - axios сам установит правильный boundary
    const response = await uploadApi.post('/upload', formData);
    
    return response.data;
  },
  
  deletePhoto: async (filename: string): Promise<{ message: string }> => {
    const response = await uploadApi.delete(`/upload/${filename}`);
    return response.data;
  },
  
  getPhotoUrl: (filename: string): string => {
    return `${API_BASE_URL}/uploads/${filename}`;
  },
};

export default api;
