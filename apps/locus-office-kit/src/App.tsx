import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { LiveIncidentPanel } from './components/LiveIncidentPanel';
import { FleetGrid } from './components/FleetGrid';
import { EventHistoryTable } from './components/EventHistoryTable';
import { SimulationControls } from './components/SimulationControls';
import { DeviceDetailsModal } from './components/DeviceDetailsModal';
import { syncService } from './services/syncService';
import { LocusDevice, LocusIntegrityEvent } from './types/locusSync';

export const App: React.FC = () => {
  const [devices, setDevices] = useState<LocusDevice[]>(() => syncService.getDevices());
  const [events, setEvents] = useState<LocusIntegrityEvent[]>(() => syncService.getEvents());
  const [activeTab, setActiveTab] = useState<'fleet' | 'history' | 'simulate'>('fleet');
  const [selectedDevice, setSelectedDevice] = useState<LocusDevice | null>(null);

  useEffect(() => {
    return syncService.subscribe(() => {
      setDevices(syncService.getDevices());
      setEvents(syncService.getEvents());
    });
  }, []);

  const metrics = syncService.getMetrics();

  // Find the latest non-trusted incident if any
  const latestIncident = events.find((e) => e.state === 'DENIED' || e.state === 'DEGRADED') ?? null;

  const handleReset = () => {
    syncService.resetAll();
    setSelectedDevice(null);
  };

  const handleTriggerAttack = (deviceId: string, scenario: 'teleport' | 'cn0_lockstep' | 'heading_diverge' | 'vpn') => {
    syncService.triggerAttack(deviceId, scenario);
  };

  const handleTriggerRecovery = (deviceId: string) => {
    syncService.triggerRecovery(deviceId);
  };

  const handleSelectDeviceById = (deviceId: string) => {
    const dev = devices.find((d) => d.id === deviceId) ?? null;
    setSelectedDevice(dev);
  };

  return (
    <div style={styles.appContainer}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleReset}
      />

      <main style={styles.mainContent}>
        <MetricsBar metrics={metrics} />

        {/* High priority active incident alert */}
        <LiveIncidentPanel
          latestIncident={latestIncident}
          onRecover={handleTriggerRecovery}
          onInspectDevice={handleSelectDeviceById}
        />

        {/* Tab Views */}
        {activeTab === 'fleet' && (
          <FleetGrid
            devices={devices}
            onSelectDevice={setSelectedDevice}
            onRecoverDevice={handleTriggerRecovery}
          />
        )}

        {activeTab === 'history' && (
          <EventHistoryTable
            events={events}
            onSelectEventDevice={handleSelectDeviceById}
          />
        )}

        {activeTab === 'simulate' && (
          <SimulationControls
            devices={devices}
            onTriggerAttack={handleTriggerAttack}
            onTriggerRecovery={handleTriggerRecovery}
          />
        )}
      </main>

      {/* Device Inspector Modal */}
      {selectedDevice && (
        <DeviceDetailsModal
          device={selectedDevice}
          events={events}
          onClose={() => setSelectedDevice(null)}
          onRecover={handleTriggerRecovery}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#0C1116',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
};
