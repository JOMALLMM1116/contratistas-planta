import type { UsuarioSesion } from '../shared/seguridad/tokens.js';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}

export {};
