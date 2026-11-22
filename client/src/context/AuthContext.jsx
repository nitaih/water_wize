import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  getStoredActiveFarmId,
  getStoredToken,
  setStoredActiveFarmId,
  setStoredToken
} from '../services/api';
import { getCurrentUser, getMyFarms, loginUser } from '../services/farmService';

const AuthContext = createContext(null);

function extractFarmRole(farm) {
  return (
    farm?.role ||
    farm?.userRole ||
    farm?.membership?.role ||
    farm?.userFarms?.[0]?.role ||
    null
  );
}

function normalizeFarmsResponse(farmsRes) {
  if (Array.isArray(farmsRes)) return farmsRes;
  if (Array.isArray(farmsRes?.data)) return farmsRes.data;
  if (Array.isArray(farmsRes?.farms)) return farmsRes.farms;
  return [];
}

function normalizeUserResponse(meRes) {
  return meRes?.data || meRes?.user || meRes || null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [farms, setFarms] = useState([]);
  const [activeFarmId, setActiveFarmIdState] = useState(() => getStoredActiveFarmId());
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()));
  const [error, setError] = useState(null);

  const logout = useCallback(() => {
    setStoredToken(null);
    setStoredActiveFarmId(null);
    setToken(null);
    setUser(null);
    setFarms([]);
    setActiveFarmIdState(null);
    setError(null);
  }, []);

  const selectFarm = useCallback((farmId) => {
    const resolvedId = farmId || null;
    setActiveFarmIdState(resolvedId);
    setStoredActiveFarmId(resolvedId);
  }, []);

  const refreshSession = useCallback(
    async (authToken = getStoredToken()) => {
      if (!authToken) {
        setUser(null);
        setFarms([]);
        setActiveFarmIdState(null);
        setStoredActiveFarmId(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const farmsRes = await getMyFarms();
        const farmList = normalizeFarmsResponse(farmsRes);
        setFarms(farmList);

        let currentUser = null;
        try {
          const meRes = await getCurrentUser();
          currentUser = normalizeUserResponse(meRes);
        } catch (meErr) {
          if (meErr?.status !== 404) {
            throw meErr;
          }
          currentUser = { authenticated: true };
        }

        setUser(currentUser);

        const savedFarmId = getStoredActiveFarmId();
        const isSavedFarmValid = farmList.some((f) => f.id === savedFarmId);
        const nextFarmId = isSavedFarmValid
          ? savedFarmId
          : (farmList[0]?.id || null);

        setActiveFarmIdState(nextFarmId);
        setStoredActiveFarmId(nextFarmId);
      } catch (err) {
        if (err?.status === 401) {
          logout();
        } else {
          setError(
            err?.message === 'Failed to fetch'
              ? 'לא ניתן להתחבר לשרת. בדוק שה-Backend רץ ושהפורט ב-VITE_API_URL תואם.'
              : (err?.message || 'Failed to load session data.')
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [logout]
  );

  useEffect(() => {
    refreshSession(token);
  }, [token, refreshSession]);

  const login = useCallback(
    async (credentials) => {
      setLoading(true);
      setError(null);

      try {
        const res = await loginUser(credentials);
        const receivedToken = res?.token || res?.data?.token;

        if (!receivedToken) {
          throw new Error('Authentication token was not returned by server.');
        }

        setStoredToken(receivedToken);
        setToken(receivedToken);
        await refreshSession(receivedToken);
        return res;
      } catch (err) {
        const message =
          err?.message === 'Failed to fetch'
            ? 'לא ניתן להתחבר לשרת. בדוק שה-Backend רץ.'
            : (err?.message || 'Login failed.');
        setError(message);
        setLoading(false);
        throw err;
      }
    },
    [refreshSession]
  );

  const activeFarm = useMemo(
    () => farms.find((f) => f.id === activeFarmId) || null,
    [farms, activeFarmId]
  );

  const role = useMemo(
    () => (activeFarm ? extractFarmRole(activeFarm) : null),
    [activeFarm]
  );

  const permissions = useMemo(
    () => ({
      role,
      canEdit: role === 'CREATOR' || role === 'EDITOR',
      canDelete: role === 'CREATOR',
      isViewer: role === 'VIEWER'
    }),
    [role]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      farms,
      activeFarmId,
      activeFarm,
      loading,
      error,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      selectFarm,
      refreshSession,
      ...permissions
    }),
    [
      token,
      user,
      farms,
      activeFarmId,
      activeFarm,
      loading,
      error,
      login,
      logout,
      selectFarm,
      refreshSession,
      permissions
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;