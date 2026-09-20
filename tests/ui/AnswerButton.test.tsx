import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnswerButton } from '@/components/AnswerButton';
import { ANSWER_STYLES } from '@/lib/answerStyles';

describe('AnswerButton', () => {
  it('announces the colour, the shape and the answer text', () => {
    render(<AnswerButton index={0} text="Owl" />);
    expect(screen.getByRole('button', { name: 'Red triangle: Owl' })).toBeTruthy();
  });

  // Section 6: colour alone must never carry the meaning.
  it('draws a distinct shape for each of the four colours', () => {
    const { container } = render(
      <>
        {ANSWER_STYLES.map((_, index) => (
          <AnswerButton key={index} index={index} text={`Option ${index}`} />
        ))}
      </>,
    );
    const paths = [...container.querySelectorAll('svg path')].map((path) => path.getAttribute('d'));
    expect(new Set(paths).size).toBe(4);
  });

  it('calls back when tapped', async () => {
    const onClick = vi.fn();
    render(<AnswerButton index={1} text="Cow" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('cannot be tapped once disabled', async () => {
    const onClick = vi.fn();
    render(<AnswerButton index={1} text="Cow" onClick={onClick} disabled />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is not a button on the host screen, where it is only a display', () => {
    render(<AnswerButton index={2} text="Frog" asStatic />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Frog')).toBeTruthy();
  });

  it('marks the correct answer on the result screen', () => {
    render(<AnswerButton index={3} text="Owl" asStatic highlight="correct" />);
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('keeps the four answer colours exactly as the spec fixes them', () => {
    expect(ANSWER_STYLES.map((style) => [style.hex, style.shape])).toEqual([
      ['#FF5A5F', 'triangle'],
      ['#3D8BFF', 'diamond'],
      ['#FFC93C', 'circle'],
      ['#3DDC84', 'square'],
    ]);
  });
});
