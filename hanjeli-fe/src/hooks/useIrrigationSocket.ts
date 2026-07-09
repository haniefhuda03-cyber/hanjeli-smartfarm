import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/providers/socket-provider';

export interface IrrigationStatus {
  mode: 'auto' | 'manual' | 'scheduled' | 'off';
  emergency: boolean;
  speed: number;
  fertilizer_speed?: number;
  manual_water_enabled?: boolean;
  manual_fertilizer_enabled?: boolean;
}

type IrrigationModeConfig = {
  manual_speed?: number;
  auto_parameter?: string;
  auto_threshold_value?: number;
  auto_threshold_direction?: string;
  water_min_threshold?: number;
  water_max_threshold?: number;
  npk_min_threshold?: number;
  npk_max_threshold?: number;
  nitrogen_min_threshold?: number;
  nitrogen_max_threshold?: number;
  phosphorus_min_threshold?: number;
  phosphorus_max_threshold?: number;
  potassium_min_threshold?: number;
  potassium_max_threshold?: number;
  manual_water_enabled?: boolean;
  manual_fertilizer_enabled?: boolean;
  fertilizer_manual_speed?: number;
  scheduled_behavior?: string;
}

export function useIrrigationSocket() {
  const { socket, isConnected } = useSocket();
  const [irrigationStatus, setIrrigationStatus] = useState<IrrigationStatus | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data: IrrigationStatus) => {
      setIrrigationStatus(data);
      if (data.emergency !== undefined) {
        setIsEmergency(data.emergency);
      }
    };

    const handleEmergency = (data: { active: boolean; ts: number }) => {
      setIsEmergency(data.active);
    };

    socket.on('irrigation:status', handleStatus);
    socket.on('irrigation:emergency', handleEmergency);

    return () => {
      socket.off('irrigation:status', handleStatus);
      socket.off('irrigation:emergency', handleEmergency);
    };
  }, [socket]);

  const setMode = useCallback((mode: string, config?: IrrigationModeConfig) => {
    if (socket && isConnected) {
      socket.emit('irrigation:setMode', { mode, config });
    }
  }, [socket, isConnected]);

  const triggerEmergencyStop = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('irrigation:emergencyStop');
    }
  }, [socket, isConnected]);

  const resumeSystem = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('irrigation:resume');
    }
  }, [socket, isConnected]);

  const toggleManual = useCallback((active: boolean, speed?: number, channel: 'water' | 'fertilizer' = 'water') => {
    if (socket && isConnected) {
      socket.emit('irrigation:manualToggle', { active, speed, channel });
    }
  }, [socket, isConnected]);

  return {
    isConnected,
    irrigationStatus,
    isEmergency,
    setMode,
    triggerEmergencyStop,
    resumeSystem,
    toggleManual
  };
}
