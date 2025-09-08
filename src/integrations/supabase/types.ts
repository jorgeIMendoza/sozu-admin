export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      actividades: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      acuerdos_pago: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          fecha_pago: string
          id: number
          id_concepto: number
          id_cuenta_cobranza: number
          monto: number
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_pago: string
          id?: never
          id_concepto: number
          id_cuenta_cobranza: number
          monto: number
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_pago?: string
          id?: never
          id_concepto?: number
          id_cuenta_cobranza?: number
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "acuerdos_pago_id_concepto_fkey"
            columns: ["id_concepto"]
            isOneToOne: false
            referencedRelation: "conceptos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_acuerdos_pago_cuenta_cobranza"
            columns: ["id_cuenta_cobranza"]
            isOneToOne: false
            referencedRelation: "cuentas_cobranza"
            referencedColumns: ["id"]
          },
        ]
      }
      amenidades: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_proyecto: number
          nombre: string
          timestamp: string
          url: string | null
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_proyecto: number
          nombre: string
          timestamp?: string
          url?: string | null
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_proyecto?: number
          nombre?: string
          timestamp?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amenidades_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      aplicaciones_pago: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_acuerdo_pago: number
          id_pago: number
          monto: number
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_acuerdo_pago: number
          id_pago: number
          monto: number
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_acuerdo_pago?: number
          id_pago?: number
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "aplicaciones_pago_id_acuerdo_pago_fkey"
            columns: ["id_acuerdo_pago"]
            isOneToOne: false
            referencedRelation: "acuerdos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_aplicaciones_pago_pago"
            columns: ["id_pago"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiarios: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_parentesco: number
          id_persona: number
          nombre_beneficiario: string
          porcentaje_participacion: number
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_parentesco: number
          id_persona: number
          nombre_beneficiario: string
          porcentaje_participacion: number
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_parentesco?: number
          id_persona?: number
          nombre_beneficiario?: string
          porcentaje_participacion?: number
        }
        Relationships: [
          {
            foreignKeyName: "beneficiarios_id_parentesco_fkey"
            columns: ["id_parentesco"]
            isOneToOne: false
            referencedRelation: "parentescos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiarios_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      bodegas: {
        Row: {
          activo: boolean
          descripcion: string | null
          es_incluido: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_producto: number | null
          id_propiedad: number
          m2: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          es_incluido?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_producto?: number | null
          id_propiedad: number
          m2: number
          nombre: string
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          es_incluido?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_producto?: number | null
          id_propiedad?: number
          m2?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "bodegas_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos_servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bodegas_id_propiedad_fkey"
            columns: ["id_propiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
      caracteristicas: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      categorias_producto: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      comisionistas: {
        Row: {
          activo: boolean
          aprobada: boolean
          email_usuario: string
          fecha_actualizacion: string
          fecha_creacion: string
          id_cuenta_cobranza: number
          pagada: boolean
          porcentaje_comision: number
          url_evidencia_pago: string | null
        }
        Insert: {
          activo?: boolean
          aprobada?: boolean
          email_usuario: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id_cuenta_cobranza: number
          pagada?: boolean
          porcentaje_comision: number
          url_evidencia_pago?: string | null
        }
        Update: {
          activo?: boolean
          aprobada?: boolean
          email_usuario?: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id_cuenta_cobranza?: number
          pagada?: boolean
          porcentaje_comision?: number
          url_evidencia_pago?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comisionistas_id_cuenta_cobranza_fkey"
            columns: ["id_cuenta_cobranza"]
            isOneToOne: true
            referencedRelation: "cuentas_cobranza"
            referencedColumns: ["id"]
          },
        ]
      }
      compradores: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id_cuenta_cobranza: number
          id_persona: number
          porcentaje_copropiedad: number
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id_cuenta_cobranza: number
          id_persona: number
          porcentaje_copropiedad: number
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id_cuenta_cobranza?: number
          id_persona?: number
          porcentaje_copropiedad?: number
        }
        Relationships: [
          {
            foreignKeyName: "compradores_id_cuenta_cobranza_fkey"
            columns: ["id_cuenta_cobranza"]
            isOneToOne: false
            referencedRelation: "cuentas_cobranza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compradores_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos_pago: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      cuentas_bancarias: {
        Row: {
          activo: boolean
          es_cuenta_fisica_para_stp: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_persona: number
          nombre_banco: string
          numero_cuenta: string
          url_evidencia: string | null
        }
        Insert: {
          activo?: boolean
          es_cuenta_fisica_para_stp?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_persona: number
          nombre_banco: string
          numero_cuenta: string
          url_evidencia?: string | null
        }
        Update: {
          activo?: boolean
          es_cuenta_fisica_para_stp?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_persona?: number
          nombre_banco?: string
          numero_cuenta?: string
          url_evidencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_bancarias_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_cobranza: {
        Row: {
          activo: boolean
          clabe_stp: string | null
          clave_rastreo_comision_venta: string | null
          es_aprobado: boolean
          es_comision_venta_efectivo: boolean
          es_pagada_comision_venta: boolean
          fecha_actualizacion: string
          fecha_compra: string
          fecha_creacion: string
          id: number
          id_notario: number | null
          id_oferta: number
          moneda: string | null
          porcentaje_comision_venta: number
          precio_final: number
          valor_uma: number | null
        }
        Insert: {
          activo?: boolean
          clabe_stp?: string | null
          clave_rastreo_comision_venta?: string | null
          es_aprobado?: boolean
          es_comision_venta_efectivo?: boolean
          es_pagada_comision_venta?: boolean
          fecha_actualizacion?: string
          fecha_compra?: string
          fecha_creacion?: string
          id?: number
          id_notario?: number | null
          id_oferta: number
          moneda?: string | null
          porcentaje_comision_venta?: number
          precio_final?: number
          valor_uma?: number | null
        }
        Update: {
          activo?: boolean
          clabe_stp?: string | null
          clave_rastreo_comision_venta?: string | null
          es_aprobado?: boolean
          es_comision_venta_efectivo?: boolean
          es_pagada_comision_venta?: boolean
          fecha_actualizacion?: string
          fecha_compra?: string
          fecha_creacion?: string
          id?: number
          id_notario?: number | null
          id_oferta?: number
          moneda?: string | null
          porcentaje_comision_venta?: number
          precio_final?: number
          valor_uma?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cuentas_cobranza_oferta"
            columns: ["id_oferta"]
            isOneToOne: false
            referencedRelation: "ofertas"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_stp_pago_comision: {
        Row: {
          activo: boolean
          clabe_stp: string
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_persona: number
          id_proyecto: number | null
        }
        Insert: {
          activo?: boolean
          clabe_stp: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_persona: number
          id_proyecto?: number | null
        }
        Update: {
          activo?: boolean
          clabe_stp?: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_persona?: number
          id_proyecto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_stp_pago_comision_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuentas_stp_pago_comision_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          activo: boolean
          es_verificado: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id_persona: number | null
          id_producto: number | null
          id_propiedad: number | null
          id_tipo_documento: number
          numero: number
          url: string
        }
        Insert: {
          activo?: boolean
          es_verificado?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id_persona?: number | null
          id_producto?: number | null
          id_propiedad?: number | null
          id_tipo_documento: number
          numero: number
          url: string
        }
        Update: {
          activo?: boolean
          es_verificado?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id_persona?: number | null
          id_producto?: number | null
          id_propiedad?: number | null
          id_tipo_documento?: number
          numero?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos_servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_id_propiedad_fkey"
            columns: ["id_propiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
      edificios: {
        Row: {
          activo: boolean | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          fecha_lanzamiento: string | null
          id: number
          id_proyecto: number
          nombre: string
          numero_pisos: string | null
        }
        Insert: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          fecha_lanzamiento?: string | null
          id?: never
          id_proyecto: number
          nombre: string
          numero_pisos?: string | null
        }
        Update: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          fecha_lanzamiento?: string | null
          id?: never
          id_proyecto?: number
          nombre?: string
          numero_pisos?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edificios_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      edificios_modelos: {
        Row: {
          activo: boolean | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          id: number
          id_edificio: number
          id_modelo: number
        }
        Insert: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          id_edificio: number
          id_modelo: number
        }
        Update: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          id_edificio?: number
          id_modelo?: number
        }
        Relationships: [
          {
            foreignKeyName: "edificios_modelos_id_edificio_fkey"
            columns: ["id_edificio"]
            isOneToOne: false
            referencedRelation: "edificios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edificios_modelos_id_modelo_fkey"
            columns: ["id_modelo"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      entidades_relacionadas: {
        Row: {
          activo: boolean
          cuenta_madre_stp: string | null
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_persona: number
          id_proyecto: number
          id_tipo_entidad: number
        }
        Insert: {
          activo?: boolean
          cuenta_madre_stp?: string | null
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: number
          id_persona: number
          id_proyecto: number
          id_tipo_entidad: number
        }
        Update: {
          activo?: boolean
          cuenta_madre_stp?: string | null
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: number
          id_persona?: number
          id_proyecto?: number
          id_tipo_entidad?: number
        }
        Relationships: [
          {
            foreignKeyName: "entidades_relacionadas_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entidades_relacionadas_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      esquemas_pago: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_producto: number | null
          id_proyecto: number | null
          nombre: string
          numero_mensualidades: number
          porcentaje_descuento_aumento: number
          porcentaje_enganche: number
          porcentaje_entrega: number
          porcentaje_mensualidades: number
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_producto?: number | null
          id_proyecto?: number | null
          nombre: string
          numero_mensualidades: number
          porcentaje_descuento_aumento?: number
          porcentaje_enganche: number
          porcentaje_entrega: number
          porcentaje_mensualidades: number
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_producto?: number | null
          id_proyecto?: number | null
          nombre?: string
          numero_mensualidades?: number
          porcentaje_descuento_aumento?: number
          porcentaje_enganche?: number
          porcentaje_entrega?: number
          porcentaje_mensualidades?: number
        }
        Relationships: [
          {
            foreignKeyName: "esquemas_pago_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos_servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esquemas_pago_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      estacionamientos: {
        Row: {
          activo: boolean
          descripcion: string | null
          es_incluido: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_producto: number | null
          id_propiedad: number
          id_tipo: number
          m2: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          es_incluido?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_producto?: number | null
          id_propiedad: number
          id_tipo: number
          m2: number
          nombre: string
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          es_incluido?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_producto?: number | null
          id_propiedad?: number
          id_tipo?: number
          m2?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "estacionamientos_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos_servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estacionamientos_id_propiedad_fkey"
            columns: ["id_propiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
      estados_civil: {
        Row: {
          activo: boolean | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      estados_mx: {
        Row: {
          activo: boolean
          codigo_estado: string | null
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_pais: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo_estado?: string | null
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_pais: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo_estado?: string | null
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_pais?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "estados_mx_id_pais_fkey"
            columns: ["id_pais"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["id"]
          },
        ]
      }
      estatus_disponibilidad: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: number
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: number
          nombre?: string
        }
        Relationships: []
      }
      logs_actividad: {
        Row: {
          actividad_id: number
          ambiente: string | null
          datos_payload: Json | null
          estatus_ejecucion: string
          fecha_creacion: string
          id: number
          id_ejecucion: number | null
          nuevo_valor: Json | null
          primer_nodo: string | null
          ultimo_nodo: string | null
          usuario_id: string
          valor_anterior: Json | null
          workflow: string | null
        }
        Insert: {
          actividad_id: number
          ambiente?: string | null
          datos_payload?: Json | null
          estatus_ejecucion: string
          fecha_creacion?: string
          id?: never
          id_ejecucion?: number | null
          nuevo_valor?: Json | null
          primer_nodo?: string | null
          ultimo_nodo?: string | null
          usuario_id: string
          valor_anterior?: Json | null
          workflow?: string | null
        }
        Update: {
          actividad_id?: number
          ambiente?: string | null
          datos_payload?: Json | null
          estatus_ejecucion?: string
          fecha_creacion?: string
          id?: never
          id_ejecucion?: number | null
          nuevo_valor?: Json | null
          primer_nodo?: string | null
          ultimo_nodo?: string | null
          usuario_id?: string
          valor_anterior?: Json | null
          workflow?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_actividad_actividad_id_fkey"
            columns: ["actividad_id"]
            isOneToOne: false
            referencedRelation: "actividades"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          activo: boolean | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      menus_roles: {
        Row: {
          activo: boolean | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          menu_id: number
          rol_id: number
        }
        Insert: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          menu_id: number
          rol_id: number
        }
        Update: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          menu_id?: number
          rol_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "menus_roles_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_roles_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      metodos_pago: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      modelos: {
        Row: {
          activo: boolean | null
          descripcion: string | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          id: number
          nombre: string
          numero_completo_banos: number | null
          numero_medio_bano: number | null
          numero_recamaras: number | null
        }
        Insert: {
          activo?: boolean | null
          descripcion?: string | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre: string
          numero_completo_banos?: number | null
          numero_medio_bano?: number | null
          numero_recamaras?: number | null
        }
        Update: {
          activo?: boolean | null
          descripcion?: string | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre?: string
          numero_completo_banos?: number | null
          numero_medio_bano?: number | null
          numero_recamaras?: number | null
        }
        Relationships: []
      }
      modelos_caracteristicas: {
        Row: {
          activo: boolean | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          id: number
          id_caracteristica: number
          id_modelo: number
        }
        Insert: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          id_caracteristica: number
          id_modelo: number
        }
        Update: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          id_caracteristica?: number
          id_modelo?: number
        }
        Relationships: [
          {
            foreignKeyName: "modelos_caracteristicas_id_caracteristica_fkey"
            columns: ["id_caracteristica"]
            isOneToOne: false
            referencedRelation: "caracteristicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_caracteristicas_id_modelo_fkey"
            columns: ["id_modelo"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      multas: {
        Row: {
          activo: boolean
          descripcion: string
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_acuerdo_pago: number
          monto: number
        }
        Insert: {
          activo?: boolean
          descripcion: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_acuerdo_pago: number
          monto: number
        }
        Update: {
          activo?: boolean
          descripcion?: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_acuerdo_pago?: number
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "multas_id_acuerdo_pago_fkey"
            columns: ["id_acuerdo_pago"]
            isOneToOne: false
            referencedRelation: "acuerdos_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      multimedias_modelo: {
        Row: {
          activo: boolean | null
          es_imagen: boolean | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          id: number
          id_modelo: number
          url: string
        }
        Insert: {
          activo?: boolean | null
          es_imagen?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          id_modelo: number
          url: string
        }
        Update: {
          activo?: boolean | null
          es_imagen?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          id_modelo?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "multimedias_modelo_id_modelo_fkey"
            columns: ["id_modelo"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      municipios_mx: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_estado: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_estado: number
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_estado?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipios_mx_id_estado_fkey"
            columns: ["id_estado"]
            isOneToOne: false
            referencedRelation: "estados_mx"
            referencedColumns: ["id"]
          },
        ]
      }
      notarios: {
        Row: {
          activo: boolean
          direccion: string | null
          email: string
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
          notaria: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          direccion?: string | null
          email: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre: string
          notaria: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          direccion?: string | null
          email?: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre?: string
          notaria?: string
          telefono?: string | null
        }
        Relationships: []
      }
      ofertas: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          fecha_generacion: string
          id: number
          id_esquema_pago_seleccionado: number | null
          id_persona_lead: number
          id_producto: number | null
          id_propiedad: number | null
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_generacion?: string
          id?: never
          id_esquema_pago_seleccionado?: number | null
          id_persona_lead: number
          id_producto?: number | null
          id_propiedad?: number | null
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_generacion?: string
          id?: never
          id_esquema_pago_seleccionado?: number | null
          id_persona_lead?: number
          id_producto?: number | null
          id_propiedad?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ofertas_id_esquema_pago_seleccionado_fkey"
            columns: ["id_esquema_pago_seleccionado"]
            isOneToOne: false
            referencedRelation: "esquemas_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ofertas_id_persona_lead_fkey"
            columns: ["id_persona_lead"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ofertas_id_producto_fkey"
            columns: ["id_producto"]
            isOneToOne: false
            referencedRelation: "productos_servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ofertas_id_propiedad_fkey"
            columns: ["id_propiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          activo: boolean
          clave_rastreo: string | null
          fecha_actualizacion: string
          fecha_creacion: string
          fecha_pago: string
          id: number
          id_cuenta_cobranza: number
          id_metodos_pago: number
          monto: number
          url_cep: string | null
          url_recibo: string | null
        }
        Insert: {
          activo?: boolean
          clave_rastreo?: string | null
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_pago: string
          id?: never
          id_cuenta_cobranza: number
          id_metodos_pago: number
          monto: number
          url_cep?: string | null
          url_recibo?: string | null
        }
        Update: {
          activo?: boolean
          clave_rastreo?: string | null
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_pago?: string
          id?: never
          id_cuenta_cobranza?: number
          id_metodos_pago?: number
          monto?: number
          url_cep?: string | null
          url_recibo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_id_cuenta_cobranza_fkey"
            columns: ["id_cuenta_cobranza"]
            isOneToOne: false
            referencedRelation: "cuentas_cobranza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_id_metodos_pago_fkey"
            columns: ["id_metodos_pago"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_stp_raw: {
        Row: {
          activo: boolean
          claverastreo: string
          concepto_pago: string | null
          cuenta_beneficiario: string
          cuenta_beneficiario2: string | null
          cuenta_ordenante: string | null
          empresa: string | null
          es_pago_aplicado: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          fecha_operacion: string
          folio_codi: string | null
          id: number
          institucion_beneficiaria: string | null
          institucion_ordenante: string | null
          monto: number
          nombre_beneficiario: string | null
          nombre_beneficiario2: string | null
          nombre_ordenante: string | null
          razon_rechazo: string | null
          referencia_numerica: string | null
          rfc_curp_beneficiario: string | null
          rfc_curp_ordenante: string | null
          stp_id: string | null
          tipo_cuenta_beneficiario: string | null
          tipo_cuenta_beneficiario2: string | null
          tipo_cuenta_ordenante: string | null
          tipo_pago: string | null
          ts_liquidacion: string | null
        }
        Insert: {
          activo?: boolean
          claverastreo: string
          concepto_pago?: string | null
          cuenta_beneficiario: string
          cuenta_beneficiario2?: string | null
          cuenta_ordenante?: string | null
          empresa?: string | null
          es_pago_aplicado?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_operacion: string
          folio_codi?: string | null
          id?: never
          institucion_beneficiaria?: string | null
          institucion_ordenante?: string | null
          monto: number
          nombre_beneficiario?: string | null
          nombre_beneficiario2?: string | null
          nombre_ordenante?: string | null
          razon_rechazo?: string | null
          referencia_numerica?: string | null
          rfc_curp_beneficiario?: string | null
          rfc_curp_ordenante?: string | null
          stp_id?: string | null
          tipo_cuenta_beneficiario?: string | null
          tipo_cuenta_beneficiario2?: string | null
          tipo_cuenta_ordenante?: string | null
          tipo_pago?: string | null
          ts_liquidacion?: string | null
        }
        Update: {
          activo?: boolean
          claverastreo?: string
          concepto_pago?: string | null
          cuenta_beneficiario?: string
          cuenta_beneficiario2?: string | null
          cuenta_ordenante?: string | null
          empresa?: string | null
          es_pago_aplicado?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_operacion?: string
          folio_codi?: string | null
          id?: never
          institucion_beneficiaria?: string | null
          institucion_ordenante?: string | null
          monto?: number
          nombre_beneficiario?: string | null
          nombre_beneficiario2?: string | null
          nombre_ordenante?: string | null
          razon_rechazo?: string | null
          referencia_numerica?: string | null
          rfc_curp_beneficiario?: string | null
          rfc_curp_ordenante?: string | null
          stp_id?: string | null
          tipo_cuenta_beneficiario?: string | null
          tipo_cuenta_beneficiario2?: string | null
          tipo_cuenta_ordenante?: string | null
          tipo_pago?: string | null
          ts_liquidacion?: string | null
        }
        Relationships: []
      }
      paises: {
        Row: {
          activo: boolean
          clave_pais_telefono: string
          fecha_actualizacion: string
          fecha_creacion: string
          id: string
          nacionalidad: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          clave_pais_telefono: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id: string
          nacionalidad: string
          nombre: string
        }
        Update: {
          activo?: boolean
          clave_pais_telefono?: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          nacionalidad?: string
          nombre?: string
        }
        Relationships: []
      }
      parentescos: {
        Row: {
          activo: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      permisos: {
        Row: {
          activo: boolean | null
          descripcion: string | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          descripcion?: string | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean | null
          descripcion?: string | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          activo: boolean
          clave_pais_telefono: string | null
          curp: string | null
          direccion_calle_numero: string | null
          direccion_codigo_postal: string | null
          direccion_colonia: string | null
          direccion_fiscal_calle_numero: string | null
          direccion_fiscal_codigo_postal: string | null
          direccion_fiscal_colonia: string | null
          direccion_fiscal_id_estado: number | null
          direccion_fiscal_id_municipio: number | null
          direccion_fiscal_id_pais: string | null
          direccion_id_estado: number | null
          direccion_id_municipio: number | null
          direccion_id_pais: string | null
          email: string
          fecha_actualizacion: string
          fecha_creacion: string
          fecha_escritura: string | null
          fecha_nacimiento: string | null
          fecha_registro: string | null
          folio_mercantil: string | null
          id: number
          id_estado_civil: number | null
          id_estado_nacimiento: number | null
          id_municipio_nacimiento: number | null
          id_notario: number | null
          id_pais_nacimiento: string | null
          id_representente_legal: number | null
          id_tipo_identificacion: number | null
          id_tipo_relacion: number | null
          nombre_comercial: string | null
          nombre_legal: string
          numero_escritura: string | null
          numero_libro: string | null
          ocupacion: string | null
          regimen: number | null
          rfc: string | null
          sexo: string | null
          telefono: string | null
          tipo_persona: string
          uso_cfdi: string | null
        }
        Insert: {
          activo?: boolean
          clave_pais_telefono?: string | null
          curp?: string | null
          direccion_calle_numero?: string | null
          direccion_codigo_postal?: string | null
          direccion_colonia?: string | null
          direccion_fiscal_calle_numero?: string | null
          direccion_fiscal_codigo_postal?: string | null
          direccion_fiscal_colonia?: string | null
          direccion_fiscal_id_estado?: number | null
          direccion_fiscal_id_municipio?: number | null
          direccion_fiscal_id_pais?: string | null
          direccion_id_estado?: number | null
          direccion_id_municipio?: number | null
          direccion_id_pais?: string | null
          email: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_escritura?: string | null
          fecha_nacimiento?: string | null
          fecha_registro?: string | null
          folio_mercantil?: string | null
          id?: never
          id_estado_civil?: number | null
          id_estado_nacimiento?: number | null
          id_municipio_nacimiento?: number | null
          id_notario?: number | null
          id_pais_nacimiento?: string | null
          id_representente_legal?: number | null
          id_tipo_identificacion?: number | null
          id_tipo_relacion?: number | null
          nombre_comercial?: string | null
          nombre_legal: string
          numero_escritura?: string | null
          numero_libro?: string | null
          ocupacion?: string | null
          regimen?: number | null
          rfc?: string | null
          sexo?: string | null
          telefono?: string | null
          tipo_persona: string
          uso_cfdi?: string | null
        }
        Update: {
          activo?: boolean
          clave_pais_telefono?: string | null
          curp?: string | null
          direccion_calle_numero?: string | null
          direccion_codigo_postal?: string | null
          direccion_colonia?: string | null
          direccion_fiscal_calle_numero?: string | null
          direccion_fiscal_codigo_postal?: string | null
          direccion_fiscal_colonia?: string | null
          direccion_fiscal_id_estado?: number | null
          direccion_fiscal_id_municipio?: number | null
          direccion_fiscal_id_pais?: string | null
          direccion_id_estado?: number | null
          direccion_id_municipio?: number | null
          direccion_id_pais?: string | null
          email?: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_escritura?: string | null
          fecha_nacimiento?: string | null
          fecha_registro?: string | null
          folio_mercantil?: string | null
          id?: never
          id_estado_civil?: number | null
          id_estado_nacimiento?: number | null
          id_municipio_nacimiento?: number | null
          id_notario?: number | null
          id_pais_nacimiento?: string | null
          id_representente_legal?: number | null
          id_tipo_identificacion?: number | null
          id_tipo_relacion?: number | null
          nombre_comercial?: string | null
          nombre_legal?: string
          numero_escritura?: string | null
          numero_libro?: string | null
          ocupacion?: string | null
          regimen?: number | null
          rfc?: string | null
          sexo?: string | null
          telefono?: string | null
          tipo_persona?: string
          uso_cfdi?: string | null
        }
        Relationships: []
      }
      productos_servicios: {
        Row: {
          activo: boolean
          descripcion: string | null
          es_producto: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_categoria: number
          id_persona: number
          id_unidad_sat: string
          nombre: string
          sat_id: string | null
          stock: number
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          es_producto?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_categoria: number
          id_persona: number
          id_unidad_sat: string
          nombre: string
          sat_id?: string | null
          stock?: number
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          es_producto?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          id_categoria?: number
          id_persona?: number
          id_unidad_sat?: string
          nombre?: string
          sat_id?: string | null
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "productos_servicios_id_categoria_fkey"
            columns: ["id_categoria"]
            isOneToOne: false
            referencedRelation: "categorias_producto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_servicios_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      propiedades: {
        Row: {
          activo: boolean
          clabe_stp_tmp_apartado: string | null
          es_aprobado: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          id_edificio_modelo: number
          id_entidad_relacionada_dueno: number | null
          id_estatus_disponibilidad: number
          id_tipo_propiedad: number
          id_tipo_transaccion: number
          id_vista: number | null
          m2_escriturables: number | null
          m2_reales: number | null
          monto_apartado: number | null
          monto_apartado_pagando: number | null
          numero_piso: number | null
          numero_propiedad: string
          precio_lista: number
        }
        Insert: {
          activo?: boolean
          clabe_stp_tmp_apartado?: string | null
          es_aprobado?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: number
          id_edificio_modelo: number
          id_entidad_relacionada_dueno?: number | null
          id_estatus_disponibilidad: number
          id_tipo_propiedad: number
          id_tipo_transaccion: number
          id_vista?: number | null
          m2_escriturables?: number | null
          m2_reales?: number | null
          monto_apartado?: number | null
          monto_apartado_pagando?: number | null
          numero_piso?: number | null
          numero_propiedad: string
          precio_lista: number
        }
        Update: {
          activo?: boolean
          clabe_stp_tmp_apartado?: string | null
          es_aprobado?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: number
          id_edificio_modelo?: number
          id_entidad_relacionada_dueno?: number | null
          id_estatus_disponibilidad?: number
          id_tipo_propiedad?: number
          id_tipo_transaccion?: number
          id_vista?: number | null
          m2_escriturables?: number | null
          m2_reales?: number | null
          monto_apartado?: number | null
          monto_apartado_pagando?: number | null
          numero_piso?: number | null
          numero_propiedad?: string
          precio_lista?: number
        }
        Relationships: []
      }
      proyectos: {
        Row: {
          activo: boolean
          descripcion: string | null
          direccion: string | null
          fecha_actualizacion: string
          fecha_creacion: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          direccion?: string | null
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          direccion?: string | null
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          activo: boolean | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          id?: never
          nombre?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
