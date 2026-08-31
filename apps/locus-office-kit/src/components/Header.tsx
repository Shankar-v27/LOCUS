import React, { useState, useEffect } from 'react';
import { RadioIcon, RefreshIcon, ClockIcon } from './Icons';
import { syncService } from '../services/syncService';

interface HeaderProps {
  onReset: () => void;
  activeTab: 'fleet' | 'history' | 'simulate';
  setActiveTab: (tab: 'fleet' | 'history' | 'simulate') => void;
}

export const Header: React.FC<HeaderProps> = ({ onReset, activeTab, setActiveTab }) => {
  const [time, setTime] = useState({
    utc: new Date().toUTCString().slice(17, 25) + ' UTC',
    local: new Date().toLocaleTimeString(),
  });
  const [transport, setTransport] = useState(syncService.getTransportState());

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTime({
        utc: d.toUTCString().slice(17, 25) + ' UTC',
        local: d.toLocaleTimeString(),
      });
    }, 1000);
    const unsub = syncService.subscribe(() => {
      setTransport(syncService.getTransportState());
    });
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const isHttpSse = transport === 'HTTP_SSE_CONNECTED';

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <div style={styles.logoBadge}>
          <span style={styles.logoText}>LOCUS</span>
          <span style={styles.versionBadge}>OFFICE KIT v1.0</span>
        </div>
        <div style={styles.divider} />
        <div
          style={{
            ...styles.liveTag,
            borderColor: isHttpSse ? 'rgba(0, 217, 163, 0.4)' : 'rgba(58, 67, 77, 0.6)',
            backgroundColor: isHttpSse ? 'rgba(0, 217, 163, 0.08)' : 'rgba(148, 163, 184, 0.08)',
          }}
        >
          <span
            style={{
              ...styles.pulseDot,
              backgroundColor: isHttpSse ? '#00D9A3' : '#94A3B8',
              boxShadow: isHttpSse ? '0 0 6px #00D9A3' : 'none',
            }}
          />
          <RadioIcon size={13} color={isHttpSse ? '#00D9A3' : '#94A3B8'} />
          <span style={{ ...styles.liveText, color: isHttpSse ? '#00D9A3' : '#94A3B8' }}>
            {isHttpSse ? 'TRANSPORT: HTTP / SSE (REAL DEVICE INGESTION)' : 'TRANSPORT: LOCAL BROWSER SYNC'}
          </span>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav style={styles.nav}>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === 'fleet' ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab('fleet')}
        >
          FLEET OVERVIEW
        </button>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === 'history' ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab('history')}
        >
          FLIGHT HISTORY
        </button>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === 'simulate' ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab('simulate')}
        >
          DEMO ATTACK HARNESS
        </button>
      </nav>

      <div style={styles.right}>
        <div style={styles.timeBlock}>
          <ClockIcon size={13} color="#94A3B8" />
          <span style={styles.utcTime}>{time.utc}</span>
          <span style={styles.localTime}>({time.local})</span>
        </div>
        <button style={styles.resetBtn} onClick={onReset} title="Reset all telemetry & event logs">
          <RefreshIcon size={12} color="#94A3B8" />
          RESET CONSOLE
        </button>
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: '56px',
    backgroundColor: '#151B21',
    borderBottom: '1px solid #3A434D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    userSelect: 'none',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logoBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoText: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontWeight: 700,
    fontSize: '18px',
    letterSpacing: '2.5px',
    color: '#00D9A3',
  },
  versionBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    letterSpacing: '1px',
    color: '#94A3B8',
    backgroundColor: '#0C1116',
    padding: '2px 6px',
    border: '1px solid #3A434D',
    borderRadius: '2px',
  },
  divider: {
    width: '1px',
    height: '22px',
    backgroundColor: '#3A434D',
  },
  liveTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: '1px solid',
    padding: '3px 8px',
    borderRadius: '2px',
  },
  pulseDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  liveText: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    letterSpacing: '1px',
    fontWeight: 600,
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  tabBtn: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    letterSpacing: '1.2px',
    fontWeight: 600,
    color: '#94A3B8',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    padding: '6px 14px',
    cursor: 'pointer',
    borderRadius: '2px',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    color: '#F1F5F9',
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  timeBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
  },
  utcTime: {
    color: '#F1F5F9',
    fontWeight: 600,
  },
  localTime: {
    color: '#64748B',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    letterSpacing: '1px',
    color: '#94A3B8',
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
    padding: '5px 10px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
};
