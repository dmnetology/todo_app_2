import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Tasks from '../pages/Tasks';

const mockNavigate = jest.fn();
const mockFetchTasks = jest.fn();
const mockAddTaskToFavorites = jest.fn();
const mockRemoveTaskFromFavorites = jest.fn();
const mockIsFavorite = jest.fn();
const mockUseTasks = jest.fn();

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}));

jest.mock('../context/TaskContext', () => ({
  useTasks: () => mockUseTasks(),
}));

jest.mock('../components/Dropdown/Dropdown', () => {
  return function MockDropdown({ id, label, value, onChange, options }) {
    return (
      <label htmlFor={id}>
        {label}
        <select id={id} value={value} onChange={onChange} data-testid={id}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  };
});

jest.mock('../utils/datetime', () => ({
  formatDateTimeShort: (value) => value || '—',
  parseDate: (value) => (value ? new Date(value) : null),
}));

jest.mock('../pages/TaskCreate', () => ({
  getClientTimezone: () => 'Europe/Moscow',
}));

describe('Tasks page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('access_token', 'test-token');

    mockIsFavorite.mockReturnValue(false);

    mockUseTasks.mockReturnValue({
      tasks: [],
      total: 0,
      limit: 20,
      loading: false,
      error: null,
      addTaskToFavorites: mockAddTaskToFavorites,
      removeTaskFromFavorites: mockRemoveTaskFromFavorites,
      isFavorite: mockIsFavorite,
      fetchTasks: mockFetchTasks,
    });

    global.fetch = jest.fn((url) => {
      if (url === 'http://localhost:8000/categories') {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 1, name: 'Работа' },
            { id: 2, name: 'Личное' },
          ],
        });
      }

      if (url === 'http://localhost:8000/tasks/ml/model-info') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            source: 'fallback',
          }),
        });
      }

      if (url === 'https://www.cbr-xml-daily.ru/daily_json.js') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Valute: {
              USD: { Value: 90.12 },
              EUR: { Value: 98.34 },
              CNY: { Value: 12.45 },
            },
          }),
        });
      }

      if (url.startsWith('https://api.open-meteo.com/v1/forecast')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            current: {
              temperature_2m: 23.4,
              weather_code: 1,
            },
          }),
        });
      }

      if (url.includes('/tasks/1/start')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    Object.defineProperty(window, 'navigator', {
      value: {
        geolocation: {
          getCurrentPosition: jest.fn((success) =>
            success({
              coords: {
                latitude: 55.75,
                longitude: 52.39,
              },
            })
          ),
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    if (console.error.mockRestore) {
      console.error.mockRestore();
    }
    localStorage.clear();
  });

  const renderTasksPage = async () => {
    render(<Tasks />);
    await waitFor(() => {
      expect(mockFetchTasks).toHaveBeenCalled();
    });
  };

  test('renders page header and create button', async () => {
    await renderTasksPage();

    expect(screen.getByText('Список задач')).toBeInTheDocument();
    expect(
      screen.getByText('Управление задачами, их статусами и параметрами.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Новая задача' })).toBeInTheDocument();
  });

  test('navigates to create page on click', async () => {
    await renderTasksPage();

    fireEvent.click(screen.getByRole('button', { name: '+ Новая задача' }));
    expect(mockNavigate).toHaveBeenCalledWith('/tasks/new');
  });

  test('shows empty state when no tasks', async () => {
    await renderTasksPage();

    expect(await screen.findByText('Задач не найдено.')).toBeInTheDocument();
    expect(screen.getByText('Количество задач: 0')).toBeInTheDocument();
  });

  test('renders tasks list', async () => {
    mockUseTasks.mockReturnValue({
      tasks: [
        {
          id: 1,
          title: 'Первая задача',
          status: 'new',
          priority: 'high',
          planned_start_local: '2026-06-13 10:00',
          actual_started_at: null,
          completed_at: null,
          estimated_minutes: 60,
          actual_minutes: null,
          category_id: 1,
        },
      ],
      total: 1,
      limit: 20,
      loading: false,
      error: null,
      addTaskToFavorites: mockAddTaskToFavorites,
      removeTaskFromFavorites: mockRemoveTaskFromFavorites,
      isFavorite: mockIsFavorite,
      fetchTasks: mockFetchTasks,
    });

    await renderTasksPage();

    expect(await screen.findByText('Первая задача')).toBeInTheDocument();
    expect(screen.getByText('Новая')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  test('opens task detail link', async () => {
    mockUseTasks.mockReturnValue({
      tasks: [
        {
          id: 5,
          title: 'Задача для перехода',
          status: 'new',
          priority: 'low',
          planned_start_local: '2026-06-13 10:00',
          actual_started_at: null,
          completed_at: null,
          estimated_minutes: 30,
          actual_minutes: null,
          category_id: 1,
        },
      ],
      total: 1,
      limit: 20,
      loading: false,
      error: null,
      addTaskToFavorites: mockAddTaskToFavorites,
      removeTaskFromFavorites: mockRemoveTaskFromFavorites,
      isFavorite: mockIsFavorite,
      fetchTasks: mockFetchTasks,
    });

    await renderTasksPage();

    const link = await screen.findByRole('link', { name: 'Задача для перехода' });
    expect(link).toHaveAttribute('href', '/tasks/5');
  });

  test('shows error state', () => {
    mockUseTasks.mockReturnValue({
      tasks: [],
      total: 0,
      limit: 20,
      loading: false,
      error: 'Ошибка загрузки',
      addTaskToFavorites: mockAddTaskToFavorites,
      removeTaskFromFavorites: mockRemoveTaskFromFavorites,
      isFavorite: mockIsFavorite,
      fetchTasks: mockFetchTasks,
    });

    render(<Tasks />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ошибка при загрузке задач: Ошибка загрузки'
    );
  });

  test('calls fetchTasks on mount with default params', async () => {
    await renderTasksPage();

    await waitFor(() => {
      expect(mockFetchTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          limit: 20,
          sort_by: 'planned_start_at_utc',
          sort_order: 'asc',
          planned_start_timezone: 'Europe/Moscow',
        })
      );
    });
  });

  test('adds favorite', async () => {
    mockUseTasks.mockReturnValue({
      tasks: [
        {
          id: 10,
          title: 'Избранная задача',
          status: 'new',
          priority: 'medium',
          planned_start_local: '2026-06-13 10:00',
          actual_started_at: null,
          completed_at: null,
          estimated_minutes: 45,
          actual_minutes: null,
          category_id: 1,
        },
      ],
      total: 1,
      limit: 20,
      loading: false,
      error: null,
      addTaskToFavorites: mockAddTaskToFavorites,
      removeTaskFromFavorites: mockRemoveTaskFromFavorites,
      isFavorite: () => false,
      fetchTasks: mockFetchTasks,
    });

    await renderTasksPage();

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Добавить задачу "Избранная задача" в избранное',
    });

    fireEvent.click(checkbox);
    expect(mockAddTaskToFavorites).toHaveBeenCalledWith(10);
  });

  test('renders task action button for new task', async () => {
    mockUseTasks.mockReturnValue({
      tasks: [
        {
          id: 1,
          title: 'Стартовая задача',
          status: 'new',
          priority: 'high',
          planned_start_local: '2026-06-13 10:00',
          actual_started_at: null,
          completed_at: null,
          estimated_minutes: 60,
          actual_minutes: null,
          category_id: 1,
        },
      ],
      total: 1,
      limit: 20,
      loading: false,
      error: null,
      addTaskToFavorites: mockAddTaskToFavorites,
      removeTaskFromFavorites: mockRemoveTaskFromFavorites,
      isFavorite: mockIsFavorite,
      fetchTasks: mockFetchTasks,
    });

    await renderTasksPage();

    const startButton = await screen.findByRole('button', { name: 'Начать выполнение' });
    expect(startButton).toBeInTheDocument();

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/tasks/1/start',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });
});