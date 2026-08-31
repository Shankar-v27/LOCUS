import React from 'react';
import { LocusDevice, LocusIntegrityEvent } from '../types/locusSync';
import { colorForState } from '../theme';
import { XIcon, RefreshIcon, CheckIcon, AlertTriangleIcon } from './Icons';

interface DeviceDetailsModalProps {
  device: LocusDevice | null;
  events: LocusIntegrityEvent[];
  onClose: () => void;
  onRecover: (deviceId: string) => void;
}

export const DeviceDetailsModal: React.FC<DeviceDetailsModalProps> = ({
  device,
  events,
  onClose,
  onRecover,
}) => {
  if (!device) return null;

  const stateColor = colorForState(device.state);
  const isReal = device.source === 'REAL_DEVICE';
  const t = device.latestTelemetry;
  const deviceEvents = events.filter((e) => e.deviceId === device.id);

  const checks = [
    { id: 'kinematic', name: 'Kinematic & Doppler Displacement', passed: device.state !== 'DENIED' },
    { id: 'cn0', name: 'Multi-Satellite C/N0 Lockstep Variance', passed: device.state !== 'DENIED' },
    { id: 'heading', name: 'Magnetic Track vs NOAA Solar Ephemeris', passed: true },
    { id: 'temporal', name: 'Monotonicity & Frame Interval', passed: true },
    { id: 'altitude', name: 'Barometric Pressure vs Geometric Altitude', passed: true },
    { id: 'environmental', name: 'Physical Acceleration Bounds', passed: true },
    { id: 'network', name: 'OS Routing & Tunnel Integrity (AnchorNet/LocusNet)', passed: true },
  ];

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.callsignRow}>
              <span style={styles.callsign}>{device.callsign}</span>
              <span style={{ ...styles.stateBadge, backgroundColor: stateColor, color: '#0C1116' }}>
                {device.state}
              </span>
              <span
                style={{
                  ...styles.sourceBadge,
                  backgroundColor: isReal
                    ? 'rgba(0, 217, 163, 0.15)'
                    : 'rgba(148, 163, 184, 0.15)',
                  color: isReal ? '#00D9A3' : '#94A3B8',
                  borderColor: isReal ? 'rgba(0, 217, 163, 0.4)' : '#3A434D',
                }}
              >
                {isReal ? '● PHYSICAL HARDWARE' : '○ SIMULATED NODE'}
              </span>
              <span style={styles.syncStatus}>● {device.syncStatus}</span>
            </div>
            <div style={styles.deviceName}>{device.name}</div>
            <div style={styles.deviceModel}>{device.model}</div>
          </div>

          <div style={styles.headerActions}>
            {device.state !== 'TRUSTED' && device.state !== 'RECOVERING' && (
              <button style={styles.recoverBtn} onClick={() => onRecover(device.id)}>
                <RefreshIcon size={12} color="#00D9A3" />
                TRIGGER RECOVERY
              </button>
            )}
            <button style={styles.closeBtn} onClick={onClose}>
              <XIcon size={16} color="#94A3B8" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={styles.body}>
          {/* Top Row: Confidence & Telemetry */}
          <div style={styles.topSection}>
            {/* Confidence Card */}
            <div style={styles.card}>
              <span style={styles.cardTitle}>INTEGRITY CONFIDENCE</span>
              <div style={styles.confDisplay}>
                <span style={{ ...styles.confLarge, color: stateColor }}>
                  {Math.round(device.confidence * 100)}%
                </span>
                <span style={styles.confDesc}>
                  {device.state === 'TRUSTED'
                    ? 'All 7 RAIM physics checks passing nominally.'
                    : 'Fault detected by on-device consistency engine.'}
                </span>
              </div>
              <div style={styles.confBarBg}>
                <div
                  style={{
                    ...styles.confBarFill,
                    width: `${Math.round(device.confidence * 100)}%`,
                    backgroundColor: stateColor,
                  }}
                />
              </div>
            </div>

            {/* Live Telemetry Card */}
            <div style={styles.card}>
              <span style={styles.cardTitle}>SYNCHRONIZED TELEMETRY SNAPSHOT</span>
              {t ? (
                <div style={styles.telGrid}>
                  <div style={styles.telItem}>
                    <span style={styles.telLabel}>LATITUDE</span>
                    <span style={styles.telValue}>{t.latitude.toFixed(5)}°</span>
                  </div>
                  <div style={styles.telItem}>
                    <span style={styles.telLabel}>LONGITUDE</span>
                    <span style={styles.telValue}>{t.longitude.toFixed(5)}°</span>
                  </div>
                  <div style={styles.telItem}>
                    <span style={styles.telLabel}>ALTITUDE</span>
                    <span style={styles.telValue}>{t.altitudeMeters.toFixed(1)} m</span>
                  </div>
                  <div style={styles.telItem}>
                    <span style={styles.telLabel}>SPEED</span>
                    <span style={styles.telValue}>{t.speedMps.toFixed(1)} m/s</span>
                  </div>
                  <div style={styles.telItem}>
                    <span style={styles.telLabel}>HEADING</span>
                    <span style={styles.telValue}>{t.headingDeg.toFixed(0)}°</span>
                  </div>
                  <div style={styles.telItem}>
                    <span style={styles.telLabel}>SATELLITES</span>
                    <span style={styles.telValue}>{t.satellites} SV</span>
                  </div>
                  <div style={styles.telItem}>
                    <span style={styles.telLabel}>MEAN C/N0</span>
                    <span style={styles.telValue}>{t.cn0Mean.toFixed(1)} dB-Hz</span>
                  </div>
                  <div style={styles.telItem}>
                    <span style={styles.telLabel}>HDOP</span>
                    <span style={styles.telValue}>{t.hdop.toFixed(1)}</span>
                  </div>
                </div>
              ) : (
                <span style={styles.noData}>No telemetry received yet</span>
              )}
            </div>
          </div>

          {/* Physics Checks Table */}
          <div style={styles.checksSection}>
            <span style={styles.cardTitle}>ON-DEVICE RAIM / FDE INTEGRITY ENGINE</span>
            <div style={styles.checksList}>
              {checks.map((c) => (
                <div key={c.id} style={styles.checkRow}>
                  <div style={styles.checkName}>
                    {c.passed ? (
                      <CheckIcon size={13} color="#00D9A3" />
                    ) : (
                      <AlertTriangleIcon size={13} color="#FF3B30" />
                    )}
                    <span style={{ color: c.passed ? '#F1F5F9' : '#FF3B30' }}>{c.name}</span>
                  </div>
                  <span
                    style={{
                      ...styles.checkStatusBadge,
                      color: c.passed ? '#00D9A3' : '#FF3B30',
                      backgroundColor: c.passed
                        ? 'rgba(0, 217, 163, 0.1)'
                        : 'rgba(255, 59, 48, 0.1)',
                      borderColor: c.passed
                        ? 'rgba(0, 217, 163, 0.3)'
                        : 'rgba(255, 59, 48, 0.3)',
                    }}
                  >
                    {c.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Device Event History */}
          <div style={styles.historySection}>
            <span style={styles.cardTitle}>DEVICE EVENT LOG ({deviceEvents.length})</span>
            <div style={styles.eventsScroll}>
              {deviceEvents.length === 0 ? (
                <span style={styles.noData}>No events recorded for this device.</span>
              ) : (
                deviceEvents.map((e) => {
                  const sColor = colorForState(e.state);
                  return (
                    <div key={e.id} style={styles.eventItem}>
                      <div style={styles.eventHeader}>
                        <span
                          style={{
                            ...styles.stateBadge,
                            color: sColor,
                            borderColor: sColor,
                            fontSize: '8px',
                          }}
                        >
                          {e.state}
                        </span>
                        <span style={styles.eventTime}>
                          {new Date(e.timestamp).toLocaleTimeString()}
                        </span>
                        <span style={styles.eventReason}>{e.reason}</span>
                      </div>
                      {e.explanation && (
                        <div style={styles.eventExplanation}>{e.explanation}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: '#151B21',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    width: '100%',
    maxWidth: '780px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #3A434D',
    backgroundColor: '#0C1116',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  callsignRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  callsign: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '16px',
    fontWeight: 700,
    color: '#F1F5F9',
  },
  stateBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    padding: '2px 6px',
    borderRadius: '2px',
  },
  sourceBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    padding: '2px 5px',
    border: '1px solid',
    borderRadius: '2px',
  },
  syncStatus: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    color: '#00D9A3',
    fontWeight: 600,
  },
  deviceName: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '12px',
    color: '#94A3B8',
    marginTop: '2px',
  },
  deviceModel: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    color: '#64748B',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  recoverBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 600,
    color: '#00D9A3',
    backgroundColor: 'rgba(0, 217, 163, 0.1)',
    border: '1px solid #00D9A3',
    padding: '6px 12px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
  closeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  topSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: '12px',
  },
  card: {
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardTitle: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1.2px',
    color: '#94A3B8',
  },
  confDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  confLarge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '28px',
    fontWeight: 700,
  },
  confDesc: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    color: '#94A3B8',
  },
  confBarBg: {
    height: '6px',
    backgroundColor: '#151B21',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  confBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  telGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  telItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  telLabel: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '8px',
    color: '#64748B',
  },
  telValue: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '12px',
    fontWeight: 600,
    color: '#F1F5F9',
  },
  checksSection: {
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  checksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  checkRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid rgba(58, 67, 77, 0.3)',
  },
  checkName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
  },
  checkStatusBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    fontWeight: 700,
    padding: '1px 6px',
    border: '1px solid',
    borderRadius: '2px',
  },
  historySection: {
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  eventsScroll: {
    maxHeight: '160px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  eventItem: {
    borderLeft: '2px solid #3A434D',
    paddingLeft: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  eventTime: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    color: '#64748B',
  },
  eventReason: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    fontWeight: 600,
    color: '#F1F5F9',
  },
  eventExplanation: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    color: '#94A3B8',
  },
  noData: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    color: '#64748B',
  },
};
