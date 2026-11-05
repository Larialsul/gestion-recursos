// Capa de sincronización de SCP Base Manager con Supabase.
// El código se valida en funciones SQL; la tabla no es accesible directamente desde el navegador.
let SCP_ACCESS_CODE = null;
let SCP_REVISION = 0;
let SCP_SYNC_READY = false;
let SCP_SAVE_TIMER = null;
let SCP_POLL_TIMER = null;
let SCP_SAVING = false;
let SCP_DIRTY = false;
let SCP_LAST_REMOTE_REVISION = 0;

function scpClient() {
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || !cfg.anonKey || !window.supabase) {
    throw new Error('Falta configurar js/config.js con la URL y la clave pública de Supabase.');
  }
  if (!window._scpSupabaseClient) window._scpSupabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
  return window._scpSupabaseClient;
}

async function scpRpcGet(code) {
  const { data, error } = await scpClient().rpc('scp_get_state', { p_code: code });
  if (error) throw error;
  return data;
}

async function scpRpcSave(code, state, revision) {
  const { data, error } = await scpClient().rpc('scp_save_state', {
    p_code: code, p_state: state, p_expected_revision: revision
  });
  if (error) throw error;
  return data;
}

async function iniciarConexionSupabase() {
  const gate = document.getElementById('access-gate');
  const form = document.getElementById('access-form');
  const input = document.getElementById('access-code');
  const errorBox = document.getElementById('access-error');
  const cached = sessionStorage.getItem('scp_access_code');
  if (cached) input.value = cached;

  return new Promise(resolve => {
    let terminado = false;
    const entrar = async (event) => {
      if (event) event.preventDefault();
      if (terminado) return;
      errorBox.textContent = 'Conectando con la base…';
      try {
        const code = input.value.trim();
        if (!code) throw new Error('Introduce el código de acceso.');
        const result = await scpRpcGet(code);
        SCP_ACCESS_CODE = code;
        SCP_REVISION = Number(result.revision) || 1;
        SCP_LAST_REMOTE_REVISION = SCP_REVISION;
        sessionStorage.setItem('scp_access_code', code);
        aplicarEstadoRemoto(result.state);
        SCP_SYNC_READY = true;
        gate.style.display = 'none';
        if (!terminado) { terminado = true; resolve(); }
        iniciarSondeoRemoto();
      } catch (err) {
        errorBox.textContent = err.message || 'No se pudo conectar. Comprueba el código y la configuración.';
      }
    };
    form.addEventListener('submit', entrar);
    if (cached) entrar();
  });
}

function aplicarEstadoRemoto(state) {
  if (!state || typeof state !== 'object') throw new Error('La base de datos devolvió un estado no válido.');
  BASE = state;
  SALAS_STATE = Array.isArray(state.salas) ? state.salas : [];
  PERSONAJES_STATE = Array.isArray(state.personajes) ? state.personajes : [];
  FACCIONES_STATE = Array.isArray(state.facciones) ? state.facciones : [];
  EXPEDICIONES_STATE = Array.isArray(state.expediciones) ? state.expediciones : [];
  INVENTARIO_STATE = typeof state.inventario === 'string' ? state.inventario : '';
  renderizarTodaLaAplicacion();
}

function renderizarTodaLaAplicacion() {
  const day = document.getElementById('day-counter');
  if (day) day.textContent = BASE.dia ?? 1;
  mostrarBase(BASE);
  mostrarGestionRecursos();
  mostrarSalas();
  mostrarPersonajes();
  iniciarInventario();
  mostrarFacciones();
  mostrarExpediciones();
}

function programarGuardadoRemoto() {
  if (!SCP_SYNC_READY || !SCP_ACCESS_CODE) return;
  SCP_DIRTY = true;
  clearTimeout(SCP_SAVE_TIMER);
  SCP_SAVE_TIMER = setTimeout(() => guardarEstadoRemoto(), 900);
}

async function guardarEstadoRemoto() {
  if (!SCP_SYNC_READY || SCP_SAVING || !SCP_DIRTY) return;
  SCP_SAVING = true;
  const status = document.getElementById('global-save-status');
  try {
    const result = await scpRpcSave(SCP_ACCESS_CODE, construirBaseActual(), SCP_REVISION);
    SCP_REVISION = Number(result.revision) || SCP_REVISION + 1;
    SCP_LAST_REMOTE_REVISION = SCP_REVISION;
    SCP_DIRTY = false;
    if (status) { status.textContent = '✓ Sincronizado'; status.classList.add('saved'); }
  } catch (err) {
    if (status) { status.textContent = err.message?.includes('CONFLICT') ? '⚠ Conflicto: recarga para recibir los últimos cambios' : '⚠ Error al guardar: ' + (err.message || 'desconocido'); status.classList.remove('saved'); }
    console.error('SCP sync save:', err);
  } finally {
    SCP_SAVING = false;
  }
}

function iniciarSondeoRemoto() {
  clearInterval(SCP_POLL_TIMER);
  SCP_POLL_TIMER = setInterval(async () => {
    if (!SCP_SYNC_READY || SCP_DIRTY || SCP_SAVING) return;
    try {
      const result = await scpRpcGet(SCP_ACCESS_CODE);
      const revision = Number(result.revision) || 0;
      if (revision > SCP_LAST_REMOTE_REVISION) {
        SCP_REVISION = revision;
        SCP_LAST_REMOTE_REVISION = revision;
        aplicarEstadoRemoto(result.state);
        const status = document.getElementById('global-save-status');
        if (status) { status.textContent = '↻ Cambios recibidos de otro jugador'; status.classList.add('saved'); }
      }
    } catch (err) { console.warn('SCP sync poll:', err); }
  }, 3500);
}
