import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { getCurrentUser, refreshToken } from '../api/auth';

jest.mock('../api/auth', () => ({
  getCurrentUser: jest.fn(),
  refreshToken: jest.fn(),
}));

jest.mock('../components/Navbar/Navbar', () => {
  return function MockNavbar({
    isAuthenticated,
    isOnline,
    onLogout,
    onToggleTheme,
    theme,
  }) {
    return (
      <div>
        <div>Mock Navbar</div>
        <div>{isOnline ? 'Онлайн' : 'Офлайн'}</div>
        <div>{isAuthenticated ? 'Авторизован' : 'Не авторизован'}</div>
        <div>{theme}</div>
        <button onClick={onToggleTheme}>Переключить тему</button>
        {isAuthenticated ? (
          <button onClick={onLogout}>Выход</button>
        ) : (
          <div>Вход</div>
        )}
        {isAuthenticated && <div>Избранное</div>}
      </div>
    );
  };
});

jest.mock('../context/TaskContext', () => {
  const React = require('react');

  return {
    TaskProvider: ({ children }) => <div>{children}</div>,
    useTasks: () => ({
      fetchTasks: jest.fn(),
      clearTasks: jest.fn(),
    }),
  };
});

jest.mock('../pages/Home', () => () => <div>Home Page</div>);
jest.mock('../pages/Tasks', () => () => <div>Tasks Page</div>);
jest.mock('../pages/TaskDetails', () => () => <div>Task Details Page</div>);
jest.mock('../pages/TaskCreate', () => () => <div>Task Create Page</div>);
jest.mock('../pages/Categories', () => () => <div>Categories Page</div>);
jest.mock('../pages/About', () => () => <div>About Page</div>);
jest.mock('../pages/Login', () => {
  return function MockLogin({ onLogin }) {
    return (
      <div>
        Login Page
        <button onClick={onLogin}>Login</button>
      </div>
    );
  };
});
jest.mock('../pages/Favourites', () => () => <div>Favourites Page</div>);
jest.mock('../pages/SyncPage', () => () => <div>Sync Page</div>);

const createFakeJwt = () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    })
  );
  return `${header}.${payload}.signature`;
};

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    window.history.pushState({}, '', '/');
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  test('без токена на главной показывает Home Page', async () => {
    getCurrentUser.mockResolvedValue(null);

    render(<App />);

    expect(await screen.findByText(/Home Page/i)).toBeInTheDocument();
    expect(screen.getByText(/Вход/i)).toBeInTheDocument();
  });

  test('без токена на /login показывает Login Page', async () => {
    window.history.pushState({}, '', '/login');
    getCurrentUser.mockResolvedValue(null);

    render(<App />);

    expect(await screen.findByText(/Login Page/i)).toBeInTheDocument();
    expect(screen.getByText(/Вход/i)).toBeInTheDocument();
  });

  test('с валидным токеном на /tasks показывает Tasks Page', async () => {
    window.history.pushState({}, '', '/tasks');

    localStorage.setItem('access_token', createFakeJwt());
    localStorage.setItem('refresh_token', 'valid-refresh');

    getCurrentUser.mockResolvedValue({
      id: 1,
      username: 'Ivan',
    });

    refreshToken.mockResolvedValue({
      access_token: createFakeJwt(),
      refresh_token: 'new-refresh',
    });

    render(<App />);

    expect(await screen.findByText(/Tasks Page/i)).toBeInTheDocument();
    expect(screen.getByText(/Авторизован/i)).toBeInTheDocument();
    expect(screen.getByText(/Избранное/i)).toBeInTheDocument();
  });

  test('при нажатии на "Выход" очищает токены', async () => {
    window.history.pushState({}, '', '/tasks');

    localStorage.setItem('access_token', createFakeJwt());
    localStorage.setItem('refresh_token', 'valid-refresh');
    localStorage.setItem(
      'favorites',
      JSON.stringify([{ id: 1, title: 'Test task' }])
    );

    getCurrentUser.mockResolvedValue({
      id: 1,
      username: 'Ivan',
    });

    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText(/Выход/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Выход/i));

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('favorites')).toBeNull();
    });

    expect(screen.getByText(/Вход/i)).toBeInTheDocument();
    expect(screen.queryByText(/Избранное/i)).not.toBeInTheDocument();
  });

  test('при переходе в офлайн показывает предупреждение', async () => {
    getCurrentUser.mockResolvedValue(null);

    render(<App />);

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(
      screen.getByText(/Нет подключения к интернету/i)
    ).toBeInTheDocument();
  });

  test('при восстановлении соединения убирает предупреждение', async () => {
    getCurrentUser.mockResolvedValue(null);

    render(<App />);

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(
      screen.getByText(/Нет подключения к интернету/i)
    ).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(
      screen.queryByText(/Нет подключения к интернету/i)
    ).not.toBeInTheDocument();
  });

  test('при неизвестном пути показывает 404', async () => {
    window.history.pushState({}, '', '/unknown');
    getCurrentUser.mockResolvedValue(null);

    render(<App />);

    expect(
      await screen.findByText(/404: Страница не найдена/i)
    ).toBeInTheDocument();
  });
});