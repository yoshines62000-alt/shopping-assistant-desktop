import { render, screen } from '@testing-library/react';
import ScoreDetails from './ScoreDetails';

describe('ScoreDetails', () => {
  it('affiche les cinq composantes du score', () => {
    render(
      <ScoreDetails
        scores={{ price: 80, delivery: 60, reviews: 70, site: 90, popularity: 50, final: 74 }}
      />
    );
    expect(screen.getByText('Prix')).toBeInTheDocument();
    expect(screen.getByText('Délais')).toBeInTheDocument();
    expect(screen.getByText('Avis')).toBeInTheDocument();
    expect(screen.getByText('Site')).toBeInTheDocument();
    expect(screen.getByText('Popularité')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
