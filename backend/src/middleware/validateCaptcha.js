import { AppError } from './errorHandler.js';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = 0.5;

export async function validateCaptcha(req, res, next) {
  const token = req.body?.captchaToken;

  if (!token) {
    return next(new AppError('Captcha token is required', 400));
  }

  try {
    const params = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: token,
    });

    const response = await fetch(`${VERIFY_URL}?${params}`, { method: 'POST' });
    const data = await response.json();

    if (!data.success || data.score < MIN_SCORE) {
      return next(new AppError('Captcha validation failed', 403));
    }

    next();
  } catch {
    next(new AppError('Could not verify captcha', 500));
  }
}
