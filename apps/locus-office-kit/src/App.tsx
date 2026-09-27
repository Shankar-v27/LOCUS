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
    const unsubscribe = syncService.subscribe(() => {
      setDevices(syncService.getDevices());
      setEvents(syncService.getEvents());
    });
    setDevices(syncService.getDevices());
    setEvents(syncService.getEvents());
    syncService.bootstrapFromServer();
    return unsubscribe;
  }, []);

  const metrics = syncService.getMetrics();
  const rawDevices = devices;
  const realCountBefore = rawDevices.filter((d) => d.source === 'REAL_DEVICE').length;
  const filteredDevices = rawDevices;
  const realCountAfter = filteredDevices.filter((d) => d.source === 'REAL_DEVICE').length;

  console.log('[UI] fleet devices received', rawDevices.length);
  console.log('[UI] REAL count before filtering', realCountBefore);
  console.log('[UI] REAL count after filtering', realCountAfter);
  console.log('[OFFICE_KIT UI] devices =', devices.map((d) => ({ id: d.id, source: d.source, state: d.state })));
  console.log('[OFFICE_KIT UI] real devices =', devices.filter((d) => d.source === 'REAL_DEVICE').map((d) => d.id));
  console.log('[OFFICE_KIT UI] real count =', metrics.realDevices, 'total count =', metrics.totalDevices);

  // Find the active incident on any device currently in an incident state (DEGRADED or DENIED)
  const activeDeviceWithIncident = devices.find((d) => d.state === 'DENIED' || d.state === 'DEGRADED');
  const latestIncident = activeDeviceWithIncident?.latestIncident ?? null;

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
