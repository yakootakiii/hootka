import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { rankPlayers } from '@hootka/core';
import { Leaderboard } from '@/components/Leaderboard';
import { Podium } from '@/components/Podium';

const entries = rankPlayers([
  { uid: 'a', name: 'Ana', score: 2600, joinedAt: 1, streak: 2, prevRank: 3, lastPoints: 950, lastAnsweredAt: 10 },
  { uid: 'b', name: 'Ben', score: 2400, joinedAt: 2, streak: 0, prevRank: 1, lastPoints: 0, lastAnsweredAt: 20 },
  { uid: 'c', name: 'Cal', score: 1800, joinedAt: 3, streak: 1, prevRank: 3, lastPoints: 700, lastAnsweredAt: 30 },
  { uid: 'd', name: 'Dia', score: 900, joinedAt: 4, streak: 0, prevRank: 0, lastPoints: 0, lastAnsweredAt: null },
  { uid: 'e', name: 'Eli', score: 400, joinedAt: 5, streak: 0, prevRank: 6, lastPoints: 0, lastAnsweredAt: null },
  { uid: 'f', name: 'Fay', score: 100, joinedAt: 6, streak: 0, prevRank: 7, lastPoints: 0, lastAnsweredAt: null },
]);

describe('Leaderboard', () => {
  it('shows only the top five on the host screen', () => {
    render(<Leaderboard entries={entries} limit={5} />);
    const rows = within(screen.getByRole('list', { name: 'Leaderboard' })).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(screen.queryByText('Fay')).toBeNull();
  });

  it('shows the whole class when asked', () => {
    render(<Leaderboard entries={entries} limit={entries.length} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('describes rank movement in words, not just colour', () => {
    render(<Leaderboard entries={entries} limit={5} />);
    expect(screen.getAllByLabelText('moved up').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('moved down').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('new').length).toBeGreaterThan(0);
  });

  it('shows the points just earned', () => {
    render(<Leaderboard entries={entries} limit={5} />);
    expect(screen.getByText('+950')).toBeInTheDocument();
  });
});

describe('Podium', () => {
  it('names the top three with their scores', () => {
    render(<Podium entries={entries} />);
    for (const name of ['Ana', 'Ben', 'Cal']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.queryByText('Dia')).toBeNull();
  });

  it('describes each position for a screen reader', () => {
    render(<Podium entries={entries} />);
    expect(screen.getByText(/Position 1: Ana, 2600 points/)).toBeInTheDocument();
  });

  it('copes with a game nobody played', () => {
    render(<Podium entries={[]} />);
    expect(screen.getByText('Nobody played this one!')).toBeInTheDocument();
  });

  it('copes with fewer than three players', () => {
    render(<Podium entries={entries.slice(0, 2)} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Ben')).toBeInTheDocument();
  });
});
