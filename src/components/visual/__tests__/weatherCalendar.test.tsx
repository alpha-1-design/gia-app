import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { WeatherVisual } from '../WeatherVisual';
import { CalendarVisual } from '../CalendarVisual';
import { aqiBand, normalizeCondition, formatTemp } from '../weatherUtils';
import { bucketEvents, parseWhen, dayKey } from '../calendarUtils';
import { parseVisualBlock } from '../parseVisualBlock';

afterEach(cleanup);

describe('weather helpers', () => {
  it('maps free-text conditions to an icon', () => {
    expect(normalizeCondition('Light Rain')).toBe('rain');
    expect(normalizeCondition('Thunderstorms likely')).toBe('storm');
    expect(normalizeCondition('Partly cloudy')).toBe('partly-cloudy');
    expect(normalizeCondition('Overcast')).toBe('cloudy');
    expect(normalizeCondition(undefined)).toBe('sunny');
  });
  it('uses the EPA AQI bands', () => {
    expect(aqiBand(30).label).toBe('Good');
    expect(aqiBand(100).label).toBe('Moderate');
    expect(aqiBand(151).label).toBe('Unhealthy');
    expect(aqiBand(400).label).toBe('Hazardous');
  });
  it('formats temperatures and survives junk', () => {
    expect(formatTemp(23.4, 'C')).toBe('23°C');
    expect(formatTemp('abc', 'C')).toBe('—');
  });
});

describe('WeatherVisual', () => {
  const data = { location: 'Kumasi, Ghana', temp: 29, unit: 'C', condition: 'partly cloudy', humidity: 71, wind: 8, aqi: 42, forecast: [{ day: 'Tue', temp: 30, condition: 'rain' }] };
  it('shows the headline and hides details until tapped', () => {
    render(<WeatherVisual data={data} />);
    expect(screen.getByText('29°C')).toBeInTheDocument();
    expect(screen.getByText('Kumasi, Ghana')).toBeInTheDocument();
    expect(screen.queryByText('Humidity')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Humidity')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Forecast' })).toBeInTheDocument();
  });
  it('is not clickable when there is nothing more to show', () => {
    render(<WeatherVisual data={{ temp: 20, condition: 'sunny' }} />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-expanded');
  });
});

describe('calendar helpers', () => {
  it('treats date-only values as local dates, not UTC', () => {
    const d = parseWhen('2026-10-09')!;
    expect(d.getDate()).toBe(9);
    expect(dayKey(d)).toBe('2026-10-09');
  });
  it('fills gaps so empty days appear on the strip and sorts by time', () => {
    const days = bucketEvents([
      { title: 'B', start: '2026-10-11T15:00:00' },
      { title: 'A', start: '2026-10-09T09:00:00' },
      { title: 'A2', start: '2026-10-09T08:00:00' },
      { title: 'bad', start: 'not a date' },
    ]);
    expect(days.map(x => x.key)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
    expect(days[0].events.map(e => e.title)).toEqual(['A2', 'A']);
    expect(days[1].events).toHaveLength(0);
  });
  it('caps the strip length', () => {
    expect(bucketEvents([{ title: 'x', start: '2026-01-01' }, { title: 'y', start: '2026-12-31' }], 14)).toHaveLength(14);
  });
});

describe('CalendarVisual', () => {
  const events = [
    { title: 'Standup', start: '2026-10-09T09:00:00', end: '2026-10-09T09:15:00', location: 'Zoom' },
    { title: 'Exam prep', start: '2026-10-11T16:00:00' },
  ];
  it('opens on the first day with events and switches days on tap', () => {
    render(<CalendarVisual data={{ title: 'This week', events }} />);
    expect(screen.getByText('Standup')).toBeInTheDocument();
    expect(screen.queryByText('Exam prep')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /11.*1 events/ }));
    expect(screen.getByText('Exam prep')).toBeInTheDocument();
  });
  it('says so when a day is free', () => {
    render(<CalendarVisual data={{ events }} />);
    fireEvent.click(screen.getByRole('button', { name: /10.*0 events/ }));
    expect(screen.getByText(/free day/i)).toBeInTheDocument();
  });
  it('handles no events', () => {
    render(<CalendarVisual data={{ events: [] }} />);
    expect(screen.getByText(/nothing on the calendar/i)).toBeInTheDocument();
  });
});

describe('visual block parsing for the new types', () => {
  it('parses weather and calendar blocks', () => {
    expect('error' in parseVisualBlock('{"type":"weather","data":{"temp":20}}')).toBe(false);
    expect('error' in parseVisualBlock('{"type":"calendar","data":{"events":[]}}')).toBe(false);
  });
});
