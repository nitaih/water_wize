// import logo from './logo.svg';
import './App.css';

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import WaterMap from './components/WaterMap';

function LoginScreen() {
  const { login, error, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !password) {
      setLocalError('יש להזין אימייל וסיסמה.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setLocalError(err?.message || 'ההתחברות נכשלה.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = localError || error;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f6f4',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: '#ffffff',
          padding: '28px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.35rem' }}>התחברות למערכת</h2>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span>אימייל</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span>סיסמה</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </label>

        {displayedError && (
          <div
            role="alert"
            style={{
              color: '#b91c1c',
              backgroundColor: '#fef2f2',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '0.9rem'
            }}
          >
            {displayedError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || submitting}
          style={{
            padding: '11px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#15803d',
            color: '#ffffff',
            fontWeight: 600,
            cursor: loading || submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {loading || submitting ? 'מתחבר...' : 'התחבר'}
        </button>
      </form>
    </div>
  );
}

function MapWorkspace() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f6f4'
        }}
      >
        טוען סשן ונתוני חווה...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <WaterMap />;
}

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <AuthProvider>
        <MapWorkspace />
      </AuthProvider>
    </div>
  );
}

export default App;

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Edit <code>src/App.js</code> and save to reload.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React
//         </a>
//       </header>
//     </div>
//   );
// }

// export default App;

// import React from 'react';
// import WaterMap from './components/WaterMap';

// function App() {
//   return (
//     <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
//       <WaterMap />
//     </div>
//   );
// }

// export default App;