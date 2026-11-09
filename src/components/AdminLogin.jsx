/**
 * AdminLogin.jsx
 * Jelszóval védett admin bejelentkezés
 */
import React, { useState } from 'react';
import { checkAdminPassword } from '../utils/driveSync';

export default function AdminLogin({ onSuccess, onCancel }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const ok = await checkAdminPassword(password);
      if (ok) {
        onSuccess();
      } else {
        setError('Hibás jelszó!');
      }
    } catch (err) {
      setError('Hiba: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#131120', border: '1px solid #2e2a45',
        borderRadius: 16, padding: 40, width: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✝</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>
            Admin Belépés
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>
            Szerkesztői mód — csak jogosult felhasználóknak
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>
              Jelszó
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Admin jelszó..."
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', borderRadius: 8,
                border: error ? '1px solid #ef4444' : '1px solid #2e2a45',
                background: '#0e0c1a', color: '#f8fafc',
                fontSize: 15, outline: 'none',
              }}
            />
            {error && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{error}</div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              padding: '13px', borderRadius: 8, border: 'none',
              background: loading ? '#374151' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Ellenőrzés...' : 'Belépés'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px', borderRadius: 8, border: '1px solid #2e2a45',
              background: 'transparent', color: '#94a3b8',
              fontSize: 14, cursor: 'pointer',
            }}
          >
            Mégsem — Csak megtekintés
          </button>
        </form>

        <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', margin: 0 }}>
          Az első belépéskor a megadott jelszó lesz az admin jelszó.
        </p>
      </div>
    </div>
  );
}
