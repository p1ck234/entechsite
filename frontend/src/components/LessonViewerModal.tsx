import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Headphones, ImageOff, Music, Video, X } from 'lucide-react';
import { lessonsAPI } from '../api/client';
import type { Lesson, LessonMaterial } from '../types';
import {
  fetchDriveFileBlobUrl,
  getDriveMediaStreamUrl,
  isLessonAudio,
  isLessonPdf,
  isLessonVideo,
  revokeDriveImageBlobUrl,
} from '../utils/driveImageLoader';

interface LessonViewerModalProps {
  lesson: Lesson;
  onClose: () => void;
}

const MaterialPreview: React.FC<{ material: LessonMaterial }> = ({ material }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isLessonVideo(material)) {
      setBlobUrl(null);
      setError(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    fetchDriveFileBlobUrl(material.ref)
      .then((url) => {
        if (!active) {
          revokeDriveImageBlobUrl(url);
          return;
        }
        objectUrl = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        revokeDriveImageBlobUrl(objectUrl);
      }
    };
  }, [material]);

  if (isLessonVideo(material)) {
    const streamUrl = getDriveMediaStreamUrl(material.ref);
    if (!streamUrl) {
      return <ImageOff className="w-12 h-12 text-pastel-400" />;
    }

    return (
      <video
        key={streamUrl}
        src={streamUrl}
        controls
        playsInline
        preload="metadata"
        className="w-full max-h-[65vh] rounded-xl bg-black"
      >
        Ваш браузер не поддерживает воспроизведение видео.
      </video>
    );
  }

  if (isLessonAudio(material)) {
    if (error || !blobUrl) {
      return <ImageOff className="w-12 h-12 text-pastel-400" />;
    }

    return (
      <div className="w-full max-w-xl rounded-2xl border border-pastel-200 bg-pastel-50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Music className="w-8 h-8 text-primary-500" />
          <p className="font-medium text-pastel-800">{material.name}</p>
        </div>
        <audio controls src={blobUrl} className="w-full">
          Ваш браузер не поддерживает воспроизведение аудио.
        </audio>
      </div>
    );
  }

  if (isLessonPdf(material)) {
    if (error || !blobUrl) {
      return <ImageOff className="w-12 h-12 text-pastel-400" />;
    }

    return (
      <iframe
        title={material.name}
        src={blobUrl}
        className="w-full h-[65vh] rounded-xl border border-pastel-200 bg-white"
      />
    );
  }

  if (error || !blobUrl) {
    return <ImageOff className="w-12 h-12 text-pastel-400" />;
  }

  return (
    <img
      src={blobUrl}
      alt={material.name}
      className="max-w-full max-h-[65vh] object-contain rounded-xl"
    />
  );
};

const getMaterialIcon = (material: LessonMaterial) => {
  if (isLessonVideo(material)) {
    return Video;
  }
  if (isLessonPdf(material)) {
    return FileText;
  }
  if (isLessonAudio(material)) {
    return Headphones;
  }
  return FileText;
};

const LessonViewerModal: React.FC<LessonViewerModalProps> = ({ lesson, onClose }) => {
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadMaterials = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await lessonsAPI.getLessonMaterials(lesson.id);
        if (!isMounted) {
          return;
        }
        setMaterials(response.materials);
        setActiveMaterialId(response.materials[0]?.id || null);
      } catch (loadError: any) {
        if (!isMounted) {
          return;
        }
        setError(loadError.response?.data?.message || loadError.message || 'Не удалось загрузить материалы');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMaterials();

    return () => {
      isMounted = false;
    };
  }, [lesson.id]);

  const activeMaterial = useMemo(
    () => materials.find((material) => material.id === activeMaterialId) || null,
    [materials, activeMaterialId]
  );

  const materialsSummary = useMemo(() => {
    const videos = materials.filter((item) => isLessonVideo(item)).length;
    const pdfs = materials.filter((item) => isLessonPdf(item)).length;
    const audio = materials.filter((item) => isLessonAudio(item)).length;
    const parts = [];

    if (videos > 0) parts.push(`${videos} видео`);
    if (pdfs > 0) parts.push(`${pdfs} PDF`);
    if (audio > 0) parts.push(`${audio} аудио`);

    return parts.join(', ') || `${materials.length} файлов`;
  }, [materials]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-pastel-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-pastel-800 truncate">{lesson.title}</h2>
            <p className="text-sm text-pastel-500 mt-1">
              {loading ? 'Загрузка материалов...' : materialsSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-pastel-500 hover:text-pastel-800 hover:bg-pastel-100 transition-colors"
            aria-label="Закрыть урок"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {loading ? (
            <div className="flex-1 flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
              <ImageOff className="w-10 h-10 text-pastel-400 mb-3" />
              <p className="text-pastel-700">{error}</p>
            </div>
          ) : materials.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
              <ImageOff className="w-10 h-10 text-pastel-400 mb-3" />
              <p className="text-pastel-700">В этой папке нет видео или PDF для просмотра в портале</p>
              {lesson.googleDriveUrl && (
                <a
                  href={lesson.googleDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть в Google Drive
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="lg:w-80 border-b lg:border-b-0 lg:border-r border-pastel-200 overflow-y-auto p-4 space-y-2">
                {materials.map((material) => {
                  const Icon = getMaterialIcon(material);
                  const isActive = material.id === activeMaterialId;

                  return (
                    <button
                      key={material.id}
                      type="button"
                      onClick={() => setActiveMaterialId(material.id)}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                        isActive
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-pastel-200 hover:border-primary-200 hover:bg-pastel-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-pastel-500'}`} />
                        <span className="text-sm text-pastel-800 line-clamp-3">{material.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-5 flex items-center justify-center bg-pastel-50/60">
                {activeMaterial ? (
                  <div className="w-full max-w-4xl">
                    <p className="text-sm font-medium text-pastel-700 mb-3">{activeMaterial.name}</p>
                    <MaterialPreview material={activeMaterial} />
                  </div>
                ) : (
                  <ImageOff className="w-10 h-10 text-pastel-400" />
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-pastel-200 px-5 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {lesson.googleDriveUrl ? (
            <a
              href={lesson.googleDriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm text-pastel-600 hover:text-primary-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Открыть папку в Google Drive</span>
            </a>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="btn-secondary sm:min-w-[140px]">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonViewerModal;
