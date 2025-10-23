import axios from 'axios';
import { AuthResponse, User, Employee, Course, Lesson, CourseProgress, EmployeesResponse, CoursesResponse } from '../types';
import { SITE_CONFIG } from '../config/site';

const API_BASE_URL = SITE_CONFIG.apiUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('Unauthorized access, redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Use replace to avoid back button issues
      window.location.replace('/login');
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

  register: async (email: string, password: string, role?: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', { email, password, role });
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
      updatedAt: emp.updated_at
    }));

    return {
      employees: transformedEmployees,
      pagination: response.data.pagination
    };
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
      updatedAt: emp.updated_at
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

// Courses API
export const coursesAPI = {
  getCourses: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<CoursesResponse> => {
    const response = await api.get('/courses', { params });
    return response.data;
  },

  getCourse: async (id: string): Promise<Course> => {
    const response = await api.get(`/courses/${id}`);
    return response.data;
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
};

// Lessons API
export const lessonsAPI = {
  getLessons: async (courseId: string): Promise<{ lessons: Lesson[] }> => {
    const response = await api.get(`/lessons/course/${courseId}`);
    return response.data;
  },

  getLesson: async (id: string): Promise<Lesson> => {
    const response = await api.get(`/lessons/${id}`);
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

export default api;
