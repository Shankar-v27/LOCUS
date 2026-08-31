import { NativeModule, requireNativeModule } from 'expo';

/**
 * JS contract mirror of the payloads emitted by the LocusGnss native module
 * (android/src/main/java/expo/modules/anchorsdk/AnchorGnssModule.kt).
 */
export interface LocusGnssSatellite {
  svid: number;
  constellation: 'gps' | 'glonass' | 'beidou' | 'galileo' | 'qzss' | 'irnss' | 'unknown';
  cn0DbHz: number;
}

export interface LocusGnssMeasurementEvent {
  satellites: LocusGnssSatellite[];
  timestamp: number;
  elapsedRealtimeNanos?: number;
}

export type LocusGnssErrorEvent = {
  code: 'E_PERMISSION' | 'E_LOCATION_DISABLED' | 'E_UNSUPPORTED' | 'E_REGISTRATION_FAILED' | 'E_GNSS_STATUS';
  message: string;
};

export type LocusGnssStatus =
  | 'ready'
  | 'stopped'
  | 'notSupported'
  | 'locationDisabled'
  | 'notAllowed'
  | 'unknown';

export interface LocusGnssStatusEvent {
  status: LocusGnssStatus;
}

type LocusGnssModuleEvents = {
  onMeasurement: (event: LocusGnssMeasurementEvent) => void;
  onError: (event: LocusGnssErrorEvent) => void;
  onStatus: (event: LocusGnssStatusEvent) => void;
};

declare class LocusGnssNativeModule extends NativeModule<LocusGnssModuleEvents> {
  /** Begins streaming C/N0 measurements. Idempotent; requires ACCESS_FINE_LOCATION already granted. */
  start(): Promise<void>;
  /** Stops streaming and unregisters the measurement callback. */
  stop(): Promise<void>;
  /** True when the device runs Android 7.0 (API 24)+ and exposes a LocationManager. */
  isSupported(): boolean;
}

// Backwards-compatible type aliases
export type AnchorGnssSatellite = LocusGnssSatellite;
export type AnchorGnssMeasurementEvent = LocusGnssMeasurementEvent;
export type AnchorGnssErrorEvent = LocusGnssErrorEvent;
export type AnchorGnssStatus = LocusGnssStatus;
export type AnchorGnssStatusEvent = LocusGnssStatusEvent;

export const LocusGnss = requireNativeModule<LocusGnssNativeModule>('AnchorGnss');
export default LocusGnss;
