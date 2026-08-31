import React from 'react';
import { LocusDevice } from '../types/locusSync';


interface SimulationControlsProps {
  devices: LocusDevice[];
  onTriggerAttack: (deviceId: string, scenario: 'teleport' | 'cn0_lockstep' | 'heading_diverge' | 'vpn') => void;
  onTriggerRecovery: (deviceId: string) => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  devices,
  onTriggerAttack,
  onTriggerRecovery,
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.title}>DEMO ATTACK HARNESS & RECOVERY SIMULATOR</span>
          <p style={styles.subtitle}>
            Stage GNSS spoofing attacks across fleet nodes to test the real-time Office Kit sync, Qwen3 advisory generation, and 5-epoch debounce recovery flow.
          </p>
        </div>
      </div>

      <div style={styles.devicesList}>
        {devices.map((device) => {
          return (
            <div key={device.id} style={styles.deviceCard}>
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.callsign}>{device.callsign}</span>
                  <span style={styles.deviceName}> — {device.name}</span>
                </div>
                <span
                  style={{
                    ...styles.stateBadge,
                    backgroundColor:
                      device.state === 'TRUSTED'
                        ? '#00D9A3'
                        : device.state === 'DENIED'
                        ? '#FF3B30'
                        : '#FFB300',
                    color: '#0C1116',
                  }}
                >
                  {device.state}
                </span>
              </div>

              <div style={styles.scenariosGrid}>
                {/* Attack 1: Kinematic Teleport */}
                <div style={styles.scenarioBox}>
                  <div style={styles.scenarioInfo}>
                    <span style={styles.scenarioTitle}>1. KINEMATIC TELEPORT</span>
                    <span style={styles.scenarioDesc}>
                      Injects 412 m/s step jump + C/N0 lockstep. Drives state to <b>DENIED</b>.
                    </span>
                  </div>
                  <button
                    style={{ ...styles.attackBtn, borderColor: '#FF3B30', color: '#FF3B30' }}
                    onClick={() => onTriggerAttack(device.id, 'teleport')}
                  >
                    STAGE TELEPORT
                  </button>
                </div>

                {/* Attack 2: C/N0 Lockstep */}
                <div style={styles.scenarioBox}>
                  <div style={styles.scenarioInfo}>
                    <span style={styles.scenarioTitle}>2. C/N0 MULTI-SV LOCKSTEP</span>
                    <span style={styles.scenarioDesc}>
                      Synchronizes 12 satellite carrier signal variances. Drives state to <b>DEGRADED</b>.
                    </span>
                  </div>
                  <button
                    style={{ ...styles.attackBtn, borderColor: '#FFB300', color: '#FFB300' }}
                    onClick={() => onTriggerAttack(device.id, 'cn0_lockstep')}
                  >
                    STAGE LOCKSTEP
                  </button>
                </div>

                {/* Attack 3: Solar Azimuth Heading Divergence */}
                <div style={styles.scenarioBox}>
                  <div style={styles.scenarioInfo}>
                    <span style={styles.scenarioTitle}>3. SOLAR HEADING DIVERGENCE</span>
                    <span style={styles.scenarioDesc}>
                      Diverges GPS track 48° from NOAA solar ephemeris compass. Drives to <b>DEGRADED</b>.
                    </span>
                  </div>
                  <button
                    style={{ ...styles.attackBtn, borderColor: '#FFB300', color: '#FFB300' }}
                    onClick={() => onTriggerAttack(device.id, 'heading_diverge')}
                  >
                    STAGE DIVERGENCE
                  </button>
                </div>

                {/* Recovery */}
                <div style={{ ...styles.scenarioBox, backgroundColor: 'rgba(0, 217, 163, 0.04)', borderColor: '#00D9A3' }}>
                  <div style={styles.scenarioInfo}>
                    <span style={{ ...styles.scenarioTitle, color: '#00D9A3' }}>4. 5-EPOCH DEBOUNCE RECOVERY</span>
                    <span style={styles.scenarioDesc}>
                      Simulates 5 clean RAIM epochs → <b>RECOVERING</b> → <b>TRUSTED</b>.
                    </span>
                  </div>
                  <button
                    style={{ ...styles.attackBtn, backgroundColor: '#00D9A3', color: '#0C1116', fontWeight: 700 }}
                    onClick={() => onTriggerRecovery(device.id)}
                  >
                    TRIGGER RECOVERY
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
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: '#F1F5F9',
  },
  subtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
    color: '#94A3B8',
    marginTop: '4px',
    maxWidth: '750px',
  },
  devicesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  deviceCard: {
    backgroundColor: '#151B21',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #3A434D',
    paddingBottom: '10px',
  },
  callsign: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '14px',
    fontWeight: 700,
    color: '#00D9A3',
  },
  deviceName: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '12px',
    color: '#F1F5F9',
  },
  stateBadge: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    padding: '2px 8px',
    borderRadius: '2px',
  },
  scenariosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
  },
  scenarioBox: {
    backgroundColor: '#0C1116',
    border: '1px solid #3A434D',
    borderRadius: '2px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '10px',
  },
  scenarioInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  scenarioTitle: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#F1F5F9',
  },
  scenarioDesc: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    color: '#94A3B8',
    lineHeight: 1.3,
  },
  attackBtn: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1px',
    backgroundColor: '#151B21',
    border: '1px solid',
    padding: '6px 12px',
    cursor: 'pointer',
    borderRadius: '2px',
    alignSelf: 'flex-start',
  },
};
