import React from 'react';
import { FleetMetrics } from '../types/locusSync';
import { ShieldIcon, AlertTriangleIcon, ActivityIcon } from './Icons';

interface MetricsBarProps {
  metrics: FleetMetrics;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  return (
    <div style={styles.container}>
      {/* Fleet Total with Real / Simulated breakdown */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.label}>REGISTERED FLEET</span>
          <ActivityIcon size={12} color="#94A3B8" />
        </div>
        <div style={styles.valueRow}>
          <span style={styles.mainNumber}>{metrics.totalDevices}</span>
          <div style={styles.breakdownCol}>
            <span style={styles.subtextReal}>● {metrics.realDevices} REAL</span>
            <span style={styles.subtextSim}>○ {metrics.simulatedDevices} SIM</span>
          </div>
        </div>
      </div>

      <div style={{ ...styles.card, borderLeft: '2px solid #00D9A3' }}>
        <div style={styles.cardHeader}>
          <span style={{ ...styles.label, color: '#00D9A3' }}>TRUSTED</span>
          <ShieldIcon size={12} color="#00D9A3" />
        </div>
        <div style={styles.valueRow}>
          <span style={{ ...styles.mainNumber, color: '#00D9A3' }}>{metrics.trusted}</span>
          <span style={styles.subtext}>INTEGRITY VERIFIED</span>
        </div>
      </div>

      <div style={{ ...styles.card, borderLeft: '2px solid #FFB300' }}>
        <div style={styles.cardHeader}>
          <span style={{ ...styles.label, color: '#FFB300' }}>DEGRADED</span>
          <AlertTriangleIcon size={12} color="#FFB300" />
        </div>
        <div style={styles.valueRow}>
          <span style={{ ...styles.mainNumber, color: '#FFB300' }}>{metrics.degraded}</span>
          <span style={styles.subtext}>1 FAILING CHECK</span>
        </div>
      </div>

      <div
        style={{
          ...styles.card,
          borderLeft: metrics.denied > 0 ? '2px solid #FF3B30' : '2px solid #3A434D',
        }}
      >
        <div style={styles.cardHeader}>
          <span style={{ ...styles.label, color: metrics.denied > 0 ? '#FF3B30' : '#94A3B8' }}>
            DENIED / SPOOFED
          </span>
          <AlertTriangleIcon size={12} color={metrics.denied > 0 ? '#FF3B30' : '#94A3B8'} />
        </div>
        <div style={styles.valueRow}>
          <span
            style={{
              ...styles.mainNumber,
              color: metrics.denied > 0 ? '#FF3B30' : '#F1F5F9',
            }}
          >
            {metrics.denied}
          </span>
          <span style={{ ...styles.subtext, color: metrics.denied > 0 ? '#FF3B30' : '#64748B' }}>
            CRITICAL RAIM FAULT
          </span>
        </div>
      </div>

      <div style={{ ...styles.card, borderLeft: '2px solid #38BDF8' }}>
        <div style={styles.cardHeader}>
          <span style={{ ...styles.label, color: '#38BDF8' }}>RECOVERING</span>
          <ActivityIcon size={12} color="#38BDF8" />
        </div>
        <div style={styles.valueRow}>
          <span style={{ ...styles.mainNumber, color: '#38BDF8' }}>{metrics.recovering}</span>
          <span style={styles.subtext}>DEBOUNCE 5-EPOCH</span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '12px',
    padding: '16px 24px 8px 24px',
  },
  card: {
    backgroundColor: '#151B21',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  label: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    letterSpacing: '1.5px',
    color: '#94A3B8',
    fontWeight: 600,
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  mainNumber: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '24px',
    fontWeight: 700,
    color: '#F1F5F9',
    lineHeight: 1,
  },
  breakdownCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  subtextReal: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    color: '#00D9A3',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  subtextSim: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    color: '#94A3B8',
    letterSpacing: '0.5px',
  },
  subtext: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    letterSpacing: '0.8px',
    color: '#64748B',
  },
};
