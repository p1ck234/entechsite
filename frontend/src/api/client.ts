import axios from 'axios';
import { AuthResponse, User, Employee, Course, CourseProgress, EmployeesResponse, CoursesResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
    return response.data;
  },

  getEmployee: async (id: string): Promise<Employee> => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
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

export default api;
