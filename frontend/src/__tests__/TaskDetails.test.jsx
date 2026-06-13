import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import TaskDetails from '../pages/TaskDetails';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn();
const mockFetchTasks = jest.fn();
const mockFetch = jest.fn();

const mockAccessToken = 'mock-jwt-token';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('../context/TaskContext', () => ({
  useTasks: () => ({
    fetchTasks: mockFetchTasks,
  }),
}));

jest.mock('../utils/datetime', () => ({
  formatDateTimeLocal: jest.fn((value) => value || '—'),
}));

jest.mock('../components/Tasks/TaskForm', () => {
  return function MockTaskForm({
    initialValues,
    categories,
    onSubmit,
    onCancel,
    submitText,
    loading,
  }) {
    return (
      <div>
        <div data-testid="task-form-title">{initialValues?.title}</div>
        <div data-testid="task-form-category">{String(initialValues?.category_id ?? '')}</div>
        <div data-testid="task-form-loading">{loading ? 'loading' : 'idle'}</div>
        <div data-testid="task-form-submit-text">{submitText}</div>
        <div data-testid="task-form-categories">
          {Array.isArray(categories) ? categories.map((c) => c.name).join(', ') : ''}
        </div>

        <button type="button" onClick={() => onSubmit(initialValues)}>
          submit-form
        </button>

        <button type="button" onClick={onCancel}>
          cancel-form
        </button>
      </div>
    );
  };
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockUseParams.mockClear();
  mockFetchTasks.mockClear();
  mockFetch.mockClear();

  const localStorageMock = (() => {
    let store = {};
    return {
      getItem(key) {
        return store[key] || null;
      },
      setItem(key, value) {
        store[key] = String(value);
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

  window.confirm = jest.fn(() => true);
  global.fetch = mockFetch;

  mockFetch.mockImplementation((url, options = {}) => {
    if (url === 'http://localhost:8000/categories') {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 1, name: 'Работа' },
          { id: 2, name: 'Личное' },
        ],
      });
    }

    if (url === 'http://localhost:8000/tasks/1' && (!options.method || options.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 1,
          title: 'Тестовая задача',
          description: 'Описание тестовой задачи',
          category_id: 1,
          priority: 'high',
          due_date: '2026-06-20T10:00',
          planned_start_local: '2026-06-19T09:00',
          planned_start_timezone: 'Europe/Moscow',
          estimated_minutes: 120,
          actual_minutes: 90,
          status: 'new',
          created_at: '2026-06-18T08:00',
          actual_started_at: null,
          current_started_at: null,
          completed_at: null,
        }),
      });
    }

    if (url === 'http://localhost:8000/tasks/new') {
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    }

    if (
      url === 'http://localhost:8000/tasks/1/start' ||
      url === 'http://localhost:8000/tasks/1/cancel' ||
      url === 'http://localhost:8000/tasks/1/pause' ||
      url === 'http://localhost:8000/tasks/1/complete' ||
      url === 'http://localhost:8000/tasks/1/resume'
    ) {
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    }

    if (url === 'http://localhost:8000/tasks/1' && options.method === 'PUT') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 1,
        }),
      });
    }

    if (url === 'http://localhost:8000/tasks/1' && options.method === 'DELETE') {
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    }

    if (url === 'http://localhost:8000/tasks' && options.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 99,
        }),
      });
    }

    return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
  });
});

