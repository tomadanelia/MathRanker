
import { Test, TestingModule } from '@nestjs/testing';
import { EloService, GlickoPlayer, GlickoMatch } from './elo.service';

describe('EloService (Glicko-2)', () => {
  let service: EloService;

  const establishedPlayer: GlickoPlayer = {
    rating: 1500,
    rd: 50,
    vol: 0.06,
  };

  const newPlayer: GlickoPlayer = {
    rating: 1400,
    rd: 350, 
    vol: 0.06,
  };

  const highlyRatedPlayer: GlickoPlayer = {
    rating: 2000,
    rd: 70,
    vol: 0.06,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EloService],
    }).compile();

    service = module.get<EloService>(EloService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateNewRatings', () => {
    it('should correctly calculate ratings after a win for an established player', () => {
      const playerA = { ...establishedPlayer };
      const playerB = { ...establishedPlayer };

      const matches: GlickoMatch[] = [[playerB.rating, playerB.rd, 1]]; 

      const result = service.calculateNewRatings(playerA, matches);

      expect(result.rating).toBeGreaterThan(1500);
      expect(result.rating).toBeCloseTo(1535.5, 1); 
      expect(result.rd).toBeCloseTo(49.3, 1);
    });

    it('should calculate a large rating gain for a new player winning', () => {
      const playerA = { ...newPlayer };
      const playerB = { ...establishedPlayer };

      const matches: GlickoMatch[] = [[playerB.rating, playerB.rd, 1]]; // 1 = win

      const result = service.calculateNewRatings(playerA, matches);

      expect(result.rating).toBeGreaterThan(1400);
      expect(result.rating).toBeGreaterThan(1550); // Should jump significantly
      expect(result.rd).toBeLessThan(350); // Certainty should increase (RD goes down)
    });

    it('should calculate a small rating gain for a highly-rated player winning', () => {
      // SCENARIO: A very strong player (2000) beats an average player (1500).
      const playerA = { ...highlyRatedPlayer };
      const playerB = { ...establishedPlayer };

      const matches: GlickoMatch[] = [[playerB.rating, playerB.rd, 1]]; // 1 = win

      const result = service.calculateNewRatings(playerA, matches);

      // EXPECTATIONS: A very small gain, as this was the expected outcome.
      expect(result.rating).toBeGreaterThan(2000);
      expect(result.rating).toBeLessThan(2010); // Should be a tiny increase
    });

    it('should correctly calculate ratings after a draw', () => {
      // SCENARIO: Two equal established players draw.
      const playerA = { ...establishedPlayer };
      const playerB = { ...establishedPlayer };

      const matches: GlickoMatch[] = [[playerB.rating, playerB.rd, 0.5]]; // 0.5 = draw

      const result = service.calculateNewRatings(playerA, matches);

      // EXPECTATIONS: Rating should barely change, if at all.
      expect(result.rating).toBeCloseTo(1500, 0);
    });

    it('should update a player who did not play in a rating period (only RD increases)', () => {
        const playerA = { ...establishedPlayer };
        const matches: GlickoMatch[] = []; // No matches played

        const result = service.calculateNewRatings(playerA, matches);

        expect(result.rating).toEqual(playerA.rating);
        expect(result.vol).toEqual(playerA.vol);
        expect(result.rd).toBeGreaterThan(playerA.rd);
    });
  });
});