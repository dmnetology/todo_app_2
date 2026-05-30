import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';

const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem('favorites');
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });

  const getToken = useCallback(() => localStorage.getItem('access_token'), []);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getToken();

      if (!token) {
        setTasks([]);
        return;
      }

      const response = await fetch('http://localhost:8000/tasks', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }

      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addTaskToFavorites = useCallback((taskId) => {
    setFavorites((prevFavorites) => {
      if (!prevFavorites.includes(taskId)) {
        return [...prevFavorites, taskId];
      }
      return prevFavorites;
    });
  }, []);

  const removeTaskFromFavorites = useCallback((taskId) => {
    setFavorites((prevFavorites) => prevFavorites.filter((id) => id !== taskId));
  }, []);

  const isFavorite = useCallback(
    (taskId) => favorites.includes(taskId),
    [favorites]
  );

  const clearTasks = useCallback(() => {
    setTasks([]);
    setLoading(false);
    setError(null);
  }, []);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        loading,
        error,
        favorites,
        addTaskToFavorites,
        removeTaskFromFavorites,
        isFavorite,
        fetchTasks,
        clearTasks,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => useContext(TaskContext);