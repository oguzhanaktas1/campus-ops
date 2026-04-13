export const AUTH_COOKIE_NAME = 'campusops_session';

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
}
