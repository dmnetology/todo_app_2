import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Мокаем ленивые страницы
jest.mock('../pages/Home', () => () => <div>Home Page</div>);
jest.mock('../pages/List', () => () => <div>List Page</div>);
jest.mock('../pages/Details', () => () => <div>Details Page</div>);
jest.mock('../pages/Login', () => ({ onLogin }) => (
  <div>
    Login Page
    <button onClick={onLogin}>Login</button>
  </div>
));
jest.mock('../pages/About', () => () => <div>About Page</div>);
jest.mock('../pages/Favourites', () => () => <div>Favourites Page</div>);

// Мокаем TaskProvider и useTasks
jest.mock('../context/TaskContext', () => ({
  TaskProvider: ({ children }) => (
    <div data-testid="mock-task-provider">{children}</div>
  ),
  useTasks: () => ({
    tasks: [],
    loading: false,
    error: null,
    addTaskToFavorites: jest.fn(),
    removeTaskFromFavorites: jest.fn(),
    isFavorite: jest.fn(),
  }),
}));

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  test('рендерит навигацию и главную страницу по умолчанию', async () => {
    render(<App />);

    expect(screen.getByText('Главная')).toBeInTheDocument();
    expect(screen.getByText('Список задач')).toBeInTheDocument();
    expect(screen.getByText('О нас')).toBeInTheDocument();
    expect(screen.getByText('Вход')).toBeInTheDocument();

    expect(await screen.findByText('Home Page')).toBeInTheDocument();
  });

  test('отображает страницу логина, если пользователь не аутентифицирован и заходит на /login', async () => {
    window.history.pushState({}, '', '/login');

    render(<App />);

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  test('переходит на страницу списка задач при клике на навигацию', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByText('Список задач'));

    expect(await screen.findByText('List Page')).toBeInTheDocument();
  });

  test('отображает ссылку "Избранное" и кнопку "Выход" после аутентификации', async () => {
    localStorage.setItem('access_token', 'fake-token');
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText('Избранное')).toBeInTheDocument();
    expect(screen.getByText('Выход')).toBeInTheDocument();
    expect(screen.queryByText('Вход')).not.toBeInTheDocument();

    await user.click(screen.getByText('Выход'));

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('favorites')).toBeNull();

    expect(screen.getByText('Вход')).toBeInTheDocument();
    expect(screen.queryByText('Избранное')).not.toBeInTheDocument();
  });

  test('отображает 404 для неизвестного маршрута', async () => {
    window.history.pushState({}, '', '/non-existent-route');

    render(<App />);

    expect(await screen.findByText('404: Страница не найдена')).toBeInTheDocument();
  });
});