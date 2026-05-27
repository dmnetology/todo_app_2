import React, { useEffect, useState, Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useNavigate,
} from 'react-router-dom';
import { TaskProvider } from './context/TaskContext';
import './App.css';

// Ленивый импорт страниц
const Home = lazy(() => import('./pages/Home'));
const List = lazy(() => import('./pages/List'));
const Details = lazy(() => import('./pages/Details'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Favourites = lazy(() => import('./pages/Favourites'));

function AppContent() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('access_token')
  );

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('access_token'));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('favorites');
    setIsAuthenticated(false);
    navigate('/');
  };

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

      <Suspense fallback={<div>Загрузка страницы...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/login"
            element={<Login onLogin={() => setIsAuthenticated(true)} />}
          />
          <Route path="/list" element={<List />} />
          <Route path="/list/:id" element={<Details />} />
          <Route path="/about" element={<About />} />
          {isAuthenticated && <Route path="/favourites" element={<Favourites />} />}
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