import { useState, useCallback } from 'react';
import { Reservation, SpaceInfo } from '../types';
import { CustomScheduleSlot } from '../components/RecurrenceScheduleSection';

interface UseReservationCustomSchedulesParams {
  formData: Partial<Reservation>;
  initialSpace?: string;
  availableSpaces: SpaceInfo[];
  specificDates: string[];
  selectedDays: number[];
}

export function useReservationCustomSchedules({
  formData,
  initialSpace,
  availableSpaces,
  specificDates,
  selectedDays
}: UseReservationCustomSchedulesParams) {
  // Multi-day custom schedules state
  const [useCustomSchedulesPerDate, setUseCustomSchedulesPerDate] = useState<boolean>(false);
  const [dateSchedules, setDateSchedules] = useState<Record<string, CustomScheduleSlot>>({});

  // Weekly pattern custom schedules state
  const [useCustomSchedulesPerDay, setUseCustomSchedulesPerDay] = useState<boolean>(false);
  const [daySchedules, setDaySchedules] = useState<Record<number, CustomScheduleSlot>>({
    1: { horaInicio: '10:00', horaFin: '11:00', espacio: initialSpace || 'TATAMI', hasSecondSlot: false, secondHoraInicio: '11:00', secondHoraFin: '12:00', secondEspacio: 'SALA 2' },
    2: { horaInicio: '10:00', horaFin: '11:00', espacio: initialSpace || 'TATAMI', hasSecondSlot: false, secondHoraInicio: '11:00', secondHoraFin: '12:00', secondEspacio: 'SALA 2' },
    3: { horaInicio: '10:00', horaFin: '11:00', espacio: initialSpace || 'TATAMI', hasSecondSlot: false, secondHoraInicio: '11:00', secondHoraFin: '12:00', secondEspacio: 'SALA 2' },
    4: { horaInicio: '10:00', horaFin: '11:00', espacio: initialSpace || 'TATAMI', hasSecondSlot: false, secondHoraInicio: '11:00', secondHoraFin: '12:00', secondEspacio: 'SALA 2' },
    5: { horaInicio: '10:00', horaFin: '11:00', espacio: initialSpace || 'TATAMI', hasSecondSlot: false, secondHoraInicio: '11:00', secondHoraFin: '12:00', secondEspacio: 'SALA 2' },
    6: { horaInicio: '10:00', horaFin: '11:00', espacio: initialSpace || 'TATAMI', hasSecondSlot: false, secondHoraInicio: '11:00', secondHoraFin: '12:00', secondEspacio: 'SALA 2' },
    0: { horaInicio: '10:00', horaFin: '11:00', espacio: initialSpace || 'TATAMI', hasSecondSlot: false, secondHoraInicio: '11:00', secondHoraFin: '12:00', secondEspacio: 'SALA 2' }
  });

  // Handlers for custom schedules per date
  const handleUpdateDateSchedule = useCallback((
    dateStr: string,
    field: keyof CustomScheduleSlot,
    value: any
  ) => {
    setDateSchedules((prev) => {
      const existing = prev[dateStr] || {
        horaInicio: formData.horaInicio || '10:00',
        horaFin: formData.horaFin || '11:00',
        espacio: formData.espacio,
        hasSecondSlot: false,
        secondHoraInicio: formData.horaFin || '11:00',
        secondHoraFin: '12:00',
        secondEspacio: availableSpaces.find((s) => s.name !== formData.espacio)?.name || availableSpaces[1]?.name || 'SALA 2'
      };
      return {
        ...prev,
        [dateStr]: {
          ...existing,
          [field]: value
        }
      };
    });
  }, [formData.horaInicio, formData.horaFin, formData.espacio, availableSpaces]);

  const handleCopyDateScheduleToAll = useCallback((sourceDateStr: string) => {
    const source = dateSchedules[sourceDateStr] || {
      horaInicio: formData.horaInicio || '10:00',
      horaFin: formData.horaFin || '11:00',
      espacio: formData.espacio,
      hasSecondSlot: false,
      secondHoraInicio: formData.horaFin || '11:00',
      secondHoraFin: '12:00',
      secondEspacio: availableSpaces.find((s) => s.name !== formData.espacio)?.name || availableSpaces[1]?.name || 'SALA 2'
    };
    setDateSchedules((prev) => {
      const next: Record<string, CustomScheduleSlot> = { ...prev };
      specificDates.forEach((d) => {
        next[d] = { ...source };
      });
      return next;
    });
  }, [dateSchedules, formData.horaInicio, formData.horaFin, formData.espacio, availableSpaces, specificDates]);

  const handleApplyBaseToAllDates = useCallback(() => {
    const secondDefault = availableSpaces.find((s) => s.name !== formData.espacio)?.name || availableSpaces[1]?.name || 'SALA 2';
    setDateSchedules(() => {
      const next: Record<string, CustomScheduleSlot> = {};
      specificDates.forEach((d) => {
        next[d] = {
          horaInicio: formData.horaInicio || '10:00',
          horaFin: formData.horaFin || '11:00',
          espacio: formData.espacio,
          hasSecondSlot: false,
          secondHoraInicio: formData.horaFin || '11:00',
          secondHoraFin: '12:00',
          secondEspacio: secondDefault
        };
      });
      return next;
    });
  }, [formData.horaInicio, formData.horaFin, formData.espacio, availableSpaces, specificDates]);

  // Handlers for custom schedules per weekday in pattern
  const handleUpdateDaySchedule = useCallback((
    dayNum: number,
    field: keyof CustomScheduleSlot,
    value: any
  ) => {
    setDaySchedules((prev) => {
      const existing = prev[dayNum] || {
        horaInicio: formData.horaInicio || '10:00',
        horaFin: formData.horaFin || '11:00',
        espacio: formData.espacio,
        hasSecondSlot: false,
        secondHoraInicio: formData.horaFin || '11:00',
        secondHoraFin: '12:00',
        secondEspacio: availableSpaces.find((s) => s.name !== formData.espacio)?.name || availableSpaces[1]?.name || 'SALA 2'
      };
      return {
        ...prev,
        [dayNum]: {
          ...existing,
          [field]: value
        }
      };
    });
  }, [formData.horaInicio, formData.horaFin, formData.espacio, availableSpaces]);

  const handleCopyDayScheduleToAll = useCallback((sourceDayNum: number) => {
    const source = daySchedules[sourceDayNum] || {
      horaInicio: formData.horaInicio || '10:00',
      horaFin: formData.horaFin || '11:00',
      espacio: formData.espacio,
      hasSecondSlot: false,
      secondHoraInicio: formData.horaFin || '11:00',
      secondHoraFin: '12:00',
      secondEspacio: availableSpaces.find((s) => s.name !== formData.espacio)?.name || availableSpaces[1]?.name || 'SALA 2'
    };
    setDaySchedules((prev) => {
      const next: Record<number, CustomScheduleSlot> = { ...prev };
      selectedDays.forEach((d) => {
        next[d] = { ...source };
      });
      return next;
    });
  }, [daySchedules, formData.horaInicio, formData.horaFin, formData.espacio, availableSpaces, selectedDays]);

  const handleApplyBaseToAllDays = useCallback(() => {
    const secondDefault = availableSpaces.find((s) => s.name !== formData.espacio)?.name || availableSpaces[1]?.name || 'SALA 2';
    setDaySchedules(() => {
      const next: Record<number, CustomScheduleSlot> = {};
      selectedDays.forEach((d) => {
        next[d] = {
          horaInicio: formData.horaInicio || '10:00',
          horaFin: formData.horaFin || '11:00',
          espacio: formData.espacio,
          hasSecondSlot: false,
          secondHoraInicio: formData.horaFin || '11:00',
          secondHoraFin: '12:00',
          secondEspacio: secondDefault
        };
      });
      return next;
    });
  }, [formData.horaInicio, formData.horaFin, formData.espacio, availableSpaces, selectedDays]);

  return {
    useCustomSchedulesPerDate,
    setUseCustomSchedulesPerDate,
    dateSchedules,
    setDateSchedules,
    useCustomSchedulesPerDay,
    setUseCustomSchedulesPerDay,
    daySchedules,
    setDaySchedules,
    handleUpdateDateSchedule,
    handleCopyDateScheduleToAll,
    handleApplyBaseToAllDates,
    handleUpdateDaySchedule,
    handleCopyDayScheduleToAll,
    handleApplyBaseToAllDays
  };
}
