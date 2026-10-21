import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../../shared/errors/app-error.js';

export const MAX_MB = 10;
export const MAX_BYTES = MAX_MB * 1024 * 1024;

// Tipo MIME permitido -> extension con la que se guarda en disco
export const TIPOS_PERMITIDOS = new Map<string, string>([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
]);

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    // El nombre original nunca se usa en disco: evita colisiones y rutas peligrosas
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${TIPOS_PERMITIDOS.get(file.mimetype)}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (TIPOS_PERMITIDOS.has(file.mimetype)) return cb(null, true);
    cb(new AppError(415, 'TIPO_ARCHIVO_NO_PERMITIDO', 'Solo se permiten archivos PDF, JPG o PNG'));
  },
});

// Multer reporta con callbacks: se traducen sus errores al formato del manejador central
export const subirArchivo: RequestHandler = (req, res, next) => {
  upload.single('archivo')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'ARCHIVO_MUY_GRANDE', `El archivo supera el maximo de ${MAX_MB} MB`));
      }
      return next(new AppError(400, 'ARCHIVO_INVALIDO', 'Envie un unico archivo en el campo "archivo"'));
    }
    next(err);
  });
};