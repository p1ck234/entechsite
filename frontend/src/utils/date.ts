export const extractIsoDate = (value: string): string => {
  const trimmedValue = value.trim();
  const datePart = trimmedValue.includes('T')
    ? trimmedValue.split('T')[0]
    : trimmedValue.split(' ')[0];

  const isoDateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoDateMatch) {
    return '';
  }

  return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
};

export const toInputDate = (value?: string | Date | null): string => {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return extractIsoDate(value);
};

export const formatRuDate = (value: string): string => {
  const isoDate = extractIsoDate(value);
  if (!isoDate) {
    return 'Дата не указана';
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Дата не указана';
  }

  return parsedDate.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