describe('TaskDetails', () => {
  test('загружает задачу и отображает данные', async () => {
    mockUseParams.mockReturnValue({ id: '1' });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Тестовая задача' })).toBeInTheDocument();
    });

    expect(screen.getByText('Описание тестовой задачи')).toBeInTheDocument();
    expect(screen.getByText('Новая')).toBeInTheDocument();
    expect(screen.getByText('Работа')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('2026-06-19T09:00')).toBeInTheDocument();
    expect(screen.getByText('Europe/Moscow')).toBeInTheDocument();
    expect(screen.getByText('120 мин.')).toBeInTheDocument();
    expect(screen.getByText('90 мин.')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Начать выполнение' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Копировать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument();
  });

  test('отображает ошибку при неудачной загрузке задачи', async () => {
    mockUseParams.mockReturnValue({ id: '1' });

    mockFetch.mockImplementationOnce((url) => {
      if (url === 'http://localhost:8000/tasks/1') {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ detail: 'Not found' }),
        });
      }

      if (url === 'http://localhost:8000/categories') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ошибка загрузки задачи: 404');
    });

    expect(screen.getByText('Вернуться к списку задач')).toBeInTheDocument();
  });

  test('переходит в режим редактирования и показывает TaskForm', async () => {
    const user = userEvent.setup();
    mockUseParams.mockReturnValue({ id: '1' });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Тестовая задача' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Редактировать' }));

    expect(screen.getByRole('heading', { name: 'Редактирование задачи' })).toBeInTheDocument();
    expect(screen.getByTestId('task-form-title')).toHaveTextContent('Тестовая задача');
    expect(screen.getByTestId('task-form-submit-text')).toHaveTextContent('Обновить');
    expect(screen.getByTestId('task-form-categories')).toHaveTextContent('Работа, Личное');
  });

  test('обновляет задачу через TaskForm', async () => {
    const user = userEvent.setup();
    mockUseParams.mockReturnValue({ id: '1' });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Тестовая задача' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Редактировать' }));
    await user.click(screen.getByRole('button', { name: 'submit-form' }));

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/tasks/1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockAccessToken}`,
          'Content-Type': 'application/json',
        }),
      })
    );

    expect(mockFetchTasks).toHaveBeenCalled();
  });

  test('создает новую задачу в режиме new', async () => {
    const user = userEvent.setup();
    mockUseParams.mockReturnValue({ id: 'new' });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Новая задача' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Создание задачи' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'submit-form' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'submit-form' }));

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockAccessToken}`,
          'Content-Type': 'application/json',
        }),
      })
    );

    expect(mockFetchTasks).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/tasks/99');
  });

  test('копирует задачу', async () => {
    const user = userEvent.setup();
    mockUseParams.mockReturnValue({ id: '1' });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Тестовая задача' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Копировать' }));

    expect(mockNavigate).toHaveBeenCalledWith('/tasks/new', {
      state: {
        mode: 'copy',
        task: expect.objectContaining({
          id: 1,
          title: 'Тестовая задача',
        }),
      },
    });
  });

  test('удаляет задачу после подтверждения', async () => {
    const user = userEvent.setup();
    mockUseParams.mockReturnValue({ id: '1' });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Тестовая задача' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(window.confirm).toHaveBeenCalledWith('Удалить задачу?');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/tasks/1',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
        },
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith('/tasks');
  });

  test('выполняет действие start для новой задачи', async () => {
    const user = userEvent.setup();
    mockUseParams.mockReturnValue({ id: '1' });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Тестовая задача' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Начать выполнение' }));

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/tasks/1/start',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockAccessToken}`,
          'Content-Type': 'application/json',
        }),
      })
    );

    expect(mockFetchTasks).toHaveBeenCalled();
  });

  test('отображает кнопки для статуса in_progress', async () => {
    mockUseParams.mockReturnValue({ id: '1' });

    mockFetch.mockImplementation((url) => {
      if (url === 'http://localhost:8000/categories') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 1, name: 'Работа' }],
        });
      }

      if (url === 'http://localhost:8000/tasks/1') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 1,
            title: 'В работе',
            description: 'Текущая задача',
            category_id: 1,
            priority: 'medium',
            status: 'in_progress',
            planned_start_local: null,
            planned_start_timezone: 'Europe/Moscow',
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    await act(async () => {
      render(<TaskDetails />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'В работе' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Задача выполнена' })).toBeInTheDocument();
  });
});