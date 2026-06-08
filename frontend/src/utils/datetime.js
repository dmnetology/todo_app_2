const pad = (value) => String(value).padStart(2, '0');

export const parseDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Поддержка формата:
  // 2026-06-03 10:04:06
  // 2026-06-03T10:04:06
  // 2026-06-03T10:04:06.123

  const ruMatch = str.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:,\s*|\s+)(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (ruMatch) {
    const [, day, month, year, hour, minute, second = '0'] = ruMatch;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalized = str.replace(' ', 'T');

  // Если строка уже содержит timezone, оставляем как есть
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);

  if (hasTimezone) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Иначе парсим как ЛОКАЛЬНОЕ время
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );

  if (!match) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const [, year, month, day, hour, minute, second = '0', ms = '0'] = match;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(ms.padEnd(3, '0'))
  );

  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTimeLocal = (value) => {
  const date = parseDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

export const formatDateTimeShort = (value) => {
  const date = parseDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const dateTimeToLocalInputValue = (value) => {
  const date = parseDate(value);
  if (!date) return '';

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
};

export const utcToDateTimeLocalValue = dateTimeToLocalInputValue;