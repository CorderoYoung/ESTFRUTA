import React from 'react';
import { useNavigate } from 'react-router-dom';

function AppHeader() {

  const navigate = useNavigate();

  return (

    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',

        background: '#15803d', // Verde agrícola
        color: '#ffffff',

        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',

        padding: '10px 16px',
        boxSizing: 'border-box',

        borderBottom: '1px solid #166534',
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#ffffff',
          textShadow: '0 2px 2px rgba(0, 0, 0, 0.35)',
        }}
      >
        ESTFRUTA
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {navigator.onLine ? '🟢 En línea' : '🔴 Offline'}
        </div>

        <button
          type="button"
          onClick={() => navigate('/datos-locales')}
          style={{
            backgroundColor: '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            width: 36,
            height: 36,
            fontSize: 16,
            cursor: 'pointer',

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',

            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.20)',
          }}
        >
          🛢️
        </button>
      </div>
    </div>
  );
}

export default AppHeader;