import React from 'react';
import { LocusDevice } from '../types/locusSync';
import { colorForState } from '../theme';
import { CpuIcon } from './Icons';

interface FleetGridProps {
  devices: LocusDevice[];
  onSelectDevice: (device: LocusDevice) => void;
  onRecoverDevice: (deviceId: string) => void;
}

export const FleetGrid: React.FC<FleetGridProps> = ({
  devices,
  onSelectDevice,
  onRecoverDevice,
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.gridHeader}>
        <span style={styles.title}>ACTIVE FIELD NODES ({devices.length})</span>
        <span style={styles.subtitle}>
          Authoritative on-device GNSS integrity monitors · Real hardware & simulated nodes
        </span>
      </div>

      <div style={styles.grid}>
        {devices.map((device) => {
          const stateColor = colorForState(device.state);
          const t = device.latestTelemetry;
          const isDenied = device.state === 'DENIED';
          const isReal = device.source === 'REAL_DEVICE';

          return (
            <div
              key={device.id}
              style={{
                ...styles.card,
                borderColor: isDenied ? '#FF3B30' : isReal ? '#00D9A3' : '#3A434D',
                boxShadow: isDenied
                  ? '0 0 12px rgba(255, 59, 48, 0.15)'
                  : isReal
                  ? '0 0 8px rgba(0, 217, 163, 0.08)'
                  : 'none',
              }}
            >
              {/* Card Header */}
              <div style={styles.cardTop}>
                <div>
                  <div style={styles.callsignRow}>
                    <span style={styles.callsign}>{device.callsign}</span>
                    <span
                      style={{
                        ...styles.sourceBadge,
                        backgroundColor: isReal
                          ? 'rgba(0, 217, 163, 0.12)'
                          : 'rgba(148, 163, 184, 0.12)',
                        color: isReal ? '#00D9A3' : '#94A3B8',
                        borderColor: isReal ? 'rgba(0, 217, 163, 0.4)' : '#3A434D',
                      }}
                    >
                      {isReal ? '● REAL HARDWARE' : '○ SIMULATED'}
                    </span>
                    <span
                      style={{
                        ...styles.syncBadge,
                        color: device.syncStatus === 'ONLINE' ? '#00D9A3' : '#94A3B8',
                      }}
                    >
                      {device.syncStatus}
                    </span>
                  </div>
                  <div style={styles.deviceName}>{device.name}</div>
                  <div style={styles.deviceModel}>{device.model}</div>
                </div>

                <div style={{ ...styles.statePill, backgroundColor: stateColor, color: '#0C1116' }}>
                  {device.state}
                </div>
              </div>

              {/* Confidence Gauge */}
              <div style={styles.confSection}>
                <div style={styles.confLabels}>
                  <span style={styles.metaLabel}>INTEGRITY CONFIDENCE</span>
                  <span style={{ ...styles.confVal, color: stateColor }}>
                    {Math.round(device.confidence * 100)}%
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

              {/* Telemetry Strip */}
              {t && (
                <div style={styles.telemetryGrid}>
                  <div style={styles.telCell}>
                    <span style={styles.telLabel}>SPEED</span>
                    <span style={styles.telVal}>{t.speedMps.toFixed(1)} m/s</span>
                  </div>
                  <div style={styles.telCell}>
                    <span style={styles.telLabel}>ALTITUDE</span>
                    <span style={styles.telVal}>{t.altitudeMeters.toFixed(1)} m</span>
                  </div>
                  <div style={styles.telCell}>
                    <span style={styles.telLabel}>SATS</span>
                    <span style={styles.telVal}>{t.satellites} SV</span>
                  </div>
                  <div style={styles.telCell}>
                    <span style={styles.telLabel}>MEAN C/N0</span>
                    <span style={styles.telVal}>{t.cn0Mean.toFixed(1)} dB-Hz</span>
                  </div>
                </div>
              )}

              {/* Card Footer */}
              <div style={styles.cardFooter}>
                <div style={styles.footerInfo}>
                  <span style={styles.batteryText}>BAT: {device.batteryPct}%</span>
                  <span style={styles.aiTag}>
                    <CpuIcon size={10} color="#00D9A3" /> AI READY
                  </span>
                </div>

                <div style={styles.footerActions}>
                  {device.state !== 'TRUSTED' && device.state !== 'RECOVERING' && (
                    <button
                      style={styles.actionBtnRecover}
                      onClick={() => onRecoverDevice(device.id)}
                    >
                      RECOVER
                    </button>
                  )}
                  <button
                    style={styles.actionBtnInspect}
                    onClick={() => onSelectDevice(device)}
                  >
                    DETAILS →
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '0 24px 24px 24px',
  },
  gridHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    marginBottom: '12px',
  },
  title: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: '#94A3B8',
  },
  subtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    color: '#64748B',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#151B21',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  callsignRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '2px',
    flexWrap: 'wrap',
  },
  callsign: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#F1F5F9',
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
  syncBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  deviceName: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    color: '#94A3B8',
  },
  deviceModel: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '10px',
    color: '#64748B',
    marginTop: '1px',
  },
  statePill: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    padding: '3px 8px',
    borderRadius: '2px',
  },
  confSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  confLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    letterSpacing: '1px',
    color: '#64748B',
  },
  confVal: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    fontWeight: 700,
  },
  confBarBg: {
    height: '4px',
    backgroundColor: '#0C1116',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  confBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  telemetryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    backgroundColor: '#0C1116',
    padding: '8px',
    borderRadius: '2px',
    border: '1px solid rgba(58, 67, 77, 0.4)',
  },
  telCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  telLabel: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '8px',
    color: '#64748B',
    letterSpacing: '0.5px',
  },
  telVal: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    color: '#F1F5F9',
    fontWeight: 600,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '8px',
    borderTop: '1px solid rgba(58, 67, 77, 0.3)',
  },
  footerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  batteryText: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    color: '#94A3B8',
  },
  aiTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    color: '#00D9A3',
    fontWeight: 600,
  },
  footerActions: {
    display: 'flex',
    gap: '6px',
  },
  actionBtnRecover: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    letterSpacing: '1px',
    fontWeight: 700,
    color: '#00D9A3',
    backgroundColor: 'rgba(0, 217, 163, 0.1)',
    border: '1px solid #00D9A3',
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
  actionBtnInspect: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    letterSpacing: '1px',
    fontWeight: 600,
    color: '#F1F5F9',
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
};
