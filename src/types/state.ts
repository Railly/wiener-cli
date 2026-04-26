export interface AnuncioSnapshot {
  last_id: string;
  last_posted_at: string;
}

export interface ArchivoSnapshot {
  last_modified_at: string;
}

export interface CalificacionSnapshot {
  score: number | null;
  graded_at: string;
}

export interface TareaSnapshot {
  ids: string[];
}

export interface ModuloSnapshot {
  items_count: number;
}

export interface WienerState {
  last_run_at: string;
  snapshots: {
    anuncios: {
      by_course: Record<string, AnuncioSnapshot>;
    };
    archivos: {
      by_course: Record<string, ArchivoSnapshot>;
    };
    calificaciones: {
      by_assignment: Record<string, CalificacionSnapshot>;
    };
    tareas: {
      by_course: Record<string, TareaSnapshot>;
    };
    modulos: {
      by_course: Record<string, ModuloSnapshot>;
    };
  };
}
