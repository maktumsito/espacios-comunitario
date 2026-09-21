// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DailyUsageView } from '../DailyUsageView';
import { ReservationModal } from '../ReservationModal';
import { FilterBar } from '../FilterBar';
import { filterReservations } from '../../utils/filterReservations';
import { INITIAL_RESERVATIONS } from '../../data/initialData';
import { FilterState } from '../../types';

// Fail immediately if an isolated UI test attempts to access live data.
vi.mock('../../firebase/config', () => ({
  getDb: () => { throw new Error('Live database access is not allowed in UI tests'); },
}));

const emptyFilters: FilterState = {
  search: '', espacio: '', tipoActividad: '', fechaDesde: '', fechaHasta: '',
  soloRecurrentes: false, soloImportantes: false, soloConTopamiento: false,
};

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe('Reservation time validation', () => {
  it('blocks reversed and equal times, shows the error, and recovers after correction', () => {
    render(<ReservationModal isOpen onClose={vi.fn()} onSave={vi.fn()}
      allReservations={[]} initialDate="2026-09-22" initialSpace="AUDITORIO" />);
    const start = screen.getByLabelText('Hora de inicio de la reserva') as HTMLInputElement;
    const end = screen.getByLabelText('Hora de término de la reserva') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '14:00' } });
    fireEvent.change(end, { target: { value: '13:00' } });
    const next = screen.getByRole('button', { name: 'Siguiente: Solicitante' }) as HTMLButtonElement;
    expect(start.value).toBe('14:00');
    expect(end.value).toBe('13:00');
    expect(next.disabled).toBe(true);
    expect(document.getElementById('time-validation-error-message')?.textContent)
      .toContain('La hora de término (13:00) debe ser posterior a la de inicio (14:00)');
    expect(end.getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(next);
    expect(screen.getByRole('button', { name: 'Siguiente: Solicitante' })).toBeTruthy();
    fireEvent.change(end, { target: { value: '14:00' } });
    expect(next.disabled).toBe(true);
    fireEvent.change(end, { target: { value: '15:00' } });
    expect(next.disabled).toBe(false);
    expect(screen.queryByText(/La hora de término .* debe ser posterior/)).toBeNull();
    fireEvent.change(end, { target: { value: '' } });
    expect(end.value).toBe('');
    expect(next.disabled).toBe(true);
  });
});

describe('Manual agenda date', () => {
  it.each([false, true])('updates the heading and parent callback (controlled=%s)', (controlled) => {
    const onDateChange = vi.fn();
    function Agenda() {
      const [date, setDate] = useState(new Date(2026, 8, 20));
      return <DailyUsageView reservations={[]} initialDate={new Date(2026, 8, 20)}
        selectedDate={controlled ? date : undefined}
        onDateChange={d => { onDateChange(d); if (controlled) setDate(d); }}
        onSelectReservation={vi.fn()} onNewReservationWithSlot={vi.fn()} />;
    }
    render(<Agenda />);
    fireEvent.change(screen.getByLabelText('Seleccionar fecha para ver el horario'), {
      target: { value: '2026-09-22' },
    });
    expect(screen.getByText('martes, 22-09-2026')).toBeTruthy();
    expect(screen.queryByText('domingo, 20-09-2026')).toBeNull();
    const selected = onDateChange.mock.calls[0][0] as Date;
    expect([selected.getFullYear(), selected.getMonth(), selected.getDate()]).toEqual([2026, 8, 22]);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al día siguiente' }));
    expect(screen.getByText('miércoles, 23-09-2026')).toBeTruthy();
  });
});

describe('Date range filtering', () => {
  it('shows zero matches for all of 2027 and restores records when cleared', () => {
    const records = Array.from({ length: 6000 }, (_, i) => ({
      ...INITIAL_RESERVATIONS[0], id: String(i), fecha: '2026-09-22',
    }));
    function Filters() {
      const [filters, setFilters] = useState(emptyFilters);
      return <FilterBar filters={filters} onFilterChange={setFilters}
        onResetFilters={() => setFilters(emptyFilters)}
        totalAll={records.length}
        totalFiltered={filterReservations(records, filters).length} />;
    }
    render(<Filters />);
    const from = screen.getByLabelText('Filtrar desde fecha');
    const to = screen.getByLabelText('Filtrar hasta fecha');
    fireEvent.change(from, { target: { value: '2027-01-01' } });
    fireEvent.change(to, { target: { value: '2027-12-31' } });
    expect(screen.getByText(/Mostrando/).textContent).toMatch(/Mostrando 0 de 6000 reservas/);
    fireEvent.change(from, { target: { value: '' } });
    fireEvent.change(to, { target: { value: '' } });
    expect(screen.getByText(/Mostrando/).textContent).toMatch(/Mostrando 6000 de 6000 reservas/);
  });

  it('includes both boundaries, supports one-sided ranges and rejects reversed ranges', () => {
    const records = ['2026-09-21', '2026-09-22', '2026-09-23', '24-09-2026']
      .map((fecha, i) => ({ ...INITIAL_RESERVATIONS[0], id: String(i), fecha }));
    const filter = (fechaDesde: string, fechaHasta: string) =>
      filterReservations(records, { ...emptyFilters, fechaDesde, fechaHasta }).map(r => r.id);
    expect(filter('2026-09-22', '2026-09-23')).toEqual(['1', '2']);
    expect(filter('', '2026-09-22')).toEqual(['0', '1']);
    expect(filter('2026-09-23', '')).toEqual(['2', '3']);
    expect(filter('2026-09-23', '2026-09-22')).toEqual([]);
    expect(filter('2027', '2027')).toEqual([]);
  });
});
