import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import { getTasks } from '../api/tasks';

const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(20);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem('favorites');
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });

    const fetchTasks = useCallback(async ({ skip = 0, limit = 20 } = {}) => {
      try {
        setLoading(true);
        setError(null);

        const data = await getTasks({ skip, limit });
        setTasks(data?.items || []);
        setTotal(data?.total || 0);
        setSkip(data?.skip || 0);
        setLimit(data?.limit || 20);
      } catch (err) {
        setError(err.message);
        setTasks([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, []);

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
    setTotal(0);
    setSkip(0);
    setLimit(20);
    setLoading(false);
    setError(null);
  }, []);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        total,
        skip,
        limit,
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