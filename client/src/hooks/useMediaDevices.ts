import { useEffect, useState } from 'react';

export interface DeviceOption {
  deviceId: string;
  label: string;
}

interface Devices {
  inputs: DeviceOption[];
  outputs: DeviceOption[];
}

async function enumerate(): Promise<Devices> {
  if (!navigator.mediaDevices?.enumerateDevices) return { inputs: [], outputs: [] };
  const all = await navigator.mediaDevices.enumerateDevices();
  const toOption = (d: MediaDeviceInfo, i: number, fallback: string): DeviceOption => ({
    deviceId: d.deviceId,
    label: d.label || `${fallback} ${i + 1}`,
  });
  const inputs = all.filter((d) => d.kind === 'audioinput' && d.deviceId);
  const outputs = all.filter((d) => d.kind === 'audiooutput' && d.deviceId);
  return {
    inputs: inputs.map((d, i) => toOption(d, i, 'Microfone')),
    outputs: outputs.map((d, i) => toOption(d, i, 'Saída')),
  };
}

/** Audio devices, refreshed on hot-plug. Labels appear once mic permission is granted. */
export function useMediaDevices(refreshKey?: unknown): Devices {
  const [devices, setDevices] = useState<Devices>({ inputs: [], outputs: [] });

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void enumerate()
        .then((d) => alive && setDevices(d))
        .catch(() => undefined);
    refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
    };
  }, [refreshKey]);

  return devices;
}
