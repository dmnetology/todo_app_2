import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Мокаем TaskContext
jest.mock('../context/TaskContext', () => {
  const React = require('react');

  return {
    TaskProvider: ({ children }) => (
      <div data-testid="mock-task-provider">{children}</div>
    ),
    useTasks: () => ({
      fetchTasks: jest.fn(),
      clearTasks: jest.fn(),
    }),
  };
});

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    window.history.pushState({}, '', '/');

    global.fetch = jest.fn((url) => {
      if (typeof url === 'string' && url.includes('/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              first_name: 'Ivan',
              last_name: 'Ivanov',
              username: 'Ivan',
            }),
        });
      }

      if (typeof url === 'string' && url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }

      if (typeof url === 'string' && url.includes('/auth/logout')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('отображает основные пункты навигации', async () => {
    render(<App />);

    expect(await screen.findByText('Главная')).toBeInTheDocument();
    expect(screen.getByText('Список задач')).toBeInTheDocument();
    expect(screen.getByText('О нас')).toBeInTheDocument();
  });

  test('отображает кнопку "Вход" если пользователь не авторизован', async () => {
    render(<App />);

    expect(await screen.findByText('Вход')).toBeInTheDocument();
    expect(screen.queryByText('Выход')).not.toBeInTheDocument();
    expect(screen.queryByText('Избранное')).not.toBeInTheDocument();
  });

  test('отображает ссылку "Избранное" и кнопку "Выход" после аутентификации', async () => {
    localStorage.setItem('access_token', 'fake-token');
    localStorage.setItem('refresh_token', 'fake-refresh-token');

    render(<App />);

    expect(await screen.findByText('Избранное')).toBeInTheDocument();
    expect(screen.getByText('Выход')).toBeInTheDocument();
    expect(screen.queryByText('Вход')).not.toBeInTheDocument();
  });

  test('при нажатии на "Выход" очищает токены и возвращает кнопку "Вход"', async () => {
    localStorage.setItem('access_token', 'fake-token');
    localStorage.setItem('refresh_token', 'fake-refresh-token');
    localStorage.setItem('favorites', JSON.stringify([{ id: 1, title: 'Test task' }]));

    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText('Выход')).toBeInTheDocument();

    await user.click(screen.getByText('Выход'));

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('favorites')).toBeNull();
    });

    expect(screen.getByText('Вход')).toBeInTheDocument();
    expect(screen.queryByText('Выход')).not.toBeInTheDocument();
    expect(screen.queryByText('Избранное')).not.toBeInTheDocument();
  });

  test('отображает статус сети "Онлайн"', async () => {
    render(<App />);

    expect(await screen.findByText(/Онлайн/i)).toBeInTheDocument();
  });

  test('при переходе в офлайн отображает статус "Офлайн"', async () => {
    render(<App />);

    await act(async () => {
        window.dispatchEvent(new Event('offline'));
    });

    expect(await screen.findByText(/Офлайн/i)).toBeInTheDocument();
  });

  test('при восстановлении соединения отображает статус "Онлайн"', async () => {
    render(<App />);

    await act(async () => {
        window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByText(/Офлайн/i)).toBeInTheDocument();

    await act(async () => {
        window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByText(/Онлайн/i)).toBeInTheDocument();
  });
});