import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The join screen only needs the identity hook and the api stub.
const state = { uid: null as string | null, loading: false, error: null as string | null };
vi.mock('@/hooks/usePlayerIdentity', () => ({
  useAnonymousUid: () => state,
  saveSession: vi.fn(),
  clearSession: vi.fn(),
  loadSession: () => null,
}));
vi.mock('@/lib/firebase', () => ({ api: { joinGame: vi.fn() } }));

const { Join } = await import('@/pages/player/Join');

function renderJoin(at = '/?code=123456') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Join />
    </MemoryRouter>,
  );
}

describe('the join screen when anonymous sign-in is off', () => {
  // This combination used to leave the button dead with nothing on screen.
  it('explains why instead of silently disabling the button', async () => {
    state.uid = null;
    state.loading = false;
    state.error = "This game can't let players in yet. Ask your teacher to turn on anonymous sign-in for Hootka.";

    renderJoin();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/anonymous sign-in/i);
  });

  it('disables the button while there is no player identity', async () => {
    state.uid = null;
    state.loading = false;
    state.error = 'nope';

    renderJoin();
    const button = await screen.findByRole('button', { name: /let's go/i });
    expect(button).toBeDisabled();
  });

  it('enables the button once a uid arrives', async () => {
    state.uid = 'player-1';
    state.loading = false;
    state.error = null;

    renderJoin();
    const button = await screen.findByRole('button', { name: /let's go/i });
    expect(button).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
