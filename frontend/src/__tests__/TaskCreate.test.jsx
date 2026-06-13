import React, { useState, useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import * as TaskCreateModule from '../pages/TaskCreate';
import TaskCreate from '../pages/TaskCreate';

const mockNavigate = jest.fn();
const mockUseLocation = jest.fn();
const mockFetchTasks = jest.fn();
const mockFetch = jest.fn();

const mockAccessToken = 'mock-jwt-token';

const mockResolvedOptions = jest.fn(() => ({ timeZone: 'Europe/Moscow' }));

global.Intl = {
  DateTimeFormat: jest.fn(() => ({
    resolvedOptions: mockResolvedOptions,
  })),
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

jest.mock('../context/TaskContext', () => ({
  useTasks: () => ({
    fetchTasks: mockFetchTasks,
  }),
}));

function MockTaskForm({
  initialValues,
  onSubmit,
  submitText,
  loading,
  categories,
  readOnlyFields,
  hideFields,
  onCancel,
}) {
  const [formData, setFormData] = useState(initialValues);

  useEffect(() => {
    setFormData({ ...initialValues });
  }, [initialValues]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="title"
        data-testid="task-form-title"
        value={formData.title || ''}
        onChange={handleChange}
        readOnly={readOnlyFields?.includes('title') || hideFields?.includes('title')}
        placeholder="Название задачи"
      />

      <textarea
        name="description"
        data-testid="task-form-description"
        value={formData.description || ''}
        onChange={handleChange}
        readOnly={readOnlyFields?.includes('description') || hideFields?.includes('description')}
        placeholder="Описание задачи"
      />

      <select
        name="category_id"
        data-testid="task-form-category"
        value={formData.category_id ?? ''}
        onChange={handleChange}
        readOnly={readOnlyFields?.includes('category_id') || hideFields?.includes('category_id')}
      >
        <option value="">Выберите категорию</option>
        {categories?.map((cat) => (
          <option key={cat.id} value={String(cat.id)}>
            {cat.name}
          </option>
        ))}
      </select>

      <select
        name="priority"
        data-testid="task-form-priority"
        value={formData.priority || 'medium'}
        onChange={handleChange}
        readOnly={readOnlyFields?.includes('priority') || hideFields?.includes('priority')}
      >
        <option value="low">Низкий</option>
        <option value="medium">Средний</option>
        <option value="high">Высокий</option>
      </select>

      {!(hideFields?.includes('due_date')) && (
        <input
          name="due_date"
          data-testid="task-form-due-date"
          type="date"
          value={formData.due_date || ''}
          onChange={handleChange}
          readOnly={readOnlyFields?.includes('due_date')}
        />
      )}

      {!(hideFields?.includes('planned_start_local')) && (
        <input
          name="planned_start_local"
          data-testid="task-form-planned-start-local"
          type="datetime-local"
          value={formData.planned_start_local || ''}
          onChange={handleChange}
          readOnly={readOnlyFields?.includes('planned_start_local')}
        />
      )}

      <button type="submit" disabled={loading}>
        {submitText}
      </button>

      {onCancel && (
        <button type="button" onClick={onCancel}>
          Отмена
        </button>
      )}
    </form>
  );
}

jest.mock('../components/Tasks/TaskForm', () => MockTaskForm);

beforeEach(() => {
  mockFetch.mockClear();
  mockNavigate.mockClear();
  mockUseLocation.mockClear();
  mockFetchTasks.mockClear();
  mockResolvedOptions.mockClear();

  const localStorageMock = (function () {
    let store = {};
    return {
      getItem(key) {
        return store[key] || null;
      },
      setItem(key, value) {
        store[key] = value.toString();
      },
      clear() {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  localStorageMock.setItem('access_token', mockAccessToken);

  mockUseLocation.mockReturnValue({ state: null });

  mockFetch.mockImplementation((url) => {
    if (url.includes('/categories')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: 1, name: 'Работа' },
            { id: 2, name: 'Личное' },
          ]),
      });
    }

    return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
  });

  global.fetch = mockFetch;
});

describe('TaskCreate Component', () => {
  let getClientTimezoneSpy;

  beforeAll(() => {
    getClientTimezoneSpy = jest.spyOn(TaskCreateModule, 'getClientTimezone');
  });

  afterAll(() => {
    getClientTimezoneSpy.mockRestore();
  });

  beforeEach(() => {
    getClientTimezoneSpy.mockClear();
  });

  test('отображает компонент TaskCreate и успешно загружает категории', async () => {
    render(<TaskCreate />);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/categories',
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
          'Content-Type': 'application/json',
        },
      })
    );

    expect(await screen.findByText('Работа')).toBeInTheDocument();
    expect(screen.getByText('Личное')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Новая задача/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать/i })).toBeInTheDocument();
  });

  test('отображает сообщение об ошибке, если загрузка категорий не удалась', async () => {
    mockFetch.mockImplementationOnce((url) => {
      if (url.includes('/categories')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Internal server error' }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<TaskCreate />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ошибка загрузки категорий: 500/i);
  });

  test('позволяет пользователю заполнить форму и успешно создать новую задачу', async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url) => {
      if (url.includes('/categories')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 1, name: 'Работа' },
              { id: 2, name: 'Личное' },
            ]),
        });
      }

      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 10,
              title: 'Тестовая задача',
              category_id: 1,
              planned_start_timezone: 'Europe/Moscow',
            }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<TaskCreate />);

    await screen.findByText('Работа');

    const titleInput = screen.getByTestId('task-form-title');
    const categorySelect = screen.getByTestId('task-form-category');
    const submitButton = screen.getByRole('button', { name: /Создать/i });

    await user.clear(titleInput);
    await user.type(titleInput, 'Моя новая задача');
    await user.selectOptions(categorySelect, '1');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/tasks',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mockAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Моя новая задача',
            description: '',
            category_id: 1,
            priority: 'medium',
            due_date: null,
            planned_start_local: null,
            planned_start_timezone: 'Europe/Moscow',
          }),
        })
      );
    });

    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/tasks/10');
    });
  });

  test('отображает сообщение об ошибке, если создание задачи не удалось', async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url) => {
      if (url.includes('/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 1, name: 'Работа' }]),
        });
      }

      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ detail: 'Неверные данные' }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<TaskCreate />);

    await screen.findByText('Работа');

    const titleInput = screen.getByTestId('task-form-title');
    const categorySelect = screen.getByTestId('task-form-category');
    const submitButton = screen.getByRole('button', { name: /Создать/i });

    await user.type(titleInput, 'Задача с ошибкой');
    await user.selectOptions(categorySelect, '1');
    await user.click(submitButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Неверные данные/i);

    expect(mockFetchTasks).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('корректно отображает форму в режиме копирования (copyMode)', async () => {
    mockUseLocation.mockReturnValue({
      state: {
        mode: 'copy',
        task: {
          id: 5,
          title: 'Исходная задача',
          description: 'Описание исходной задачи',
          category_id: 1,
          priority: 'high',
          due_date: '2026-07-01',
          planned_start_local: '2026-06-15T10:00',
          planned_start_timezone: 'Europe/Moscow',
        },
      },
    });

    render(<TaskCreate />);

    expect(
      await screen.findByRole('heading', { name: /Копирование задачи/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/Заполните параметры копирования/i)).toBeInTheDocument();
    expect(await screen.findByTestId('task-form-title')).toHaveValue('Исходная задача');
    expect(await screen.findByTestId('task-form-category')).toHaveValue('1');
    expect(screen.getByLabelText(/Режим/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Дата и время/i)).toHaveValue('2026-06-15T10:00');
    expect(screen.getByRole('button', { name: /Создать копии/i })).toBeInTheDocument();
  });

  test('создает одну копию задачи в режиме "single" с указанной датой и временем', async () => {
    const user = userEvent.setup();

    mockUseLocation.mockReturnValue({
      state: {
        mode: 'copy',
        task: {
          id: 5,
          title: 'Исходная задача',
          description: 'Описание задачи',
          category_id: 1,
          priority: 'high',
          planned_start_timezone: 'Europe/Moscow',
          due_date: '2026-06-30',
        },
      },
    });

    mockFetch.mockImplementation((url) => {
      if (url.includes('/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 1, name: 'Работа' }]),
        });
      }

      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 11,
              title: 'Копия задачи',
              planned_start_local: '2026-06-20T11:30',
            }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<TaskCreate />);

    expect(await screen.findByLabelText(/Дата и время/i)).toBeInTheDocument();

    const singleDateTimeInput = screen.getByLabelText(/Дата и время/i);
    const submitButton = screen.getByRole('button', { name: /Создать копии/i });

    await user.clear(singleDateTimeInput);
    await user.type(singleDateTimeInput, '2026-06-20T11:30');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            title: 'Исходная задача',
            description: 'Описание задачи',
            category_id: 1,
            priority: 'high',
            due_date: null,
            planned_start_local: '2026-06-20T11:30',
            planned_start_timezone: 'Europe/Moscow',
          }),
        })
      );
    });

    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/tasks/11');
    });
  });

  test('создает несколько копий задачи в режиме "range"', async () => {
    const user = userEvent.setup();

    mockUseLocation.mockReturnValue({
      state: {
        mode: 'copy',
        task: {
          id: 5,
          title: 'Исходная задача для диапазона',
          description: 'Описание для диапазона',
          category_id: 1,
          priority: 'high',
          planned_start_timezone: 'Europe/Moscow',
          due_date: '2026-07-01',
        },
      },
    });

    mockFetch.mockImplementation((url) => {
      if (url.includes('/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 1, name: 'Работа' }]),
        });
      }

      if (url.includes('/tasks')) {
        const taskId = Math.floor(Math.random() * 100) + 100;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: taskId, title: 'Копия' }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<TaskCreate />);

    expect(await screen.findByLabelText(/Режим/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Режим/i), 'range');

    const rangeFromInput = screen.getByLabelText(/Дата начала/i);
    const rangeToInput = screen.getByLabelText(/Дата окончания/i);
    const rangeTimeInput = screen.getByLabelText(/Время/i);
    const submitButton = screen.getByRole('button', { name: /Создать копии/i });

    await user.type(rangeFromInput, '2026-06-15');
    await user.type(rangeToInput, '2026-06-17');
    await user.type(rangeTimeInput, '09:00');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Исходная задача для диапазона',
          description: 'Описание для диапазона',
          category_id: 1,
          priority: 'high',
          due_date: null,
          planned_start_local: '2026-06-15T09:00',
          planned_start_timezone: 'Europe/Moscow',
        }),
      })
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Исходная задача для диапазона',
          description: 'Описание для диапазона',
          category_id: 1,
          priority: 'high',
          due_date: null,
          planned_start_local: '2026-06-16T09:00',
          planned_start_timezone: 'Europe/Moscow',
        }),
      })
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Исходная задача для диапазона',
          description: 'Описание для диапазона',
          category_id: 1,
          priority: 'high',
          due_date: null,
          planned_start_local: '2026-06-17T09:00',
          planned_start_timezone: 'Europe/Moscow',
        }),
      })
    );

    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/tasks\/\d+/));
    });
  });

  test('отображает ошибку копирования, если не указана дата/время в режиме single', async () => {
    const user = userEvent.setup();

    mockUseLocation.mockReturnValue({
      state: {
        mode: 'copy',
        task: {
          id: 5,
          title: 'Исходная задача',
          category_id: 1,
          priority: 'high',
          planned_start_timezone: 'Europe/Moscow',
        },
      },
    });

    render(<TaskCreate />);

    expect(await screen.findByLabelText(/Дата и время/i)).toBeInTheDocument();

    const singleDateTimeInput = screen.getByLabelText(/Дата и время/i);
    const submitButton = screen.getByRole('button', { name: /Создать копии/i });

    await user.clear(singleDateTimeInput);
    await user.click(submitButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Укажите дату и время/i);

    expect(mockFetch).not.toHaveBeenCalledWith('http://localhost:8000/tasks', expect.anything());
  });

  test('отображает ошибку копирования, если не указан диапазон дат в режиме range', async () => {
    const user = userEvent.setup();

    mockUseLocation.mockReturnValue({
      state: {
        mode: 'copy',
        task: {
          id: 5,
          title: 'Исходная задача',
          category_id: 1,
          priority: 'high',
          planned_start_timezone: 'Europe/Moscow',
        },
      },
    });

    render(<TaskCreate />);

    expect(await screen.findByLabelText(/Режим/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Режим/i), 'range');

    const rangeFromInput = screen.getByLabelText(/Дата начала/i);
    const rangeToInput = screen.getByLabelText(/Дата окончания/i);
    const rangeTimeInput = screen.getByLabelText(/Время/i);
    const submitButton = screen.getByRole('button', { name: /Создать копии/i });

    await user.clear(rangeFromInput);
    await user.clear(rangeToInput);
    await user.type(rangeTimeInput, '09:00');
    await user.click(submitButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Укажите корректный диапазон дат/i);

    expect(mockFetch).not.toHaveBeenCalledWith('http://localhost:8000/tasks', expect.anything());
  });

  test('отображает ошибку копирования, если не указано время в режиме range', async () => {
    const user = userEvent.setup();

    mockUseLocation.mockReturnValue({
      state: {
        mode: 'copy',
        task: {
          id: 5,
          title: 'Исходная задача',
          category_id: 1,
          priority: 'high',
          planned_start_timezone: 'Europe/Moscow',
        },
      },
    });

    render(<TaskCreate />);

    expect(await screen.findByLabelText(/Режим/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Режим/i), 'range');

    const rangeFromInput = screen.getByLabelText(/Дата начала/i);
    const rangeToInput = screen.getByLabelText(/Дата окончания/i);
    const rangeTimeInput = screen.getByLabelText(/Время/i);
    const submitButton = screen.getByRole('button', { name: /Создать копии/i });

    await user.type(rangeFromInput, '2026-06-15');
    await user.type(rangeToInput, '2026-06-15');
    await user.clear(rangeTimeInput);
    await user.click(submitButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Укажите время/i);

    expect(mockFetch).not.toHaveBeenCalledWith('http://localhost:8000/tasks', expect.anything());
  });
});