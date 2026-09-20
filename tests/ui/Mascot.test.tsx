import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Mascot } from '@/components/Mascot';
import { AnswerDistribution } from '@/components/AnswerDistribution';

describe('Mascot', () => {
  it('labels her mood so the feeling is not lost to a screen reader', () => {
    render(<Mascot mood="cheering" />);
    expect(screen.getByRole('img', { name: 'Hootka the owl, cheering' })).toBeInTheDocument();
  });

  it('renders every mood', () => {
    for (const mood of ['happy', 'thinking', 'cheering', 'sad', 'sleeping'] as const) {
      const { unmount } = render(<Mascot mood={mood} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('AnswerDistribution', () => {
  const options = [{ text: 'Owl' }, { text: 'Cow' }, { text: 'Frog' }, { text: 'Bee' }];

  it('shows how many players picked each option', () => {
    render(<AnswerDistribution counts={[12, 3, 0, 5]} correctIndex={0} options={options} />);
    for (const count of ['12', '3', '0', '5']) {
      expect(screen.getByText(count)).toBeInTheDocument();
    }
  });

  it('marks the correct answer with more than colour', () => {
    render(<AnswerDistribution counts={[1, 2, 3, 4]} correctIndex={2} options={options} />);
    expect(screen.getByLabelText('correct answer')).toBeInTheDocument();
  });

  it('handles a question nobody answered', () => {
    render(<AnswerDistribution counts={[0, 0, 0, 0]} correctIndex={1} options={options} />);
    expect(screen.getAllByText('0')).toHaveLength(4);
  });
});
