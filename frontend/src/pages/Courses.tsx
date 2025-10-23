import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { coursesAPI, lessonsAPI } from '../api/client';
import { Course, CoursesResponse, Lesson } from '../types';
import { Search, Plus, Edit, Trash2, ExternalLink, Play, CheckCircle, Clock, BookOpen, List } from 'lucide-react';
import CourseModal from '../components/CourseModal';
import LessonModal from '../components/LessonModal';
import { useLocation } from 'react-router-dom';

const Courses: React.FC = () => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Reset selected course when navigating to courses page
  useEffect(() => {
    if (location.pathname === '/courses') {
      setSelectedCourse(null);
      setLessons([]);
      // Refresh courses when returning to main view
      fetchCourses();
    }
  }, [location.pathname]);

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

  const handleLessonModalClose = () => {
    setShowLessonModal(false);
    setEditingLesson(null);
    if (selectedCourse) {
      fetchLessons(selectedCourse.id);
    }
  };

  const fetchLessons = async (courseId: string) => {
    try {
      const response = await lessonsAPI.getLessons(courseId);
      setLessons(response.lessons);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    }
  };

  const handleViewLessons = (course: Course) => {
    setSelectedCourse(course);
    fetchLessons(course.id);
  };

  const handleAddLesson = (course: Course) => {
    setSelectedCourse(course);
    setEditingLesson(null);
    setShowLessonModal(true);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setShowLessonModal(true);
  };

  const handleDeleteLesson = async (id: string) => {
    if (!isAdmin) return;
    
    if (window.confirm('Вы уверены, что хотите удалить этот урок?')) {
      try {
        await lessonsAPI.deleteLesson(id);
        if (selectedCourse) {
          fetchLessons(selectedCourse.id);
        }
      } catch (error) {
        console.error('Error deleting lesson:', error);
      }
    }
  };

  const handleLessonProgress = async (lessonId: string, completed: boolean) => {
    try {
      await lessonsAPI.updateProgress(lessonId, completed);
      if (selectedCourse) {
        fetchLessons(selectedCourse.id);
        fetchCourses(); // Обновить прогресс курса
      }
    } catch (error) {
      console.error('Error updating lesson progress:', error);
    }
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

      {/* Back to courses button if viewing lessons */}
      {selectedCourse && (
        <div className="mb-6">
          <button
            onClick={() => {
              setSelectedCourse(null);
              setLessons([]);
              fetchCourses();
            }}
            className="btn-secondary flex items-center space-x-2"
          >
            <BookOpen className="w-5 h-5" />
            <span>Назад к курсам</span>
          </button>
        </div>
      )}

      {/* Courses or Lessons Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      ) : selectedCourse ? (
        // Lessons view
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-pastel-800">{selectedCourse.title}</h2>
                <p className="text-pastel-600">{selectedCourse.description}</p>
                {selectedCourse.googleDriveUrl && (
                  <div className="mt-3">
                    <a
                      href={selectedCourse.googleDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary inline-flex items-center space-x-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Открыть курс в Google Drive</span>
                    </a>
                  </div>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleAddLesson(selectedCourse)}
                  className="btn-primary flex items-center space-x-2 ml-4"
                >
                  <Plus className="w-5 h-5" />
                  <span>Добавить урок</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="card p-6 hover:scale-105 transition-transform">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-pastel-800 mb-2 line-clamp-2">
                      {lesson.title}
                    </h3>
                    {lesson.description && (
                      <p className="text-pastel-600 text-sm mb-3 line-clamp-3">
                        {lesson.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-2">
                    {lesson.userProgress?.completed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                </div>

                {/* Lesson Info */}
                <div className="space-y-2 mb-4">
                  {lesson.duration && (
                    <div className="flex items-center text-sm text-pastel-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{lesson.duration} мин</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    {lesson.googleDriveUrl ? (
                      <a
                        href={lesson.googleDriveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary flex items-center space-x-2 text-sm"
                        title={`Открыть урок: ${lesson.googleDriveUrl}`}
                      >
                        <Play className="w-4 h-4" />
                        <span>Начать урок</span>
                      </a>
                    ) : (
                      <button
                        className="btn-primary flex items-center space-x-2 text-sm opacity-50 cursor-not-allowed"
                        disabled
                        title="Ссылка на урок не добавлена"
                      >
                        <Play className="w-4 h-4" />
                        <span>Начать урок</span>
                      </button>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    {!isAdmin && (
                      <button
                        onClick={() => handleLessonProgress(lesson.id, !lesson.userProgress?.completed)}
                        className={`p-2 rounded-lg transition-colors ${
                          lesson.userProgress?.completed 
                            ? 'text-green-600 bg-green-50 hover:text-red-600 hover:bg-red-50' 
                            : 'text-pastel-600 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={lesson.userProgress?.completed ? "Отметить как не завершенный" : "Завершить урок"}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleEditLesson(lesson)}
                          className="p-2 text-pastel-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLesson(lesson.id)}
                          className="p-2 text-pastel-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Courses view
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
                    <span>{course.duration} мин</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleViewLessons(course)}
                    className="btn-primary flex items-center space-x-2 text-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span>Начать курс</span>
                  </button>
                </div>

                {!isAdmin && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleProgressUpdate(course.id, course.userProgress?.completed ? 0 : 100, !course.userProgress?.completed)}
                      className={`p-2 rounded-lg transition-colors ${
                        course.userProgress?.completed 
                          ? 'text-green-600 bg-green-50 hover:text-red-600 hover:bg-red-50' 
                          : 'text-pastel-600 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={course.userProgress?.completed ? "Отметить как не завершенный" : "Завершить курс"}
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

      {/* Lesson Modal */}
      {showLessonModal && selectedCourse && (
        <LessonModal
          lesson={editingLesson}
          courseId={selectedCourse.id}
          onClose={handleLessonModalClose}
        />
      )}
    </div>
  );
};

export default Courses;
