export type RequestType =
  | 'new_contract'
  | 'new_agreement'
  | 'amendment'
  | 'renewal'
  | 'termination'
  | 'external_validation';

export type Priority = 'high' | 'medium' | 'low';

export type CaseStatus =
  | 'request_received'
  | 'missing_information'
  | 'in_legal_review'
  | 'approved_for_generation'
  | 'client_signature'
  | 'in_validation'
  | 'in_signature_process'
  | 'partially_signed'
  | 'fully_signed'
  | 'rejected'
  | 'cancelled'
  | 'archived';

export type DocumentStatus = 'draft' | 'generated' | 'validated' | 'sent' | 'signed' | 'rejected';

export type SignerStatus = 'pending' | 'notified' | 'viewed' | 'signed' | 'declined';

export type IntegrationStatus = 'idle' | 'pending' | 'connected' | 'error';

export type TimelineEventType =
  | 'request_created'
  | 'request_updated'
  | 'assigned_to_lawyer'
  | 'approved_for_generation'
  | 'document_generated'
  | 'document_validated'
  | 'sent_to_signature'
  | 'signer_completed'
  | 'kyc_completed'
  | 'mifiel_sync_completed'
  | 'rejected'
  | 'cancelled'
  | 'archived'
  | 'integration_error'
  | 'comment_added'
  | 'status_changed'
  | 'missing_info_flagged';

export type SignatureMethod = 'digital' | 'physical';

export type PhysicalDocStatus = 'pending_upload' | 'uploaded' | 'validated' | 'rejected';

export type TemplateStatus = 'active' | 'inactive' | 'archived';

export interface UploadedSignedDoc {
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  status: PhysicalDocStatus;
  version?: number;
}

export interface CaseSigner {
  id: string;
  name: string;
  email: string;
  role: 'internal' | 'external';
  signerType: string;
  status: SignerStatus;
  signedAt?: string;
  signatureMethod?: SignatureMethod;
  uploadedSignedDoc?: UploadedSignedDoc;
  kycStatus?: 'pending' | 'passed' | 'failed' | 'not_required';
  biometricStatus?: 'pending' | 'passed' | 'failed' | 'not_required';
}

export interface CaseDocument {
  id: string;
  name: string;
  type: 'contract' | 'amendment' | 'annex' | 'nda' | 'supporting';
  status: DocumentStatus;
  googleDocUrl?: string;
  pdfUrl?: string;
  generatedAt?: string;
  validatedAt?: string;
}

export interface IntegrationState {
  sozu: IntegrationStatus;
  googleDocs: IntegrationStatus;
  mifiel: IntegrationStatus;
  kyc: IntegrationStatus;
  sozuContractId?: string;
  lastSyncAt?: string;
  errorMessage?: string;
}

export type TipoPersona = 'pf' | 'pm' | 'pe';

export interface CompradorDetalle {
  /** id de `personas.id` — usado para cargar bajo demanda el detalle completo. */
  idPersona: number;
  name: string;
  tipoPersona: TipoPersona;
  rfc?: string | null;
  phone?: string | null;
  email?: string | null;
  porcentajeCopropiedad?: number;
}

export interface LegalRequest {
  id: string;
  title: string;
  type: RequestType;
  company: string;
  project: string;
  modelo?: string;
  property?: string;
  requester: string;
  requesterDept: string;
  requesterPhone?: string;
  requesterEmail?: string;
  /**
   * Empresa u organización del agente vendedor (Sozu si es interno o
   * la inmobiliaria si está afiliado). Null/undefined ⇒ "Agente
   * Independiente" en la UI.
   */
  empresaName?: string;
  counterparty: string;
  counterparties?: string[];
  compradoresDetalle?: CompradorDetalle[];
  titular?: string;
  cuentaCobranza?: string;
  agenteVendedor?: string;
  fechaCompra?: string;
  estimatedValue: number;
  priority: Priority;
  description: string;
  dueDate: string;
  status: CaseStatus;
  assignedTo?: string;
  templateId?: string;
  templateName?: string;
  createdAt: string;
  updatedAt: string;
  signers?: CaseSigner[];
  documents?: CaseDocument[];
  integrations?: IntegrationState;
}

export interface TemplateVariable {
  key: string;
  label: string;
  source: string;
  dataType: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  required: boolean;
  example: string;
  autoCalculated: boolean;
}

export interface TemplateSigner {
  id: string;
  roleName: string;
  signerType: 'internal' | 'external';
  order: number;
  required: boolean;
  allowedMethods: SignatureMethod[];
  requiresBiometric: boolean;
  requiresKyc: boolean;
  requiredData: string[];
}

export interface TemplateVersion {
  version: string;
  date: string;
  user: string;
  description: string;
  status: 'active' | 'historical' | 'archived';
}

export interface TemplateUsageRecord {
  caseId: string;
  caseTitle: string;
  project: string;
  date: string;
  status: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  category: string;
  type: 'contract' | 'agreement_letter';
  description: string;
  active: boolean;
  templateStatus: TemplateStatus;
  version: string;
  requiresBiometric: boolean;
  requiresKyc: boolean;
  requiresMifiel: boolean;
  allowsPhysical: boolean;
  internalSigners: number;
  externalSigners: number;
  placeholders: string[];
  requiredVariables: string[];
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
  project?: string;
  responsibleLawyer?: string;
  documentStructure?: string;
  variables?: TemplateVariable[];
  signerConfig?: TemplateSigner[];
  versions?: TemplateVersion[];
  usageHistory?: TemplateUsageRecord[];
  bodyContent?: string;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  type: TimelineEventType;
  timestamp: string;
  actor: string;
  actorType: 'user' | 'system' | 'integration';
  notes?: string;
  metadata?: Record<string, string>;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  caseId?: string;
  createdAt: string;
}

export interface DashboardMetrics {
  totalActive: number;
  pendingReview: number;
  inSignature: number;
  completedThisMonth: number;
  avgTurnaroundDays: number;
  urgentCases: number;
  rejectedThisMonth: number;
  signatureBottlenecks: number;
}
