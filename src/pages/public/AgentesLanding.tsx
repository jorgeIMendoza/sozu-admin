import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPortalHost } from "@/lib/portalUrls";
import { supabase } from "@/integrations/supabase/client";
import daikuImg from "@/assets/daiku.png";
import botturaImg from "@/assets/bottura.jpg";
import bottura812Img from "@/assets/bottura-812.jpg";
import margotImg from "@/assets/margot.jpg";
import "./AgentesLanding.css";

// Galería interactiva del hero (expanding cards). Renders en public/images:
// Monócolo usa exterior.jpg; Daiku/Margot/Bottura sus renders en /images/hero/.
// TODO prod: daiku.webp pesa ~9.7MB → optimizar (resize a ~1600px).
const GALLERY = [
  { id: "monocolo", nombre: "Monócolo", sub: "Country Club · premium", img: "/images/daiku/exterior.jpg" },
  { id: "daiku", nombre: "Daiku", sub: "Zona Minerva · preventa", img: "/images/hero/daiku.webp" },
  { id: "margot", nombre: "Margot", sub: "Chapalita · entrega inmediata", img: "/images/hero/margot.jpeg" },
  { id: "bottura", nombre: "Bottura", sub: "Arcos Vallarta · en obra", img: "/images/hero/bottura.jpg" },
];

/**
 * Landing pública de reclutamiento de agentes externos — "SOZU · AGENTES".
 * Tema claro + verde SOZU (marca real). Montada en la raíz de agentes.sozu.com
 * y en /agentes del admin (ver App.tsx).
 *
 * El registro (modal 3 pasos) usa el edge function `registro-publico` (el mismo
 * que /registro): crea al agente (persona + entidad tipo 19 + cuenta auth +
 * usuarios rol 3) y ademas lo guarda en el CRM como contacto "Agente Externo"
 * (entidad tipo 7 + crm_leads_atribucion estatus "asesor_inmobiliario"), con una
 * nota de contacto que resume zonas / modo / experiencia. Una sola llamada, al
 * terminar el paso 3. Sin API keys propias: viaja por functions.invoke (anon key).
 */

const AGENTES_HOST = getPortalHost("agentes");

const ZONAS = ["Zona Minerva", "Providencia", "Expo / Del Valle", "Zapopan Country", "Andares", "Otra"] as const;
const MODOS = ["Independiente", "Con agencia"] as const;
const EXPS = ["< 1", "1–3", "3–7", "7+"] as const;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type Paso = 1 | 2 | 3 | 4;

// ── Inventario real (datos de los proyectos SOZU en Guadalajara) ────────────
// Las imágenes son renders de interior del repo (no hay fachadas en assets);
// reemplazar por fotos reales de fachada/planos cuando estén disponibles.
type Modelo = { n: string; t: string; rec: string; ba: string };
type Desarrollo = {
  id: string; nombre: string; img: string; badge: string; badgeOk?: boolean;
  direccion: string; zona: string; rec: string; precio: string; precioSub: string;
  disp: string; entrega: string; desc: string; modelos: Modelo[];
};

