import React, { useEffect, useState, Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useNavigate,
  Navigate,
} from 'react-router-dom';
import { TaskProvider, useTasks } from './context/TaskContext';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const List = lazy(() => import('./pages/List'));
const Details = lazy(() => import('./pages/Details'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Favourites = lazy(() => import('./pages/Favourites'));

function AppContent() {
  const navigate = useNavigate();
  const { fetchTasks, clearTasks } = useTasks();

  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('access_token')
  );
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const clearAuth = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('favorites');
    setIsAuthenticated(false);
    setUser(null);
  };

  const refreshToken = async () => {
    const refresh = localStorage.getItem('refresh_token');

    if (!refresh) {
      throw new Error('Refresh token отсутствует');
    }

    const response = await fetch('http://localhost:8000/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refresh,
      }),
    });

    if (!response.ok) {
      throw new Error('Не удалось обновить токен');
    }

    const data = await response.json();

    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);

    return data.access_token;
  };

  const loadCurrentUser = async (token) => {
    const response = await fetch('http://localhost:8000/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Не удалось получить текущего пользователя');
    }

    return await response.json();
  };

  const checkAuth = async () => {
    setAuthChecking(true);

    try {
      let token = localStorage.getItem('access_token');

      if (!token) {
        clearAuth();
        return false;
      }

      try {
        const currentUser = await loadCurrentUser(token);
        setUser(currentUser);
        setIsAuthenticated(true);
        return true;
      } catch {
        token = await refreshToken();
        const currentUser = await loadCurrentUser(token);
        setUser(currentUser);
        setIsAuthenticated(true);
        return true;
      }
    } catch {
      clearAuth();
      return false;
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogin = async () => {
    const ok = await checkAuth();
    if (ok) {
      await fetchTasks();
      navigate('/list');
    }
  };

  const handleLogout = () => {
    clearAuth();
    clearTasks();
    navigate('/');
  };

  if (authChecking) {
    return <div>Проверка авторизации...</div>;
  }

  return (
    <div>
      <nav>
        <ul>
          <li>
            <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
              Главная
            </NavLink>
          </li>

          <li>
            <NavLink to="/list" className={({ isActive }) => (isActive ? 'active' : '')}>
              Список задач
            </NavLink>
          </li>

          <li>
            <NavLink to="/about" className={({ isActive }) => (isActive ? 'active' : '')}>
              О нас
            </NavLink>
          </li>

          {isAuthenticated && (
            <li>
              <NavLink
                to="/favourites"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Избранное
              </NavLink>
            </li>
          )}

          <li>
            <span style={{ color: isOnline ? 'green' : 'red' }}>
              {isOnline ? 'Онлайн' : 'Офлайн'}
            </span>
          </li>

          {isAuthenticated && user && (
            <li>
              <span>
                Пользователь: {user.first_name} {user.last_name}
              </span>
            </li>
          )}

          <li>
            {isAuthenticated ? (
              <button type="button" onClick={handleLogout}>
                Выход
              </button>
            ) : (
              <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : '')}>
                Вход
              </NavLink>
            )}
          </li>
        </ul>
      </nav>

      {!isOnline && (
        <div role="alert" style={{ background: '#ffe2e2', padding: '10px' }}>
          Нет подключения к интернету. Некоторые функции могут быть недоступны.
        </div>
      )}

      <Suspense fallback={<div>Загрузка страницы...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/list" replace /> : <Login onLogin={handleLogin} />
            }
          />

          <Route path="/list" element={<List />} />
          <Route path="/list/:id" element={<Details />} />
          <Route path="/about" element={<About />} />

          <Route
            path="/favourites"
            element={
              isAuthenticated ? <Favourites /> : <Navigate to="/login" replace />
            }
          />

          <Route path="*" element={<h2>404: Страница не найдена</h2>} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <Router>
      <TaskProvider>
        <AppContent />
      </TaskProvider>
    </Router>
  );
}

export default App;