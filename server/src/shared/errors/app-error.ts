// Error controlado: lleva el codigo HTTP y un codigo legible para el frontend
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detalles?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
