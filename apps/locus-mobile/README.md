# LOCUS Mobile

**On-device GNSS integrity monitoring cockpit for Android.**

Authoritative mobile client running real-time RAIM/FDE sensor fusion, 7 physics checks, debounced recovery state machine, on-device AI plain-language advisories (Qwen3 0.6B), voice transcription (Whisper Base EN), semantic search (MPNet), and non-invasive operator console synchronization.

## Architecture

- **Authoritative Integrity**: Evaluates raw Android GNSS signals (`GnssMeasurements`), IMU accelerometer/gyroscope/magnetometer, barometric pressure, and OS-level network tunnels.
- **On-Device AI Runtime**: Local ExecuTorch engine for sub-280ms plain-language incident explanations and embedding generation.
- **Flight Log**: Authoritative state-transition journal with newest-first ordering and full vector search.
- **Real-Time Sync**: Non-blocking observer path broadcasting live telemetry and integrity alerts to LOCUS Office Kit (`/api/events`).

## Run & Test

```bash
# Typecheck
npx tsc --noEmit

# Unit & component tests
npx jest

# Start development client
npx expo start --dev-client
```
