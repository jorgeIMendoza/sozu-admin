import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parseNotasBanco,
  serializeNotasBanco,
  type NotaBanco,
  type NotasBancoMeta,
} from "@/lib/portal-bancos/notas-banco";

/**
 * Notas de la Bitácora de una solicitud del Portal Bancos.
 *
 * Se almacenan dentro de la columna existente `bancos_solicitudes.notas_banco`
 * como parte de un objeto JSON `{ email_agente, notas }` (ver
 * `src/lib/portal-bancos/notas-banco.ts`). No requiere DDL. Cada nota registra
 * quién la creó y cuándo; la UI solo permite editar/borrar al autor.
 *
 * > La restricción "solo el autor edita/borra" se aplica en el cliente (la
 * > columna vive en `bancos_solicitudes`, editable por staff con acceso).
 */

export type BancoSolicitudNota = NotaBanco;

const KEY = (idSolicitud?: number | null) =>
  ["banco-solicitud-notas", idSolicitud ?? "none"] as const;

async function readMeta(idSolicitud: number): Promise<NotasBancoMeta> {
  const { data } = await (supabase as any)
    .from("bancos_solicitudes")
    .select("notas_banco")
    .eq("id", idSolicitud)
    .maybeSingle();
  return parseNotasBanco(data?.notas_banco ?? null);
}

async function writeMeta(idSolicitud: number, meta: NotasBancoMeta) {
  const { error } = await (supabase as any)
    .from("bancos_solicitudes")
    .update({ notas_banco: serializeNotasBanco(meta), fecha_actualizacion: new Date().toISOString() })
    .eq("id", idSolicitud);
  if (error) throw error;
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export function useBancoSolicitudNotas(idSolicitud?: number | null) {
  return useQuery({
    queryKey: KEY(idSolicitud),
    enabled: idSolicitud != null,
    staleTime: 15_000,
    queryFn: async (): Promise<BancoSolicitudNota[]> => {
      if (idSolicitud == null) return [];
      return (await readMeta(idSolicitud)).notas;
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["banco-solicitud-notas"] });
  qc.invalidateQueries({ queryKey: ["solicitudes-banco"] });
}

export function useCrearNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      idSolicitud,
      nota,
      autorEmail,
      autorNombre,
    }: {
      idSolicitud: number;
      nota: string;
      autorEmail: string;
      autorNombre: string;
    }) => {
      const meta = await readMeta(idSolicitud);
      const ahora = new Date().toISOString();
      meta.notas = [
        ...meta.notas,
        {
          id: newId(),
          autor_email: autorEmail,
          autor_nombre: autorNombre,
          nota: nota.trim(),
          fecha_creacion: ahora,
          fecha_actualizacion: ahora,
        },
      ];
      await writeMeta(idSolicitud, meta);
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useEditarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ idSolicitud, id, nota }: { idSolicitud: number; id: string; nota: string }) => {
      const meta = await readMeta(idSolicitud);
      const ahora = new Date().toISOString();
      meta.notas = meta.notas.map((n) =>
        n.id === id ? { ...n, nota: nota.trim(), fecha_actualizacion: ahora } : n,
      );
      await writeMeta(idSolicitud, meta);
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useEliminarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ idSolicitud, id }: { idSolicitud: number; id: string }) => {
      const meta = await readMeta(idSolicitud);
      meta.notas = meta.notas.filter((n) => n.id !== id);
      await writeMeta(idSolicitud, meta);
    },
    onSuccess: () => invalidar(qc),
  });
}
