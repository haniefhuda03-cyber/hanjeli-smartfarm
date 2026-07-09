import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  it('returns the passport user when present', () => {
    const guard = new JwtAuthGuard();
    const user = { id: 'user-1' };

    expect(guard.handleRequest(null, user as never)).toBe(user);
  });

  it('throws a friendly unauthorized error when user is missing', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.handleRequest(null, false)).toThrow(
      new UnauthorizedException('Sesi tidak valid atau sudah berakhir'),
    );
  });
});
