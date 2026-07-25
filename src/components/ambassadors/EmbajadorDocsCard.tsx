import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AgentOnboardingStepDialog } from '@/components/admin/AgentOnboardingStepDialog';
import { ExpedienteDocsPanel, type ExpDocDef } from '@/components/admin/expediente/ExpedienteDocsPanel';
import {
  FirmaCartaAcuerdoDialogs,
  useFirmaCartaAcuerdo,
} from '@/components/admin/expediente/FirmaCartaAcuerdo';
import {
  CONVENIO_CARTA_NOMBRE_LIKE,
  CSF_TIPO,
  EMBAJADOR_DOC_TIPOS,
  useEmbajadorDocumentos,
} from '@/hooks/useEmbajadorDocumentos';

/**
 * Documentación para pago del embajador. Usa el panel global del expediente
 * (mismo componente que el portal de agentes): estatus de validación, captura de
 * identidad por cámara (INE frente+reverso o pasaporte), Constancia con lectura y
 * confirmación de datos fiscales, y visores. La carátula bancaria se gestiona con
 * el mismo alta de cuenta bancaria que usa el agente.
 */
export function EmbajadorDocsCard({ idPersona }: { idPersona?: number | null }) {
  const { docs, isLoading, cuentaBancaria, docsQueryKey, bankQueryKey, refetch } = useEmbajadorDocumentos(idPersona);
  const queryClient = useQueryClient();
  const [bankOpen, setBankOpen] = useState(false);

  const bancarios = docs.find((d) => d.key === 'bancarios');

  // Convenio: mismo flujo que la Carta de comercialización del agente (firma
  // digital Mifiel sobre una plantilla de `cartas_acuerdo`).
  const firmaConvenio = useFirmaCartaAcuerdo({
    personaId: idPersona,
    cartaAcuerdoNombreLike: CONVENIO_CARTA_NOMBRE_LIKE,
  });

  const panelDocs: ExpDocDef[] = [
    {
      key: 'convenio',
      nombre: 'Convenio de Embajador firmado',
      emisor: 'SOZU',
      hint: 'Se genera y firma digitalmente con SOZU',
      kind: 'firma',
      external: {
        url: firmaConvenio.pdfUrl,
        estado: firmaConvenio.expEstado,
        badgeLabel: firmaConvenio.configurada ? firmaConvenio.estadoLabel : 'No configurado',
        actionTitle:
          firmaConvenio.estado === 'enviado' || firmaConvenio.estado === 'firmado_parcial'
            ? 'Continuar firma'
            : 'Firmar convenio',
        onAction: () => {
          if (!firmaConvenio.configurada) {
            toast.error('El convenio aún no está configurado. Contacta a tu administrador.');
            return;
          }
          firmaConvenio.firmar();
        },
      },
    },
    { key: 'id', nombre: 'Identificación oficial', kind: 'identity' },
    {
      key: 'rfc',
      nombre: 'Constancia de situación fiscal',
      emisor: 'SAT',
      hint: 'PDF del SAT, no mayor a 3 meses',
      tipos: [CSF_TIPO],
      kind: 'pdf',
      csf: true,
    },
    {
      key: 'bancarios',
      nombre: 'Carátula Estado de Cuenta Bancario',
      emisor: 'Banco',
      hint: 'Se carga al registrar tu cuenta bancaria',
      kind: 'external',
      external: {
        url: bancarios?.url ?? null,
        estado: bancarios?.status ?? 'pendiente',
        actionTitle: cuentaBancaria ? 'Editar cuenta bancaria' : 'Registrar cuenta bancaria',
        onAction: () => setBankOpen(true),
      },
    },
  ];

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-medium">Documentación para pago</div>
          <p className="text-xs text-muted-foreground">
            Necesarios para que podamos liquidar tu comisión. Los documentos validados ya no se pueden reemplazar.
          </p>
        </div>
      </div>

      {!idPersona ? (
        <p className="py-4 text-sm text-muted-foreground">Embajador sin persona asociada.</p>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ExpedienteDocsPanel
          personaId={idPersona}
          docs={panelDocs}
          docsQueryKey={docsQueryKey}
          queryTipos={EMBAJADOR_DOC_TIPOS}
          numbered={false}
          onChanged={() => refetch()}
        />
      )}

      {/* Firma digital del convenio (pad autógrafo + widget Mifiel) */}
      <FirmaCartaAcuerdoDialogs firma={firmaConvenio} onCompleted={() => refetch()} />

      {/* Alta/edición de cuenta bancaria (misma UI que el portal de agentes): la
          carátula se guarda como evidencia de la cuenta. */}
      {idPersona && (
        <AgentOnboardingStepDialog
          step="bank-accounts"
          personaId={idPersona}
          bankMode={cuentaBancaria ? 'edit' : 'create'}
          bankAccountId={cuentaBancaria?.id ?? null}
          open={bankOpen}
          onOpenChange={(o) => {
            setBankOpen(o);
            if (!o) queryClient.invalidateQueries({ queryKey: bankQueryKey });
          }}
        />
      )}
    </Card>
  );
}
