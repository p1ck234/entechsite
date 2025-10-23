import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { coursesAPI } from '../api/client';
import { Course, CoursesResponse } from '../types';
import { Search, Plus, Edit, Trash2, ExternalLink, Play, CheckCircle, Clock } from 'lucide-react';
import CourseModal from '../components/CourseModal';

const Courses: React.FC = () => {
  const { isAdmin } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response: CoursesResponse = await coursesAPI.getCourses({
        page: currentPage,
        limit: 12,
        search: searchTerm || undefined,
      });
      setCourses(response.courses);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [currentPage, searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCourses();
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    
    if (window.confirm('Вы уверены, что хотите удалить этот курс?')) {
      try {
        await coursesAPI.deleteCourse(id);
        fetchCourses();
      } catch (error) {
        console.error('Error deleting course:', error);
      }
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingCourse(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingCourse(null);
    fetchCourses();
  };

  const handleProgressUpdate = async (courseId: string, progress: number, completed?: boolean) => {
    try {
      await coursesAPI.updateProgress(courseId, progress, completed);
      fetchCourses();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-primary-500';
  };

  const getProgressIcon = (course: Course) => {
    if (course.userProgress?.completed) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (course.userProgress?.progress > 0) {
      return <Clock className="w-5 h-5 text-yellow-500" />;
    }
    return <Play className="w-5 h-5 text-pastel-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-pastel-800">Курсы</h1>
          <p className="text-pastel-600 mt-1">Образовательные материалы компании</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleAdd}
            className="mt-4 sm:mt-0 btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Добавить курс</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="glass-card p-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Поиск по названию или описанию..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          <button type="submit" className="btn-secondary">
            Найти
          </button>
        </form>
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="card p-6 hover:scale-105 transition-transform">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-pastel-800 mb-2 line-clamp-2">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="text-pastel-600 text-sm mb-3 line-clamp-3">
                      {course.description}
                    </p>
                  )}
                </div>
                <div className="ml-2">
                  {getProgressIcon(course)}
                </div>
              </div>

              {/* Progress Bar */}
              {course.userProgress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-pastel-600">Прогресс</span>
                    <span className="text-sm font-medium text-pastel-700">
                      {course.userProgress.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-pastel-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(course.userProgress.progress)}`}
                      style={{ width: `${course.userProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Course Info */}
              <div className="space-y-2 mb-4">
                {course.duration && (
                  <div className="flex items-center text-sm text-pastel-600">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>{Math.round(course.duration / 60)} мин</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <a
                  href={course.googleDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center space-x-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Открыть</span>
                </a>

                {!isAdmin && course.userProgress && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleProgressUpdate(course.id, 50)}
                      className="p-2 text-pastel-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      title="50%"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleProgressUpdate(course.id, 100, true)}
                      className="p-2 text-pastel-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Завершить"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(course)}
                      className="p-2 text-pastel-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(course.id)}
                      className="p-2 text-pastel-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          <span className="flex items-center px-4 py-2 text-pastel-600">
            Страница {currentPage} из {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Вперед
          </button>
        </div>
      )}

      {/* Course Modal */}
      {showModal && (
        <CourseModal
          course={editingCourse}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default Courses;
