import React, { useState, useMemo } from 'react';
import { LocusIntegrityEvent } from '../types/locusSync';
import { colorForState } from '../theme';

interface EventHistoryTableProps {
  events: LocusIntegrityEvent[];
  onSelectEventDevice?: (deviceId: string) => void;
}

export const EventHistoryTable: React.FC<EventHistoryTableProps> = ({
  events,
  onSelectEventDevice,
}) => {
  const [filterState, setFilterState] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterState !== 'ALL' && e.state !== filterState) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchDev = e.deviceName.toLowerCase().includes(q);
        const matchReason = e.reason.toLowerCase().includes(q);
        const matchChecks = e.failedChecks.some((c) => c.toLowerCase().includes(q));
        const matchExp = e.explanation?.toLowerCase().includes(q);
        return matchDev || matchReason || matchChecks || matchExp;
      }
      return true;
    });
  }, [events, filterState, searchQuery]);

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `locus_fleet_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={styles.container}>
      {/* Table Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.title}>SYNCHRONIZED FLIGHT LOG ({filteredEvents.length})</span>
          <div style={styles.filterGroup}>
            {['ALL', 'DENIED', 'DEGRADED', 'RECOVERING', 'TRUSTED'].map((st) => (
              <button
                key={st}
                style={{
                  ...styles.filterBtn,
                  ...(filterState === st ? styles.filterBtnActive : {}),
                  ...(st === 'DENIED' && filterState === st
                    ? { borderColor: '#FF3B30', color: '#FF3B30' }
                    : {}),
                }}
                onClick={() => setFilterState(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.toolbarRight}>
          <input
            type="text"
            placeholder="Search reason, check, device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          <button style={styles.exportBtn} onClick={handleExportJson}>
            EXPORT JSON
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.theadRow}>
              <th style={{ ...styles.th, width: '90px' }}>TIMESTAMP</th>
              <th style={{ ...styles.th, width: '100px' }}>STATE</th>
              <th style={{ ...styles.th, width: '220px' }}>DEVICE & SOURCE</th>
              <th style={{ ...styles.th, width: '80px' }}>CONF</th>
              <th style={{ ...styles.th, width: '160px' }}>FAILED CHECKS</th>
              <th style={styles.th}>REASON & ON-DEVICE ADVISORY</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} style={styles.emptyTd}>
                  No events match the current filter criteria.
                </td>
              </tr>
            ) : (
              filteredEvents.map((event) => {
                const stateColor = colorForState(event.state);
                const isReal = event.source === 'REAL_DEVICE';
                const d = new Date(event.timestamp);
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d
                  .getMinutes()
                  .toString()
                  .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

                return (
                  <tr key={event.id} style={styles.tr}>
                    <td style={styles.tdMono}>{timeStr}</td>
                    <td>
                      <span
                        style={{
                          ...styles.stateBadge,
                          color: stateColor,
                          borderColor: stateColor,
                        }}
                      >
                        {event.state}
                      </span>
                    </td>
                    <td>
                      <div style={styles.deviceCol}>
                        <div style={styles.deviceRow}>
                          <span
                            style={{
                              ...styles.sourceMiniBadge,
                              color: isReal ? '#00D9A3' : '#94A3B8',
                              backgroundColor: isReal
                                ? 'rgba(0, 217, 163, 0.1)'
                                : 'rgba(148, 163, 184, 0.1)',
                              borderColor: isReal ? 'rgba(0, 217, 163, 0.3)' : '#3A434D',
                            }}
                          >
                            {isReal ? 'REAL' : 'SIM'}
                          </span>
                          <span
                            style={styles.deviceLink}
                            onClick={() => onSelectEventDevice?.(event.deviceId)}
                          >
                            {event.deviceName}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...styles.tdMono, color: stateColor }}>
                      {Math.round(event.confidence * 100)}%
                    </td>
                    <td>
                      <div style={styles.checksWrap}>
                        {event.failedChecks.length > 0 ? (
                          event.failedChecks.map((c) => (
                            <span key={c} style={styles.checkTag}>
                              {c}
                            </span>
                          ))
                        ) : (
                          <span style={styles.noChecksText}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={styles.reasonBlock}>
                        <div style={styles.reasonTitle}>{event.reason}</div>
                        {event.explanation && (
                          <div style={styles.explanationText}>{event.explanation}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '0 24px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: '#94A3B8',
  },
  filterGroup: {
    display: 'flex',
    gap: '4px',
  },
  filterBtn: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: '#64748B',
    backgroundColor: '#151B21',
    border: '1px solid #3A434D',
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
  filterBtnActive: {
    color: '#F1F5F9',
    backgroundColor: '#0C1116',
    borderColor: '#00D9A3',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  searchInput: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    backgroundColor: '#151B21',
    border: '1px solid #3A434D',
    color: '#F1F5F9',
    padding: '5px 10px',
    borderRadius: '2px',
    minWidth: '220px',
    outline: 'none',
  },
  exportBtn: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1px',
    color: '#00D9A3',
    backgroundColor: 'rgba(0, 217, 163, 0.08)',
    border: '1px solid #00D9A3',
    padding: '5px 10px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
  tableWrapper: {
    backgroundColor: '#151B21',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  theadRow: {
    borderBottom: '1px solid #3A434D',
    backgroundColor: '#0C1116',
  },
  th: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1.2px',
    color: '#94A3B8',
    padding: '10px 12px',
  },
  tr: {
    borderBottom: '1px solid rgba(58, 67, 77, 0.4)',
    transition: 'background-color 0.15s ease',
  },
  tdMono: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    color: '#94A3B8',
    padding: '10px 12px',
    verticalAlign: 'top',
  },
  stateBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1px',
    padding: '2px 6px',
    border: '1px solid',
    borderRadius: '2px',
    display: 'inline-block',
  },
  deviceCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  deviceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  sourceMiniBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '8px',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: '2px',
    border: '1px solid',
  },
  deviceLink: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    color: '#F1F5F9',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(241, 245, 249, 0.3)',
  },
  checksWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '2px 0',
  },
  checkTag: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '9px',
    fontWeight: 600,
    color: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    border: '1px solid rgba(255, 59, 48, 0.4)',
    padding: '1px 5px',
    borderRadius: '2px',
  },
  noChecksText: {
    color: '#64748B',
    fontFamily: '"IBM Plex Mono", monospace',
  },
  reasonBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '4px 0',
  },
  reasonTitle: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    color: '#F1F5F9',
    fontWeight: 600,
  },
  explanationText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    color: '#94A3B8',
    lineHeight: 1.3,
  },
  emptyTd: {
    textAlign: 'center',
    padding: '24px',
    color: '#64748B',
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
  },
};
