import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Timer } from '@/components/Timer';

const T0 = 1_700_000_000_000;

describe('Timer', () => {
  it('counts down from the server start time', () => {
    const { rerender } = render(<Timer questionStartedAt={T0} serverNow={T0} />);
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('10 seconds left');

    rerender(<Timer questionStartedAt={T0} serverNow={T0 + 6_200} />);
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('4 seconds left');
  });

  it('stops at zero rather than going negative', () => {
    render(<Timer questionStartedAt={T0} serverNow={T0 + 25_000} />);
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('0 seconds left');
  });

  // The host client closes the question at the buzzer.
  it('fires onExpire exactly once when the window closes', () => {
    const onExpire = vi.fn();
    const { rerender } = render(
      <Timer questionStartedAt={T0} serverNow={T0 + 9_000} onExpire={onExpire} />,
    );
    expect(onExpire).not.toHaveBeenCalled();

    rerender(<Timer questionStartedAt={T0} serverNow={T0 + 10_000} onExpire={onExpire} />);
    rerender(<Timer questionStartedAt={T0} serverNow={T0 + 10_500} onExpire={onExpire} />);
    rerender(<Timer questionStartedAt={T0} serverNow={T0 + 12_000} onExpire={onExpire} />);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('re-arms for the next question', () => {
    const onExpire = vi.fn();
    const { rerender } = render(
      <Timer questionStartedAt={T0} serverNow={T0 + 11_000} onExpire={onExpire} />,
    );
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Next question: the node is cleared, then stamped again.
    rerender(<Timer questionStartedAt={null} serverNow={T0 + 12_000} onExpire={onExpire} />);
    rerender(<Timer questionStartedAt={T0 + 20_000} serverNow={T0 + 20_100} onExpire={onExpire} />);
    rerender(<Timer questionStartedAt={T0 + 20_000} serverNow={T0 + 31_000} onExpire={onExpire} />);
    expect(onExpire).toHaveBeenCalledTimes(2);
  });

  it('ticks only in the last three seconds, once per second', () => {
    const onTick = vi.fn();
    const { rerender } = render(<Timer questionStartedAt={T0} serverNow={T0} onTick={onTick} />);
    for (const ms of [1_000, 4_000, 6_500, 7_100, 7_500, 8_200, 9_100, 9_600]) {
      rerender(<Timer questionStartedAt={T0} serverNow={T0 + ms} onTick={onTick} />);
    }
    expect(onTick.mock.calls.map(([seconds]) => seconds)).toEqual([3, 2, 1]);
  });

  it('shows a bar for the player screen and a ring for the host', () => {
    const { container, rerender } = render(
      <Timer questionStartedAt={T0} serverNow={T0 + 5_000} variant="bar" />,
    );
    expect(container.querySelector('svg')).toBeNull();

    rerender(<Timer questionStartedAt={T0} serverNow={T0 + 5_000} variant="ring" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
