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
        padding: '10px 16px',
        background: '#fff',
        borderBottom: '1px solid #ddd'
      }}
    >

      <div
        style={{
          fontSize: 20,
          fontWeight: 700
        }}
      >
        ESTFRUTA
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >

        <div
          style={{
            color: navigator.onLine
              ? 'green'
              : 'red',
            fontWeight: 600
          }}
        >
          {navigator.onLine
            ? '🟢 En línea'
            : '🔴 Offline'}
        </div>

        <button
          type="button"
          onClick={() =>
            navigate('/datos-locales')
          }
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            width: 36,
            height: 36,
            fontSize: 16,
            cursor: 'pointer'
          }}
        >
          🛢️
        </button>

      </div>

    </div>
  );
}

export default AppHeader;