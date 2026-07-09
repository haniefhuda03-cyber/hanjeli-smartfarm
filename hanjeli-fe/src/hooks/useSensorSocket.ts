import { useEffect, useState } from 'react';
import { useSocket } from '@/providers/socket-provider';

export interface RealtimeSensorPayload {
  device_code: string;
  ph?: number;
  soil_moisture?: number;
  /** N, P, K adalah tiga nilai terpisah — tidak ada agregat NPK */
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  soil_temperature?: number;
  /** Kondisi hujan saat data diambil (null = perangkat tidak melaporkan) */
  is_raining?: boolean | null;
  /** Waktu pengiriman dari ESP32 — ISO string dari kolom sent_at */
  sent_at?: string;
  /** Epoch ms dari sent_at (kompatibilitas chart) */
  ts?: number;
}

export function useSensorSocket() {
  const { socket, isConnected: socketConnected } = useSocket();
  const [sensorData, setSensorData] = useState<RealtimeSensorPayload | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleRealtimeSensor = (data: RealtimeSensorPayload) => {
      setSensorData(data);
    };

    socket.on('sensor:realtime', handleRealtimeSensor);

    return () => {
      socket.off('sensor:realtime', handleRealtimeSensor);
    };
  }, [socket]);

  return { sensorData, isConnected: socketConnected };
}
