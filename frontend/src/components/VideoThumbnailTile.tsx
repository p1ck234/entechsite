import React, { useEffect, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import {
  captureVideoPosterFromRef,
  fetchDriveVideoThumbnailBlobUrl,
  revokeDriveImageBlobUrl,
} from '../utils/driveImageLoader';

interface VideoThumbnailTileProps {
  refValue: string;
  name: string;
}

const VideoThumbnailTile: React.FC<VideoThumbnailTileProps> = ({ refValue, name }) => {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const loadPoster = async () => {
      try {
        try {
          objectUrl = await fetchDriveVideoThumbnailBlobUrl(refValue);
        } catch {
          objectUrl = await captureVideoPosterFromRef(refValue);
        }

        if (active) {
          setPosterUrl(objectUrl);
        } else if (objectUrl) {
          revokeDriveImageBlobUrl(objectUrl);
        }
      } catch {
        if (active) {
          setPosterUrl(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPoster();

    return () => {
      active = false;
      if (objectUrl) {
        revokeDriveImageBlobUrl(objectUrl);
      }
    };
  }, [refValue]);

  return (
    <div className="relative w-full h-full bg-pastel-900/90 overflow-hidden">
      {posterUrl ? (
        <img src={posterUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
      ) : !loading ? (
        <div className="absolute inset-0 bg-gradient-to-br from-pastel-800 to-pastel-900" />
      ) : null}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-pastel-900/40">
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        </div>
      )}

      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-3">
        <div className="rounded-full bg-black/45 p-3 mb-2">
          <Play className="w-8 h-8 fill-white text-white" />
        </div>
        <span className="text-xs text-center line-clamp-2 drop-shadow">{name}</span>
      </div>
    </div>
  );
};

export default VideoThumbnailTile;