const DESARROLLOS: Desarrollo[] = [
  {
    id: "daiku", nombre: "Daiku", img: "/images/daiku/torres.jpg", badge: "Preventa",
    direccion: "Zona Minerva, Guadalajara, Jal.", zona: "Zona Minerva",
    rec: "1 · 2 · 3 rec.", precio: "$2.9M", precioSub: "desde", disp: "23 disponibles", entrega: "2026",
    desc: "Daiku es un desarrollo vertical en el corazón de Zona Minerva: 160 departamentos de 1 a 3 recámaras, comercios en planta baja y amenidades premium en uno de los corredores más vibrantes de Guadalajara.",
    modelos: [
      { n: "Loft", t: "1 REC · 1 BA", rec: "1", ba: "1" },
      { n: "Flat", t: "2 REC · 2 BA", rec: "2", ba: "2" },
      { n: "Garden", t: "3 REC · 2 BA", rec: "3", ba: "2" },
    ],
  },
  {
    id: "monocolo", nombre: "Monócolo", img: daikuImg, badge: "Preventa",
    direccion: "Mar Egeo 1594, Country Club, Guadalajara, Jal.", zona: "Country Club",
    rec: "2 · 3 · 4 rec.", precio: "Precio a consultar", precioSub: "", disp: "100 disponibles", entrega: "2027",
    desc: "Monócolo Country Residences es un desarrollo vertical premium frente al Guadalajara Country Club. Integra el entorno urbano de una de las zonas más exclusivas de la ciudad con amenidades de primer nivel.",
    modelos: [
      { n: "Studio", t: "1 REC · 1 BA", rec: "1", ba: "1" },
      { n: "Garden", t: "2 REC · 2 BA", rec: "2", ba: "2" },
      { n: "Sky", t: "3 REC · 3 BA", rec: "3", ba: "3" },
    ],
  },
  {
    id: "bottura", nombre: "Bottura", img: botturaImg, badge: "En obra",
    direccion: "Manuel López Cotilla 2185, Arcos Vallarta, Guadalajara, Jal.", zona: "Arcos Vallarta",
    rec: "1 rec.", precio: "$80,940", precioSub: "por m²", disp: "4 disponibles", entrega: "2026",
    desc: "Bottura es un desarrollo pensado para parejas y profesionistas independientes, a 3 calles de la glorieta Minerva sobre el corredor de López Cotilla. Una experiencia urbana en el corazón de Guadalajara.",
    modelos: [
      { n: "Uno", t: "1 REC · 1 BA", rec: "1", ba: "1" },
      { n: "Uno Plus", t: "1 REC · 1.5 BA", rec: "1", ba: "1.5" },
    ],
  },
  {
    id: "margot", nombre: "Margot", img: margotImg, badge: "Entrega inmediata", badgeOk: true,
    direccion: "Av. de Las Rosas 1297, Chapalita, Guadalajara, Jal.", zona: "Chapalita",
    rec: "1 · 2 rec.", precio: "$90,599", precioSub: "por m²", disp: "5 disponibles", entrega: "Entrega inmediata",
    desc: "Margot es un desarrollo mixto a 200 m de la Expo Guadalajara, con departamentos de 1 y 2 recámaras listos para entrega y escritura. Diseñado como hotel, con más de 2,000 m² de amenidades equipadas.",
    modelos: [
      { n: "Office", t: "Oficina", rec: "0", ba: "0" },
      { n: "Joy", t: "1 REC · 1 BA", rec: "1", ba: "1" },
      { n: "Breath", t: "2 REC · 2 BA", rec: "2", ba: "2" },
      { n: "Soft", t: "1 REC · 1 BA", rec: "1", ba: "1" },
      { n: "Kind", t: "1 REC · 1 BA", rec: "1", ba: "1" },
      { n: "Heart", t: "1 REC · 1 BA", rec: "1", ba: "1" },
    ],
  },
];

// Pin verde de ubicación (icono inline, sin dependencias)
const PinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

