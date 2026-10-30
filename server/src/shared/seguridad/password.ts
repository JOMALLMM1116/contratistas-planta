import { hash, verify } from '@node-rs/argon2';

// argon2id (el algoritmo por defecto de la libreria) con los parametros
// minimos recomendados por OWASP: 19 MiB de memoria, 2 iteraciones, 1 hilo
const OPCIONES = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string) {
  return hash(password, OPCIONES);
}

// Nunca lanza error: un hash corrupto se trata como contrasena incorrecta
export async function verificarPassword(hashGuardado: string, password: string) {
  try {
    return await verify(hashGuardado, password);
  } catch {
    return false;
  }
}
