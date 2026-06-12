import { useMemo, useRef, useState } from 'react';
import './SyncPage.scss';

const API_BASE = 'http://localhost:8000/sync';

function getAuthHeaders() {
  const token = localStorage.getItem('access_token');

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function readErrorMessage(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();

      if (typeof data?.detail === 'string') {
        return data.detail;
      }

      if (data?.detail?.message) {
        const lines = [data.detail.message];

        if (Array.isArray(data.detail.errors)) {
          lines.push(
            ...data.detail.errors.map((item) => {
              const loc = Array.isArray(item.loc) ? item.loc.join('.') : '';
              return loc ? `${loc}: ${item.msg}` : item.msg;
            })
          );
        }

        return lines.join('\n');
      }

      if (Array.isArray(data?.detail)) {
        return data.detail
          .map((item) => {
            const loc = Array.isArray(item.loc) ? item.loc.join('.') : '';
            return loc ? `${loc}: ${item.msg}` : item.msg;
          })
          .join('\n');
      }

      if (typeof data?.message === 'string') {
        return data.message;
      }

      return JSON.stringify(data, null, 2);
    } catch {
      // fall through to text
    }
  }

  try {
    const text = await response.text();
    return text || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}


function SyncPage() {
  const [jsonFile, setJsonFile] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [jsonPreview, setJsonPreview] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const jsonInputRef = useRef(null);
  const csvInputRef = useRef(null);

  const canImportJson = useMemo(() => !!jsonFile, [jsonFile]);
  const canImportCsv = useMemo(() => !!csvFile, [csvFile]);

  const jsonSchemaHint = useMemo(
    () =>
      safeStringify({
        tasks: [
          {
            title: 'Завтрак',
            description: 'Утренний приём пищи',
            category_id: 1,
            priority: 'medium',
            status: 'new',
            planned_start_local: '2026-06-11T07:30:00',
            planned_start_timezone: 'Europe/Moscow',
            due_date: '2026-06-11T07:45:00',
          },
          {
            title: 'Созвон',
            description: 'Рабочий звонок',
            category_id: 2,
            priority: 'high',
            status: 'in_progress',
            planned_start_local: '2026-06-11T09:00:00',
            planned_start_timezone: 'Europe/Moscow',
            actual_started_at: '2026-06-11T09:05:00',
          },
          {
            title: 'Отчёт',
            description: 'Завершённый отчёт',
            category_id: 3,
            priority: 'high',
            status: 'completed',
            planned_start_local: '2026-06-10T18:00:00',
            planned_start_timezone: 'Europe/Moscow',
            actual_started_at: '2026-06-10T18:10:00',
            completed_at: '2026-06-10T19:20:00',
          },
        ],
      }),
    []
  );

  const csvSchemaHint = useMemo(
    () =>
      [
        'title,description,category_id,priority,status,planned_start_local,planned_start_timezone,due_date,actual_started_at,completed_at',
        'Завтрак,Утренний приём пищи,1,medium,new,2026-06-11 07:30,Europe/Moscow,2026-06-11 07:45,,',
        'Созвон,Рабочий звонок,2,high,in_progress,2026-06-11 09:00,Europe/Moscow,,2026-06-11 09:05,',
        'Отчёт,Финальный отчёт,3,high,completed,2026-06-10 18:00,Europe/Moscow,,2026-06-10 18:10,2026-06-10 19:20',
      ].join('\n'),
    []
  );

  const showResult = (type, title, details) => {
    setResult({
      type,
      title,
      details,
    });
  };

  const handleJsonFileChange = async (e) => {
    const file = e.target.files?.[0] ?? null;
    setJsonFile(file);

    if (file) {
      const text = await file.text();
      setJsonPreview(text);
    } else {
      setJsonPreview('');
    }
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setCsvFile(file);
  };

  const openJsonPicker = () => {
    jsonInputRef.current?.click();
  };

  const openCsvPicker = () => {
    csvInputRef.current?.click();
  };

  const clearJsonFile = () => {
    setJsonFile(null);
    setJsonPreview('');
    if (jsonInputRef.current) {
      jsonInputRef.current.value = '';
    }
  };

  const clearCsvFile = () => {
    setCsvFile(null);
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  const handleImportJson = async () => {
    if (!jsonFile) return;

    setBusy(true);
    setStatus('Импорт JSON...');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', jsonFile);

      const response = await fetch(`${API_BASE}/import/json`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
          const message = await readErrorMessage(
            response,
            `Ошибка импорта JSON: ${response.status}`
          );
          throw new Error(message);
        }

      const data = await response.json();

      showResult('success', 'JSON импортирован', [
        `Создано: ${data.tasks_created ?? 0}`,
        `Пропущено: ${data.tasks_skipped ?? 0}`,
        ...(Array.isArray(data.created_task_ids) && data.created_task_ids.length
          ? [`ID созданных задач: ${data.created_task_ids.join(', ')}`]
          : []),
        ...(Array.isArray(data.problems) ? data.problems : []),
      ]);

      setStatus('Импорт JSON завершён');
    } catch (error) {
      showResult('error', 'Ошибка импорта JSON', [error.message]);
      setStatus('Импорт JSON не выполнен');
    } finally {
      setBusy(false);
    }
  };

  const handleImportCsv = async () => {
    if (!csvFile) return;

    setBusy(true);
    setStatus('Импорт CSV...');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch(`${API_BASE}/import/csv`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
          const message = await readErrorMessage(
            response,
            `Ошибка импорта CSV: ${response.status}`
          );
          throw new Error(message);
        }

      const data = await response.json();

      showResult('success', 'CSV импортирован', [
        `Создано: ${data.tasks_created ?? 0}`,
        `Пропущено: ${data.tasks_skipped ?? 0}`,
        ...(Array.isArray(data.problems) ? data.problems : []),
      ]);

      setStatus('Импорт CSV завершён');
    } catch (error) {
      showResult('error', 'Ошибка импорта CSV', [error.message]);
      setStatus('Импорт CSV не выполнен');
    } finally {
      setBusy(false);
    }
  };

  const handleExportJson = async () => {
    setBusy(true);
    setStatus('Экспорт JSON...');
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/export/json`, {
        method: 'GET',
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Ошибка экспорта JSON: ${response.status}`);
      }

      const data = await response.json();
      const fileContent = JSON.stringify(data, null, 2);

      downloadFile(fileContent, 'tasks-export.json', 'application/json');

      showResult('success', 'JSON экспортирован', [
        'Файл скачан на устройство пользователя.',
      ]);

      setStatus('Экспорт JSON завершён');
    } catch (error) {
      showResult('error', 'Ошибка экспорта JSON', [error.message]);
      setStatus('Экспорт JSON не выполнен');
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = async () => {
    setBusy(true);
    setStatus('Экспорт CSV...');
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/export/csv`, {
        method: 'GET',
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Ошибка экспорта CSV: ${response.status}`);
      }

      const data = await response.json();

      const csvContent =
        typeof data === 'string'
          ? data
          : data.csv ?? data.content ?? data.tasks_csv ?? '';

      if (!csvContent) {
        throw new Error('CSV данные не найдены в ответе');
      }

      downloadFile(csvContent, 'tasks-export.csv', 'text/csv');

      showResult('success', 'CSV экспортирован', [
        'Файл скачан на устройство пользователя.',
      ]);

      setStatus('Экспорт CSV завершён');
    } catch (error) {
      showResult('error', 'Ошибка экспорта CSV', [error.message]);
      setStatus('Экспорт CSV не выполнен');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="sync-page">
      <div className="sync-page__container">
        <div className="sync-page__header">
          <div>
            <h1 className="sync-page__title">Синхронизация</h1>
            <p className="sync-page__subtitle">
              Импорт JSON и CSV выполняется через загрузку файла. Экспорт скачивает
              данные локально на устройство.
            </p>
          </div>

          <div className="sync-page__actions">
            <button
              type="button"
              className="sync-page__button sync-page__button--primary"
              onClick={handleExportJson}
              disabled={busy}
            >
              Экспорт JSON
            </button>

            <button
              type="button"
              className="sync-page__button sync-page__button--primary"
              onClick={handleExportCsv}
              disabled={busy}
            >
              Экспорт CSV
            </button>
          </div>
        </div>

        {status && (
          <div className="sync-page__status" role="status" aria-live="polite">
            {status}
          </div>
        )}

        <section className="sync-page__grid">
          <article className="sync-card">
            <div className="sync-card__head">
              <h2 className="sync-card__title">Импорт JSON</h2>
              <p className="sync-card__text">
                Загрузите JSON-файл. Ниже показана ожидаемая структура данных.
              </p>
            </div>

            <label className="sync-page__label">Файл JSON</label>

            <input
              ref={jsonInputRef}
              id="json-file"
              type="file"
              accept=".json,application/json"
              className="sync-page__file-input--hidden"
              onChange={handleJsonFileChange}
            />

            <div className="sync-page__file-picker">
              <button
                type="button"
                className="sync-page__button sync-page__button--file"
                onClick={openJsonPicker}
              >
                Выберите файл
              </button>

              <button
                type="button"
                className="sync-page__button sync-page__button--ghost sync-page__button--clear"
                onClick={clearJsonFile}
                disabled={!jsonFile}
              >
                Очистить
              </button>

              <div className="sync-page__file-name">
                {jsonFile ? jsonFile.name : 'Файл не выбран'}
              </div>
            </div>

            <div className="sync-page__hint">
              <div className="sync-page__hint-title">Ожидаемая схема</div>
              <pre className="sync-page__hint-code">{jsonSchemaHint}</pre>
            </div>

            <div className="sync-page__preview">
              <div className="sync-page__hint-title">Предпросмотр файла</div>
              {jsonPreview ? (
                <pre className="sync-page__hint-code">{jsonPreview}</pre>
              ) : (
                <div className="sync-page__empty-small">Файл ещё не выбран.</div>
              )}
            </div>

            <div className="sync-card__footer">
              <button
                type="button"
                className="sync-page__button"
                onClick={handleImportJson}
                disabled={busy || !canImportJson}
              >
                Импорт JSON
              </button>
            </div>
          </article>

          <article className="sync-card">
            <div className="sync-card__head">
              <h2 className="sync-card__title">Импорт CSV</h2>
              <p className="sync-card__text">
                Загрузите один CSV-файл с задачами.
              </p>
            </div>

            <label className="sync-page__label">Файл CSV</label>

            <input
              ref={csvInputRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="sync-page__file-input--hidden"
              onChange={handleCsvFileChange}
            />

            <div className="sync-page__file-picker">
              <button
                type="button"
                className="sync-page__button sync-page__button--file"
                onClick={openCsvPicker}
              >
                Выберите файл
              </button>

              <button
                type="button"
                className="sync-page__button sync-page__button--ghost sync-page__button--clear"
                onClick={clearCsvFile}
                disabled={!csvFile}
              >
                Очистить
              </button>

              <div className="sync-page__file-name">
                {csvFile ? csvFile.name : 'Файл не выбран'}
              </div>
            </div>

            <div className="sync-page__hint">
              <div className="sync-page__hint-title">Ожидаемая схема CSV</div>
              <pre className="sync-page__hint-code">{csvSchemaHint}</pre>
            </div>

            <div className="sync-card__footer">
              <button
                type="button"
                className="sync-page__button"
                onClick={handleImportCsv}
                disabled={busy || !canImportCsv}
              >
                Импорт CSV
              </button>
            </div>
          </article>
        </section>

        <section className="sync-page__result">
          <h2 className="sync-page__result-title">Результат</h2>

          {result ? (
            <div className={`sync-result sync-result--${result.type}`}>
              <div className="sync-result__title">{result.title}</div>
              <ul className="sync-result__list">
                {result.details.map((item, index) => (
                  <li key={index} className="sync-result__item">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="sync-page__empty">
              Здесь будет отображаться результат импорта или экспорта.
              <br />
              Для JSON ожидается файл с объектом, содержащим список задач и связанные
              данные.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default SyncPage;