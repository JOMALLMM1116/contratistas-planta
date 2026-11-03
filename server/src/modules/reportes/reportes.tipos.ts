export type Celda = string | number | null;
export type Fila = Record<string, Celda>;
export type Columna = { clave: string; titulo: string; ancho: number };

// Estructura comun de todos los reportes: el JSON, el Excel y el PDF salen de ella
export type Reporte = {
  nombre: string;
  titulo: string;
  subtitulo: string[];
  columnas: Columna[];
  filas: Fila[];
};