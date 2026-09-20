import { describe, it, expect } from 'vitest';
import { isEligibleForRating, isBirthdayReservation } from '../../services/ratingService';
import { Reservation } from '../../types';

describe('CAM Exclusion Tests (Hallazgo 7)', () => {
  const standardBirthday: Reservation = {
    id: 'R1',
    fecha: '2026-09-05',
    horaInicio: '15:00',
    horaFin: '18:00',
    espacio: 'SALA COMUNITARIA',
    responsable: 'Juan Pérez',
    tipoActividad: 'PRÉSTAMO',
    tipoPrestamo: 'CUMPLEAÑOS',
    descripcion: 'Cumpleaños infantil 6 años',
    actividadRecurrente: 'No'
  };

  it('Standard birthday loan should be eligible for rating', () => {
    expect(isEligibleForRating(standardBirthday)).toBe(true);
  });

  it('Birthday mentioning CAM in description should be excluded', () => {
    const camInDesc: Reservation = {
      ...standardBirthday,
      id: 'R2',
      descripcion: 'Préstamo de cumpleaños coordinado con CAM Apoquindo'
    };
    expect(isEligibleForRating(camInDesc)).toBe(false);
    expect(isBirthdayReservation(camInDesc)).toBe(false);
  });

  it('Birthday with CAM in responsible should be excluded', () => {
    const camInResp: Reservation = {
      ...standardBirthday,
      id: 'R3',
      responsable: 'Delegación CAM Los Dominicos'
    };
    expect(isEligibleForRating(camInResp)).toBe(false);
    expect(isBirthdayReservation(camInResp)).toBe(false);
  });

  it('Municipal activity should be excluded even with birthday loan', () => {
    const municipalAct: Reservation = {
      ...standardBirthday,
      id: 'R4',
      tipoActividad: 'ACTIVIDADES MUNICIPALES',
      descripcion: 'Cumpleaños comunitario municipal'
    };
    expect(isEligibleForRating(municipalAct)).toBe(false);
  });
});
