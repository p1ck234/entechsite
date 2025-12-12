/**
 * Преобразует Google Drive ссылки в формат для прямого доступа к изображению
 * Поддерживает различные форматы Google Drive ссылок
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return url;

  // Если это уже обычная ссылка (не Google Drive), возвращаем как есть
  if (!url.includes('google.com') && !url.includes('googleusercontent.com')) {
    return url;
  }

  // Формат: https://lh3.google.com/u/0/d/FILE_ID=w2880-h1764-iv1?auditContext=prefetch
  // Для ссылок lh3.google.com пробуем несколько вариантов преобразования
  if (url.includes('lh3.google.com')) {
    // Пробуем извлечь ID файла
    const lh3Match = url.match(/lh3\.google\.com\/[^/]+\/d\/([^=]+)/);
    if (lh3Match) {
      const fileId = lh3Match[1];
      
      // Используем формат для прямого доступа через Google Drive
      // Этот формат должен работать в Telegram Mini App
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    
    // Если не удалось извлечь ID, пробуем очистить оригинальную ссылку
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete('auditContext');
      urlObj.searchParams.delete('usp');
      // Убираем iv1 из пути и заменяем на s0 для оригинального размера
      if (urlObj.pathname.includes('=')) {
        // Заменяем параметры размера на s0 (оригинальный размер)
        urlObj.pathname = urlObj.pathname.replace(/=[^?]+/, '=s0');
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  // Формат: https://drive.google.com/file/d/FILE_ID/view
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFileMatch) {
    const fileId = driveFileMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Формат: https://drive.google.com/open?id=FILE_ID
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (driveOpenMatch) {
    const fileId = driveOpenMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Формат: https://docs.google.com/uc?id=FILE_ID
  const docsMatch = url.match(/docs\.google\.com\/uc\?id=([^&]+)/);
  if (docsMatch) {
    const fileId = docsMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Формат: https://lh3.googleusercontent.com/d/FILE_ID=w0
  const lh3UserContentMatch = url.match(/lh3\.googleusercontent\.com\/d\/([^=]+)/);
  if (lh3UserContentMatch) {
    const fileId = lh3UserContentMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Если не удалось распознать формат, возвращаем оригинальную ссылку
  // но пытаемся убрать параметры запроса, которые могут мешать
  try {
    const urlObj = new URL(url);
    // Убираем параметры, которые могут блокироваться
    urlObj.searchParams.delete('auditContext');
    urlObj.searchParams.delete('usp');
    return urlObj.toString();
  } catch {
    return url;
  }
}

