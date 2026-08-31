import { NativeModule, requireNativeModule } from 'expo';

/**
 * JS contract for the LocusNet native module (android/.../AnchorNetModule.kt).
 * Exposes real OS-level network-integrity signals — no synthesized values.
 */
declare class LocusNetNativeModule extends NativeModule<Record<string, never>> {
  /**
   * True when a VPN tunnel is up on this device: a tun/tap network interface
   * exists, or the active network reports the TRANSPORT_VPN capability.
   */
  isVpnActive(): boolean;
}

export const LocusNet = requireNativeModule<LocusNetNativeModule>('AnchorNet');
export default LocusNet;
