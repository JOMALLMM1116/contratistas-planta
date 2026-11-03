import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requiereAuth } from '../../shared/middlewares/auth.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

// Maximo 10 intentos de login por IP cada 15 minutos (ademas del bloqueo por cuenta)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'DEMASIADOS_INTENTOS',
      message: 'Demasiados intentos de inicio de sesion; intente de nuevo en 15 minutos',
    },
  },
});

// Recuperacion: 5 solicitudes por IP cada 15 minutos (evita abuso del envio de correos)
const limiteRecuperacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'DEMASIADOS_INTENTOS',
      message: 'Demasiadas solicitudes de recuperacion; intente de nuevo en 15 minutos',
    },
  },
});

authRouter.post('/login', limiteLogin, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requiereAuth, authController.yo);

// Recuperacion y cambio de contrasena
authRouter.post('/recuperar', limiteRecuperacion, authController.recuperar);
authRouter.post('/restablecer', limiteRecuperacion, authController.restablecer);
authRouter.post('/cambiar-password', requiereAuth, authController.cambiarPassword);
