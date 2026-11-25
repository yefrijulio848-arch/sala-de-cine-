/* ==========================================================================
   Cine Majestad - Limitador de Intentos y Bloqueo de Seguridad (Login Lockout)
   Regla: Tras 5 intentos fallidos se bloquea el acceso durante 15 minutos.
   ========================================================================== */

const failedAttemptsMap = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

function getClientKey(req, email) {
  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";
  const cleanEmail = (email || "").toLowerCase().trim();
  return cleanEmail ? `${cleanEmail}_${ip}` : ip;
}

/**
 * Verifica si el usuario / IP está actualmente bloqueado
 */
function checkLoginLockout(req, email) {
  const key = getClientKey(req, email);
  const record = failedAttemptsMap.get(key);

  if (!record) {
    return { locked: false, attemptsLeft: MAX_ATTEMPTS, failedAttempts: 0 };
  }

  const now = Date.now();
  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      const remainingMs = record.lockedUntil - now;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return {
        locked: true,
        remainingSeconds,
        remainingMinutes,
        attemptsLeft: 0,
        failedAttempts: MAX_ATTEMPTS
      };
    } else {
      // Período de bloqueo cumplido: restablecer
      failedAttemptsMap.delete(key);
      return { locked: false, attemptsLeft: MAX_ATTEMPTS, failedAttempts: 0 };
    }
  }

  const failed = record.count || 0;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - failed);
  return { locked: false, attemptsLeft, failedAttempts: failed };
}

/**
 * Registra un intento fallido de inicio de sesión
 */
function recordFailedLogin(req, email) {
  const key = getClientKey(req, email);
  const now = Date.now();
  let record = failedAttemptsMap.get(key);

  if (!record) {
    record = { count: 0, lockedUntil: null, firstAttempt: now };
  }

  record.count = (record.count || 0) + 1;
  record.lastAttempt = now;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    failedAttemptsMap.set(key, record);
    return {
      locked: true,
      attemptsLeft: 0,
      failedAttempts: MAX_ATTEMPTS,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
      remainingMinutes: 15
    };
  }

  failedAttemptsMap.set(key, record);
  return {
    locked: false,
    attemptsLeft: MAX_ATTEMPTS - record.count,
    failedAttempts: record.count,
    remainingSeconds: 0
  };
}

/**
 * Restablece los intentos tras un inicio de sesión exitoso
 */
function resetLoginLockout(req, email) {
  const key = getClientKey(req, email);
  failedAttemptsMap.delete(key);
}

module.exports = {
  checkLoginLockout,
  recordFailedLogin,
  resetLoginLockout,
  MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS
};