export default function AgentesLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const carRef = useRef<HTMLDivElement>(null);

  const [regOpen, setRegOpen] = useState(false);
  const [paso, setPaso] = useState<Paso>(1);
  const [detalle, setDetalle] = useState<Desarrollo | null>(null);
  const [galIdx, setGalIdx] = useState(0);

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [zonas, setZonas] = useState<string[]>([ZONAS[0], ZONAS[1]]);
  const [modo, setModo] = useState<string>(MODOS[0]);
  const [experiencia, setExperiencia] = useState<string>(EXPS[1]);

  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Validación (paso 1) ────────────────────────────────────────────────
  const nombreOk = nombre.trim().length >= 2;
  const correoOk = EMAIL_RE.test(correo.trim());
  const telOk = whatsapp.replace(/\D/g, "").length === 10;
  const paso1Ok = nombreOk && correoOk && telOk;

  const pasoLabel = paso === 4 ? "Registro completo" : `Paso ${paso} de 3 · ~4 min`;
  const barColor = (n: number) => (paso >= n ? "var(--green)" : "var(--line)");

  // ── Paso 1 → avanzar (sin red; el alta ocurre al terminar) ──────────────
  const capturar = useCallback(() => {
    setError(null);
    if (!paso1Ok) { setShowErrors(true); return; }
    setPaso(2);
  }, [paso1Ok]);

  // ── Terminar registro → una sola llamada a `registro-publico` ───────────
  // Crea al agente y lo guarda en el CRM (categoría "Agente Externo"). El
  // perfil (zonas / modo / experiencia) viaja en `perfil`; el edge function lo
  // deja como nota de contacto. Sin API keys: functions.invoke usa la anon key.
  const finish = useCallback(async () => {
    setError(null);
    if (!paso1Ok) { setPaso(1); setShowErrors(true); return; }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("registro-publico", {
        body: {
          nombre: nombre.trim(),
          email: correo.trim().toLowerCase(),
          telefono: whatsapp.replace(/\D/g, "").slice(0, 10),
          clave_pais_telefono: "MX",
          perfil: {
            zonas: zonas.filter(Boolean),
            modo,
            experiencia: experiencia ? `${experiencia} años` : "",
          },
        },
      });

      let message = "No pudimos completar tu registro. Inténtalo de nuevo.";
      if (fnError) {
        try {
          const ctx = (fnError as { context?: { json?: () => Promise<{ message?: string }> } }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.message) message = body.message;
          }
        } catch { /* sin cuerpo JSON */ }
        throw new Error(message);
      }
      if (!data?.success) throw new Error(data?.message || message);

      setPaso(4);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /ya esta registrado|already/i.test(msg)
          ? "Ese correo ya tiene una cuenta de agente. Inicia sesión."
          : (msg || "No pudimos completar tu registro. Inténtalo de nuevo."),
      );
      // eslint-disable-next-line no-console
      console.error("[registro-publico] error:", e);
    } finally {
      setSubmitting(false);
    }
  }, [paso1Ok, nombre, correo, whatsapp, zonas, modo, experiencia]);

  const openReg = useCallback(() => {
    if (paso === 4) {
      setNombre(""); setCorreo(""); setWhatsapp("");
      setZonas([ZONAS[0], ZONAS[1]]); setModo(MODOS[0]); setExperiencia(EXPS[1]);
      setShowErrors(false);
    }
    setPaso(1); setError(null); setDetalle(null); setRegOpen(true);
  }, [paso]);

  const closeReg = useCallback(() => setRegOpen(false), []);
  const toggleZona = (z: string) => setZonas((p) => (p.includes(z) ? p.filter((x) => x !== z) : [...p, z]));
  const scrollCar = (dir: number) => carRef.current?.scrollBy({ left: dir * carRef.current.clientWidth * 0.8, behavior: "smooth" });

  // ── Scroll-lock + ESC mientras hay un modal abierto ─────────────────────
  const anyModal = regOpen || detalle !== null;
  useEffect(() => {
    if (!anyModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setRegOpen(false); setDetalle(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [anyModal]);

  useEffect(() => {
    if (regOpen && paso === 1) {
      const t = window.setTimeout(() => nombreRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [regOpen, paso]);

  // ── Reveal on-scroll (respeta prefers-reduced-motion) ───────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!els.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } }),
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const zonasMarquee = useMemo(
    () => ["Zona Minerva", "Providencia", "Arcos Vallarta", "Chapalita", "Country Club", "Expo Guadalajara", "Andares", "Operado por Grupo Investimento"],
    [],
  );

  return (
    <div className="al-root" ref={rootRef}>
      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav
        className="al-nav"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", gap: 28,
          padding: "14px 56px", background: "hsl(0 0% 100% / .82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: ".14em", marginRight: "auto" }}>
          SOZU<span style={{ color: "var(--green-ink)" }}> · AGENTES</span>
        </span>
        <div className="al-navlinks" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <a href="#oferta" className="al-navlink">Comisiones</a>
          <a href="#inventario" className="al-navlink">Inventario</a>
          <a href="#pasos" className="al-navlink">Cómo funciona</a>
          <a href={`${AGENTES_HOST}/login`} className="al-navlink">Iniciar sesión</a>
        </div>
        <button className="al-btn al-btn-primary" onClick={openReg}>Registrarme</button>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <header className="al-hero">
        <div className="al-hero-bg" aria-hidden />
        <div>
          <span className="al-eyebrow al-hero-eyebrow"><span className="al-dot" /> Aliados comerciales</span>
          <h1 className="al-hero-h1" style={{ animation: "al-rise .8s .05s both" }}>
            Vende patrimonio con respaldo <span className="al-serif-italic">institucional</span>.
          </h1>
          <p className="al-hero-sub" style={{ animation: "al-rise .8s .18s both" }}>
            SOZU te conecta con inventario validado, plataforma comercial y respaldo legal-administrativo en cada cierre. Tú vendes; nosotros operamos lo demás.
          </p>
          <div className="al-hero-ctas" style={{ animation: "al-rise .8s .3s both" }}>
            <button className="al-btn al-btn-primary" onClick={openReg} style={{ fontSize: 15, padding: "13px 22px" }}>
              Registrarme como agente →
            </button>
            <a className="al-btn al-btn-outline" href={`${AGENTES_HOST}/login`} style={{ fontSize: 15, padding: "13px 22px" }}>
              Ingresar a mi cuenta
            </a>
          </div>
        </div>

        {/* Visual del hero: galería interactiva (expanding cards). Al hover/clic,
            la tarjeta se expande y muestra su info. Todo con renders JPG. */}
        <div className="al-hero-visual">
          <div className="al-gallery" role="tablist" aria-label="Desarrollos SOZU">
            {GALLERY.map((g, i) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={i === galIdx}
                className={`al-gcard ${i === galIdx ? "is-active" : ""}`}
                style={{ backgroundImage: `url(${g.img})` }}
                onMouseEnter={() => setGalIdx(i)}
                onFocus={() => setGalIdx(i)}
                onClick={() => setGalIdx(i)}
              >
                <span className="al-gcard-label">
                  <strong>{g.nombre}</strong>
                  <em>{g.sub}</em>
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Marquee ───────────────────────────────────────────────────── */}
      <div className="al-marquee">
        <div className="al-marquee-track">
          {[0, 1].map((dup) => (
            <span key={dup} style={{ display: "flex", gap: 56 }}>
              {zonasMarquee.map((z, i) => (
                <span key={z} style={{ display: "inline-flex", gap: 56 }}>
                  {z}{i < zonasMarquee.length - 1 && <span className="sep">✦</span>}
                </span>
              ))}
              <span className="sep">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Oferta (imagen de fondo + degradado) ──────────────────────── */}
      <section id="oferta" className="al-oferta">
        <img className="al-oferta-img" src={bottura812Img} alt="" aria-hidden />
        <div className="al-oferta-scrim" aria-hidden />
        <div className="al-oferta-grid">
          {[
            { num: "100%", txt: "de tu comisión, trazable — cada peso visible en tu panel" },
            { num: "4 min", txt: "registro 100% digital, sin papeleo por adelantado" },
            { num: "3", txt: "desarrollos activos en Guadalajara, con más en camino" },
            { num: "15 días", txt: "de apartado formalizado al pago de tu comisión" },
          ].map((s, i) => (
            <div key={s.txt} className="al-reveal" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="al-oferta-num">{s.num}</div>
              <div className="al-oferta-txt">{s.txt}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ─────────────────────────────────────────────── */}
      <section id="pasos" className="al-section">
        <div className="al-reveal" data-reveal style={{ maxWidth: 620 }}>
          <div className="al-kicker">Cómo funciona</div>
          <h2 className="al-h2">Tres pasos. Hoy mismo estás vendiendo.</h2>
        </div>
        <div className="al-pasos">
          {[
            { n: "01", t: "Regístrate en minutos", b: "Nombre, WhatsApp y tu zona. Sin papeleo por adelantado; en menos de 2 minutos estás dentro.", d: 0 },
            { n: "02", t: "Validamos tu perfil", b: "Revisamos tu registro y activamos tu cuenta en menos de 24 horas. Te acompañamos por WhatsApp desde el día uno.", d: 4.5 },
            { n: "03", t: "Vende con inventario real", b: "Fichas, precios y disponibilidad en vivo. Cada operación y cada peso de tu comisión, trazable en tu panel.", d: 9 },
          ].map((c, i) => (
            <div key={c.n} className="al-paso al-reveal" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="al-paso-bar" style={{ animation: `al-prog 13.5s ${c.d}s infinite` }} />
              <div className="al-paso-num">{c.n}</div>
              <div className="al-paso-t">{c.t}</div>
              <div className="al-paso-b">{c.b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Inventario ────────────────────────────────────────────────── */}
      <section id="inventario" className="al-section al-section-alt">
        <div className="al-reveal" data-reveal style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div className="al-kicker">Inventario que vas a vender</div>
            <h2 className="al-h2">Desarrollos reales, disponibilidad en vivo.</h2>
          </div>
          <span className="al-muted" style={{ fontSize: 13 }}>Comisión competitiva, definida por desarrollo</span>
        </div>
        <div className="al-car-wrap">
          <button type="button" className="al-car-arrow al-car-prev" aria-label="Anterior" onClick={() => scrollCar(-1)}>‹</button>
          <div className="al-dev-carousel" ref={carRef}>
          {DESARROLLOS.map((d, i) => (
            <button key={d.id} className="al-dev al-reveal-fade" data-reveal style={{ transitionDelay: `${i * 90}ms` }} onClick={() => setDetalle(d)}>
              <div className="al-dev-media">
                <img src={d.img} alt={`Desarrollo ${d.nombre}`} loading="lazy" />
                <span className={`al-dev-badge${d.badgeOk ? " ok" : ""}`}>{d.badge}</span>
                <span className="al-dev-addr"><PinIcon /> {d.direccion}</span>
              </div>
              <div className="al-dev-body">
                <div className="al-dev-name">{d.nombre}</div>
                <p className="al-dev-desc">{d.desc}</p>
                <div className="al-dev-facts"><span className="rec">🛏 {d.rec}</span><span>· {d.zona}</span></div>
                <div className="al-dev-foot">
                  <div className="al-dev-price">{d.precio}{d.precioSub && <small>{d.precioSub}</small>}</div>
                  <span className="al-dev-disp">{d.disp}</span>
                </div>
              </div>
              <span className="al-dev-cta">Ver desarrollo →</span>
            </button>
          ))}
          </div>
          <button type="button" className="al-car-arrow al-car-next" aria-label="Siguiente" onClick={() => scrollCar(1)}>›</button>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────── */}
      <section className="al-cta">
        <div className="al-reveal" data-reveal>
          <div className="al-kicker">Sin exclusividad · Sin cuotas</div>
          <h2 className="al-cta-h">El registro toma menos que servirte un <span className="al-serif-italic">café</span>.</h2>
          <p className="al-cta-p">Comisión competitiva por cada cierre, definida por desarrollo. Empieza ahora y hoy mismo tienes acceso al inventario.</p>
          <div className="al-cta-actions">
            <button className="al-btn al-btn-primary" onClick={openReg} style={{ fontSize: 16, padding: "15px 30px" }}>Registrarme como agente →</button>
          </div>
          <p className="al-muted" style={{ fontSize: 12.5, marginTop: 20 }}>128 agentes se registraron este mes · validación en menos de 24 h</p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="al-footer">
        <span style={{ fontWeight: 700, letterSpacing: ".12em", color: "var(--ink)" }}>SOZU<span style={{ color: "var(--green-ink)" }}> · AGENTES</span></span>
        <span style={{ marginRight: "auto" }}>Operado por Grupo Investimento · Guadalajara, Jal.</span>
        <a href="https://www.sozu.com/aviso-de-privacidad" target="_blank" rel="noopener noreferrer">Aviso de privacidad</a>
        <a href="mailto:hola@sozu.com">hola@sozu.com</a>
      </footer>

      {/* ── Modal detalle de desarrollo ───────────────────────────────── */}
      {detalle && (
        <div className="al-modal-backdrop" onClick={() => setDetalle(null)}>
          <div className="al-detail" role="dialog" aria-modal="true" aria-label={`Detalle de ${detalle.nombre}`} onClick={(e) => e.stopPropagation()}>
            <div className="al-detail-hero">
              <img src={detalle.img} alt={`Desarrollo ${detalle.nombre}`} />
              <span className={`al-dev-badge al-detail-badge${detalle.badgeOk ? " ok" : ""}`}>{detalle.badge}</span>
              <button className="al-detail-close" onClick={() => setDetalle(null)} aria-label="Cerrar">✕</button>
            </div>
            <div className="al-detail-body">
              <div className="al-detail-head">
                <div>
                  <h3 className="al-detail-title">{detalle.nombre}</h3>
                  <div className="al-detail-addr"><PinIcon /> {detalle.direccion}</div>
                </div>
                <span className="al-dev-disp">{detalle.disp}</span>
              </div>

              <div className="al-detail-stats">
                <div className="al-detail-stat"><div className="k">Precio</div><div className="v green">{detalle.precio}{detalle.precioSub ? ` ${detalle.precioSub}` : ""}</div></div>
                <div className="al-detail-stat"><div className="k">Recámaras</div><div className="v">{detalle.rec}</div></div>
                <div className="al-detail-stat"><div className="k">Entrega</div><div className="v">{detalle.entrega}</div></div>
              </div>

              <p className="al-detail-desc">{detalle.desc}</p>

              <div className="al-detail-sub">Modelos disponibles</div>
              <div className="al-models">
                {detalle.modelos.map((m) => (
                  <div className="al-model" key={m.n}>
                    <div className="al-model-n">{m.n}</div>
                    <div className="al-model-t">{m.t}</div>
                    <div className="al-model-f"><span>🛏 {m.rec}</span><span>🛁 {m.ba}</span></div>
                  </div>
                ))}
              </div>

              <div className="al-detail-actions">
                <button className="al-btn al-btn-primary" onClick={openReg} style={{ fontSize: 15, padding: "13px 24px" }}>Registrarme para vender {detalle.nombre} →</button>
                <button className="al-btn al-btn-outline" onClick={() => setDetalle(null)} style={{ fontSize: 15, padding: "13px 24px" }}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de registro ─────────────────────────────────────────── */}
      {regOpen && (
        <div className="al-modal-backdrop" onClick={closeReg}>
          <div className="al-modal" role="dialog" aria-modal="true" aria-labelledby="al-reg-title" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, letterSpacing: ".1em", fontSize: 14 }}>SOZU<span style={{ color: "var(--green-ink)" }}> · REGISTRO</span></span>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="al-muted" style={{ fontSize: 12 }}>{pasoLabel}</span>
                <button className="al-btn al-btn-outline" onClick={closeReg} aria-label="Cerrar" style={{ width: 32, height: 32, padding: 0, fontSize: 14 }}>✕</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ flex: 1, height: 4, borderRadius: 2, background: barColor(1), transition: "background .3s ease" }} />
              <span style={{ flex: 1, height: 4, borderRadius: 2, background: barColor(2), transition: "background .3s ease" }} />
              <span style={{ flex: 1, height: 4, borderRadius: 2, background: barColor(3), transition: "background .3s ease" }} />
            </div>

            {/* Paso 1 */}
            {paso === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); capturar(); }} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div>
                  <h3 id="al-reg-title" style={{ fontSize: 23 }}>Empecemos por saludarte</h3>
                  <p className="al-muted" style={{ fontSize: 13.5, marginTop: 4 }}>Solo esto para arrancar. Sin papeleo, sin cuotas.</p>
                </div>
                <div className="al-field">
                  <label htmlFor="al-nombre">Nombre completo</label>
                  <input id="al-nombre" ref={nombreRef} className={`al-input ${showErrors && !nombreOk ? "al-invalid" : ""}`} placeholder="p.ej. Mariana Robles" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
                  {showErrors && !nombreOk && <div className="al-error" role="alert">Escribe tu nombre completo.</div>}
                </div>
                <div className="al-field">
                  <label htmlFor="al-correo">Correo</label>
                  <input id="al-correo" type="email" className={`al-input ${showErrors && !correoOk ? "al-invalid" : ""}`} placeholder="mariana@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" />
                  {showErrors && !correoOk && <div className="al-error" role="alert">Ingresa un correo válido.</div>}
                </div>
                <div className="al-field">
                  <label htmlFor="al-whats">WhatsApp</label>
                  <input id="al-whats" type="tel" inputMode="tel" className={`al-input ${showErrors && !telOk ? "al-invalid" : ""}`} placeholder="33 0000 0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} autoComplete="tel" />
                  {showErrors && !telOk && <div className="al-error" role="alert">Necesitamos 10 dígitos para escribirte por WhatsApp.</div>}
                </div>
                {error && <div className="al-error" role="alert" style={{ fontSize: 13 }}>{error}</div>}
                <button type="submit" className="al-btn al-btn-primary al-btn-block" disabled={submitting} style={{ minHeight: 48, fontSize: 15 }}>
                  {submitting ? <><span className="al-spinner" /> Enviando…</> : "Continuar → zona y experiencia"}
                </button>
                <p className="al-muted" style={{ fontSize: 11.5, textAlign: "center" }}>Sin cuotas ni papeleo por adelantado. Te toma menos de 2 minutos.</p>
              </form>
            )}

            {/* Paso 2 */}
            {paso === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div>
                  <h3 style={{ fontSize: 23 }}>¿Dónde vendes?</h3>
                  <p className="al-muted" style={{ fontSize: 13.5, marginTop: 4 }}>Con esto te asignamos inventario y un contacto de zona.</p>
                </div>
                <div className="al-field">
                  <label>Zonas donde tienes clientes</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                    {ZONAS.map((z) => (
                      <button key={z} type="button" className="al-chip" aria-pressed={zonas.includes(z)} onClick={() => toggleZona(z)}>{z}{zonas.includes(z) ? " ✓" : ""}</button>
                    ))}
                  </div>
                </div>
                <div className="al-field">
                  <label>¿Cómo trabajas?</label>
                  <div className="al-seg">
                    {MODOS.map((m) => (<button key={m} type="button" className="al-seg-opt" aria-pressed={modo === m} onClick={() => setModo(m)}>{m}</button>))}
                  </div>
                </div>
                <div className="al-field">
                  <label>Años vendiendo inmuebles</label>
                  <div className="al-seg">
                    {EXPS.map((x) => (<button key={x} type="button" className="al-seg-opt" aria-pressed={experiencia === x} onClick={() => setExperiencia(x)}>{x}</button>))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="al-btn al-btn-outline" onClick={() => setPaso(1)} style={{ minHeight: 48 }}>← Atrás</button>
                  <button className="al-btn al-btn-primary" onClick={() => setPaso(3)} style={{ flex: 1, minHeight: 48, fontSize: 15 }}>Continuar → último paso</button>
                </div>
              </div>
            )}

            {/* Paso 3 */}
            {paso === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div>
                  <h3 style={{ fontSize: 23 }}>Último paso, ya casi vendes</h3>
                  <p className="al-muted" style={{ fontSize: 13.5, marginTop: 4 }}>Un video de 10 minutos: cómo operamos, cómo cobras, cómo apartas.</p>
                </div>
                <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", position: "relative", height: 190, background: "var(--green-050)", border: "1px solid var(--green-200)", display: "grid", placeItems: "center" }}>
                  <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--green)", color: "#fff", display: "grid", placeItems: "center", fontSize: 18, boxShadow: "0 8px 20px -8px hsl(139 45% 34% / .6)" }}>▶</span>
                  <span style={{ position: "absolute", left: 14, bottom: 12, fontSize: 12, color: "var(--green-ink)", fontWeight: 600 }}>Bienvenida a SOZU · 10:12</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--green-050)", border: "1px solid var(--green-200)" }}>
                  <span className="al-dot" style={{ flex: "none" }} />
                  <span style={{ fontSize: 12.5, color: "var(--green-ink)" }}>Al terminar validamos tu perfil en menos de 24 h y se desbloquea el inventario.</span>
                </div>
                {error && <div className="al-error" role="alert" style={{ fontSize: 13 }}>{error}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="al-btn al-btn-outline" onClick={() => setPaso(2)} disabled={submitting} style={{ minHeight: 48 }}>← Atrás</button>
                  <button className="al-btn al-btn-primary" onClick={finish} disabled={submitting} style={{ flex: 1, minHeight: 48, fontSize: 15 }}>
                    {submitting ? <><span className="al-spinner" /> Enviando…</> : "Terminar registro ✓"}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmación */}
            {paso === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 15, alignItems: "center", textAlign: "center", padding: "10px 0 4px" }}>
                <span style={{ width: 62, height: 62, borderRadius: "50%", background: "var(--green)", color: "#fff", display: "grid", placeItems: "center", fontSize: 26, boxShadow: "0 12px 28px -10px hsl(139 45% 34% / .6)" }}>✓</span>
                <div>
                  <h3 style={{ fontSize: 25 }}>Listo. Bienvenida a SOZU.</h3>
                  <p className="al-muted" style={{ fontSize: 14, marginTop: 6, maxWidth: 360 }}>Te enviamos un correo para <strong>confirmar tu cuenta</strong> y crear tu contraseña — revisa tu bandeja (y spam). Validamos tu perfil en menos de 24 h.</p>
                </div>
                <button className="al-btn al-btn-primary al-btn-block" onClick={closeReg} style={{ minHeight: 48, fontSize: 15 }}>Explorar el inventario mientras tanto</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
