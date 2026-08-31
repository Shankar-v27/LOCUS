import React from 'react';
import { LocusIntegrityEvent } from '../types/locusSync';
import { colorForState } from '../theme';
import { AlertTriangleIcon, CpuIcon, RefreshIcon, CheckIcon } from './Icons';

interface LiveIncidentPanelProps {
  latestIncident: LocusIntegrityEvent | null;
  onRecover: (deviceId: string) => void;
  onInspectDevice: (deviceId: string) => void;
}

export const LiveIncidentPanel: React.FC<LiveIncidentPanelProps> = ({
  latestIncident,
  onRecover,
  onInspectDevice,
}) => {
  if (!latestIncident || latestIncident.state === 'TRUSTED') {
    return (
      <div style={styles.cleanContainer}>
        <div style={styles.cleanBadge}>
          <CheckIcon size={14} color="#00D9A3" />
          <span style={styles.cleanTitle}>NO ACTIVE GNSS INTEGRITY INCIDENTS</span>
        </div>
        <span style={styles.cleanSubtitle}>
          All fleet nodes are reporting nominal Doppler velocity, multi-satellite C/N0
          distributions, and solar azimuth agreements.
        </span>
      </div>
    );
  }

  const isDenied = latestIncident.state === 'DENIED';
  const isReal = latestIncident.source === 'REAL_DEVICE';
  const stateColor = colorForState(latestIncident.state);

  return (
    <div
      style={{
        ...styles.container,
        borderColor: stateColor,
        backgroundColor: isDenied ? 'rgba(255, 59, 48, 0.04)' : 'rgba(255, 179, 0, 0.04)',
      }}
    >
      {/* Alert Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={{ ...styles.iconPulse, backgroundColor: stateColor }}>
            <AlertTriangleIcon size={14} color="#0C1116" />
          </div>
          <div>
            <div style={styles.incidentTag}>
              <span style={{ ...styles.stateBadge, backgroundColor: stateColor, color: '#0C1116' }}>
                {latestIncident.state}
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
                {isReal ? '● REAL HARDWARE' : '○ SIMULATED HARNESS'}
              </span>
              <span style={styles.deviceName}>{latestIncident.deviceName}</span>
              <span style={styles.timeTag}>
                {new Date(latestIncident.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div style={styles.reasonText}>{latestIncident.reason}</div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <button
            style={styles.inspectBtn}
            onClick={() => onInspectDevice(latestIncident.deviceId)}
          >
            INSPECT NODE
          </button>
          {latestIncident.state !== 'RECOVERING' && (
            <button style={styles.recoverBtn} onClick={() => onRecover(latestIncident.deviceId)}>
              <RefreshIcon size={12} color="#00D9A3" />
              TRIGGER 5-EPOCH RECOVERY
            </button>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div style={styles.contentGrid}>
        {/* Failed Checks */}
        <div style={styles.checksSection}>
          <span style={styles.sectionTitle}>FAILED CONSISTENCY CHECKS</span>
          <div style={styles.chipsRow}>
            {latestIncident.failedChecks.length > 0 ? (
              latestIncident.failedChecks.map((check) => (
                <span key={check} style={styles.checkChip}>
                  {check.toUpperCase()}
                </span>
              ))
            ) : (
              <span style={styles.noChecks}>None (Evaluating debounce recovery)</span>
            )}
          </div>
        </div>

        {/* Confidence Gauge */}
        <div style={styles.confidenceSection}>
          <span style={styles.sectionTitle}>INTEGRITY CONFIDENCE</span>
          <div style={styles.confRow}>
            <div style={styles.confTrack}>
              <div
                style={{
                  ...styles.confFill,
                  width: `${Math.round(latestIncident.confidence * 100)}%`,
                  backgroundColor: stateColor,
                }}
              />
            </div>
            <span style={{ ...styles.confNumber, color: stateColor }}>
              {Math.round(latestIncident.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Qwen3 Plain-Language Advisory */}
      {latestIncident.explanation && (
        <div style={styles.advisoryCard}>
          <div style={styles.advisoryHeader}>
            <CpuIcon size={12} color="#00D9A3" />
            <span style={styles.advisoryLabel}>ON-DEVICE QWEN3 ADVISORY ENRICHMENT</span>
          </div>
          <p style={styles.advisoryText}>{latestIncident.explanation}</p>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: '8px 24px 16px 24px',
    border: '1px solid #FF3B30',
    backgroundColor: '#151B21',
    borderRadius: '2px',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cleanContainer: {
    margin: '8px 24px 16px 24px',
    border: '1px solid rgba(0, 217, 163, 0.3)',
    backgroundColor: 'rgba(0, 217, 163, 0.03)',
    borderRadius: '2px',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cleanBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cleanTitle: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1.2px',
    color: '#00D9A3',
  },
  cleanSubtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
    color: '#64748B',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconPulse: {
    width: '26px',
    height: '26px',
    borderRadius: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '2px',
    flexWrap: 'wrap',
  },
  stateBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1.2px',
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
  deviceName: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '12px',
    fontWeight: 600,
    color: '#F1F5F9',
  },
  timeTag: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    color: '#64748B',
  },
  reasonText: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '12px',
    color: '#F1F5F9',
    fontWeight: 500,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  inspectBtn: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    letterSpacing: '1px',
    fontWeight: 600,
    color: '#F1F5F9',
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
    padding: '6px 12px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
  recoverBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    letterSpacing: '1px',
    fontWeight: 600,
    color: '#00D9A3',
    backgroundColor: 'rgba(0, 217, 163, 0.1)',
    border: '1px solid #00D9A3',
    padding: '6px 12px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '16px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(58, 67, 77, 0.3)',
  },
  checksSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  sectionTitle: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    letterSpacing: '1.2px',
    color: '#94A3B8',
    fontWeight: 600,
  },
  chipsRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  checkChip: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 700,
    color: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    border: '1px solid #FF3B30',
    padding: '2px 8px',
    borderRadius: '2px',
  },
  noChecks: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    color: '#64748B',
  },
  confidenceSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  confRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  confTrack: {
    flex: 1,
    height: '6px',
    backgroundColor: '#0C1116',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  confNumber: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '13px',
    fontWeight: 700,
    minWidth: '38px',
    textAlign: 'right',
  },
  advisoryCard: {
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    padding: '10px 14px',
  },
  advisoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  advisoryLabel: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    letterSpacing: '1.2px',
    color: '#00D9A3',
    fontWeight: 700,
  },
  advisoryText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
    lineHeight: 1.4,
    color: '#F1F5F9',
    margin: 0,
  },
};
