import Navbar from './components/Navbar/Navbar';
import React, { useEffect, useState, Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Navigate,
} from 'react-router-dom';
import { TaskProvider, useTasks } from './context/TaskContext';
import { getCurrentUser, refreshToken } from './api/auth';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Tasks = lazy(() => import('./pages/Tasks'));
const TaskDetails = lazy(() => import('./pages/TaskDetails'));
const TaskCreate = lazy(() => import('./pages/TaskCreate'));
const Categories = lazy(() => import('./pages/Categories'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Favourites = lazy(() => import('./pages/Favourites'));


function isTokenExpired(token) {
  try {
    const payloadBase64 = token.split('.')[1];
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);

    if (!payload.exp) return true;

    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}


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

  const loadCurrentUser = async () => {
    const data = await getCurrentUser();
    return data;
  };

    const checkAuth = async () => {
      setAuthChecking(true);

      try {
        const token = localStorage.getItem('access_token');

        if (!token) {
          clearAuth();
          return false;
        }

        // Если access token истёк — пробуем refresh
        if (isTokenExpired(token)) {
          const refresh = localStorage.getItem('refresh_token');

          if (!refresh) {
            clearAuth();
            return false;
          }

          const data = await refreshToken(refresh);

          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
        }

        const currentUser = await getCurrentUser();
        setUser(currentUser);
        setIsAuthenticated(true);
        await fetchTasks();
        return true;
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
      navigate('/tasks');
    }
  };

  const handleLogout = () => {
    clearAuth();
    if (typeof clearTasks === 'function') {
      clearTasks();
    }
    navigate('/');
  };

  if (authChecking) {
    return <div>Проверка авторизации...</div>;
  }

  return (
    <div>
      <Navbar
        isAuthenticated={isAuthenticated}
        user={user}
        isOnline={isOnline}
        onLogout={handleLogout}
      />

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
              isAuthenticated ? <Navigate to="/tasks" replace /> : <Login onLogin={handleLogin} />
            }
          />

          <Route
            path="/tasks"
            element={isAuthenticated ? <Tasks /> : <Navigate to="/login" replace />}
          />

            <Route
              path="/tasks/new"
              element={isAuthenticated ? <TaskCreate /> : <Navigate to="/login" replace />}
            />

          <Route
            path="/tasks/:id"
            element={isAuthenticated ? <TaskDetails /> : <Navigate to="/login" replace />}
          />

          <Route
            path="/categories"
            element={isAuthenticated ? <Categories /> : <Navigate to="/login" replace />}
          />

          <Route path="/about" element={<About />} />

          <Route
            path="/favourites"
            element={isAuthenticated ? <Favourites /> : <Navigate to="/login" replace />}
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