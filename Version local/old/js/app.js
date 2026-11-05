function mostrarBase(base) {
    const week = document.getElementById("week");
    if (week) week.textContent = base.semana ?? "-";

    const population = document.getElementById("population");
    if (population) population.textContent = base.habitantes ?? "-";

    const produccionSalas = calcularProduccionSalas();
    const produccionPersonajes = calcularProduccionPersonajes();
    const produccionTotal = combinarProduccion(produccionSalas, produccionPersonajes);
    const consumoTotal = calcularConsumoActual();

    const balance = {};
    for (const recurso in (base.resources || {})) {
        const produccion = produccionTotal[recurso] ?? 0;
        const consumo = consumoTotal[recurso] ?? 0;
        balance[recurso] = produccion - consumo;
    }

    const resources = document.getElementById("resources");
    if (resources) resources.innerHTML = crearRecursos(base, balance);

    const production = document.getElementById("production");
    if (production) production.innerHTML = crearProduccion(produccionTotal);

    const consumption = document.getElementById("consumption");
    if (consumption) consumption.innerHTML = crearConsumo(consumoTotal);

    actualizarResumenSalas();
    actualizarResumenPersonajes();
    actualizarResumenFacciones();
}

function calcularConsumoActual() {
    const consumo = {};
    const personajes = cargarPersonajes();
    const salas = cargarSalas();

    // Cada personaje consume 1 comida y 1 agua al día.
    consumo.comida = personajes.length;
    consumo.agua = personajes.length;

    // Los personajes pueden gastar 1 lujo al día si así se configura.
    const lujosPersonajes = personajes.filter(p => p.gasto === "lujos").length;
    if (lujosPersonajes > 0) consumo.lujos = lujosPersonajes;

    // Las salas activas pueden gastar la cantidad diaria configurada del recurso elegido.
    // Solo se permiten comida, agua, lujos o energía.
    const gastosValidosSala = ["comida", "agua", "lujos", "energia"];
    for (const recurso of gastosValidosSala) {
        const cantidad = salas.filter(s => s.activa && s.gasto === recurso).reduce((total, s) => total + (Number(s.cantidadConsumo) || 0), 0);
        if (cantidad > 0) consumo[recurso] = (consumo[recurso] || 0) + cantidad;
    }

    return consumo;
}

function crearRecursos(base, balance) {
    const iconos = { comida:"🍖", agua:"💧", lujos:"💎", defensa:"🛡️", salubridad:"🩺", energia:"⚡", moral:"😊" };
    let html = '<div class="resource-list">';
    for (const recurso in (base.resources || {})) {
        const cantidad = base.resources[recurso];
        const bal = balance[recurso] ?? 0;
        const clase = bal > 0 ? "positive" : bal < 0 ? "negative" : "neutral";
        const signo = bal > 0 ? "+" : "";
        const recursosConBalanceDiario = ["comida", "agua", "lujos", "energia"];
        const detalleBalance = recursosConBalanceDiario.includes(recurso) ? `<div class="resource-details"><span class="balance ${clase}">${signo}${bal} / día</span></div>` : "";
        html += `<div class="resource-card"><div class="resource-icon">${iconos[recurso] ?? "📦"}</div><div class="resource-info"><div class="resource-name">${capitalizar(recurso)}</div><div class="resource-amount">${cantidad}</div>${detalleBalance}</div></div>`;
    }
    return html + "</div>";
}

function crearProduccion(produccion) {
    const iconos = { comida:"🍖", agua:"💧", lujos:"💎", defensa:"🛡️", salubridad:"🩺", energia:"⚡", moral:"😊" };
    let html = '<div class="resource-list">';

    if (!Object.keys(produccion).length) {
        html += '<div class="empty-state"><span>📦</span><p>Ninguna sala o personaje disponible produce recursos.</p></div>';
    } else {
        for (const recurso in produccion) {
            html += `<div class="resource-card"><div class="resource-icon">${iconos[recurso] ?? "📦"}</div><div class="resource-info"><div class="resource-name">${capitalizar(recurso)}</div><div class="resource-amount production">+${produccion[recurso]}</div><div class="resource-details"><span class="production-label">Producción diaria</span></div></div></div>`;
        }
    }
    return html + "</div>";
}

function calcularProduccionSalas() {
    const salas = cargarSalas();
    const produccion = {};

    for (const sala of salas) {
        if (!sala.activa || !sala.recurso) continue;
        const cantidad = Number(sala.cantidadProduccion ?? sala.cantidad) || 0;
        if (cantidad <= 0) continue;
        produccion[sala.recurso] = (produccion[sala.recurso] || 0) + cantidad;
    }

    return produccion;
}

function calcularProduccionPersonajes() {
    const personajes = cargarPersonajes();
    const produccion = {};

    for (const personaje of personajes) {
        // Solo los personajes disponibles contribuyen a la producción.
        if (personaje.estado !== "disponible" || !personaje.recurso) continue;
        const cantidad = Number(personaje.cantidad) || 0;
        if (cantidad <= 0) continue;
        produccion[personaje.recurso] = (produccion[personaje.recurso] || 0) + cantidad;
    }

    return produccion;
}

function combinarProduccion(...fuentes) {
    const total = {};
    for (const fuente of fuentes) {
        for (const recurso in fuente) {
            total[recurso] = (total[recurso] || 0) + (Number(fuente[recurso]) || 0);
        }
    }
    return total;
}

function crearConsumo(consumo) {
    const iconos = { comida:"🍖", agua:"💧", lujos:"💎", defensa:"🛡️", salubridad:"🩺", energia:"⚡", moral:"😊" };
    let html = '<div class="resource-list">';

    consumo = consumo || {};

    if (!Object.keys(consumo).length) {
        html += '<div class="empty-state"><span>📦</span><p>No hay consumo de recursos.</p></div>';
    } else {
        for (const recurso in consumo) {
            html += `<div class="resource-card">
                <div class="resource-icon">${iconos[recurso] ?? "📦"}</div>
                <div class="resource-info">
                    <div class="resource-name">${capitalizar(recurso)}</div>
                    <div class="resource-amount consumption">-${consumo[recurso]}</div>
                    <div class="resource-details"><span class="consumption-label">Consumo diario</span></div>
                </div>
            </div>`;
        }
    }

    return html + "</div>";
}

function capitalizar(texto) { return texto.charAt(0).toUpperCase() + texto.slice(1); }

let SALAS_STATE = null;

function cargarSalas() {
    if (SALAS_STATE !== null) return SALAS_STATE;

    const local = localStorage.getItem("scp_base_rooms");
    if (local) {
        try {
            SALAS_STATE = JSON.parse(local);
            return SALAS_STATE;
        } catch (e) {
            localStorage.removeItem("scp_base_rooms");
        }
    }

    if (Array.isArray(window.SALAS)) {
        SALAS_STATE = JSON.parse(JSON.stringify(window.SALAS));
        return SALAS_STATE;
    }

    SALAS_STATE = [
        { id: Date.now(), nombre: "Cocina", descripcion: "", activa: true, recurso: "comida", cantidadProduccion: 1, cantidadConsumo: 0, gasto: "" },
        { id: Date.now()+1, nombre: "Dormitorio", descripcion: "", activa: true, recurso: "", cantidadProduccion: 0, cantidadConsumo: 0, gasto: "" },
        { id: Date.now()+2, nombre: "Laboratorio", descripcion: "", activa: false, recurso: "", cantidadProduccion: 0, cantidadConsumo: 0, gasto: "" }
    ];

    return SALAS_STATE;
}

function guardarSalas(salas) {
    SALAS_STATE = salas;
    localStorage.setItem("scp_base_rooms", JSON.stringify(salas));
}

function actualizarResumenSalas() {
    const contenedor = document.getElementById("active-rooms-summary");
    if (!contenedor) return;
    const activas = cargarSalas().filter(sala => sala.activa === true);
    if (!activas.length) {
        contenedor.innerHTML = `<div class="empty-state"><span>🏢</span><p>No hay salas activas.</p></div>`;
        return;
    }
    contenedor.innerHTML = `<div class="active-room-list">${activas.map(sala => `
        <div class="active-room-summary">
            <span class="active-room-dot"></span>
            <div><strong>${escapeHTML(sala.nombre || "Sala sin nombre")}</strong>${sala.descripcion ? `<small>${escapeHTML(sala.descripcion)}</small>` : ""}</div>
        </div>`).join("")}</div>`;
}

function mostrarSalas() {
    const contenedor = document.getElementById("rooms-list");
    if (!contenedor) return;
    const salas = cargarSalas();
    if (!salas.length) {
        contenedor.innerHTML = `<div class="empty-state"><span>🏢</span><p>No hay salas construidas.</p></div>`;
        actualizarResumenSalas();
        return;
    }
    contenedor.innerHTML = salas.map(sala => `
        <div class="room-row">
            <div class="room-name">
                <span class="room-icon">🏢</span>
                <input type="text" value="${escapeAttribute(sala.nombre || "")}" data-id="${sala.id}" class="room-name-input" placeholder="Nombre de la sala">
            </div>
            <div>
                <input type="text" value="${escapeAttribute(sala.descripcion || "")}" data-id="${sala.id}" class="room-description-input" placeholder="Descripción">
            </div>
            <div>
                <label class="switch"><input type="checkbox" class="room-active" data-id="${sala.id}" ${sala.activa ? "checked" : ""}><span class="slider"></span></label>
                <span class="room-status ${sala.activa ? "active" : "inactive"}">${sala.activa ? "Activa" : "Inactiva"}</span>
            </div>
            <div>
                <select class="room-resource" data-id="${sala.id}">${crearOpcionesRecurso(sala.recurso)}</select>
            </div>
            <div><input type="number" min="0" value="${Number(sala.cantidadProduccion ?? sala.cantidad) || 0}" class="room-production-amount" data-id="${sala.id}" title="Cantidad producida"></div>
            <div>
                <select class="room-expense" data-id="${sala.id}">${crearOpcionesGastoSala(sala.gasto)}</select>
            </div>
            <div><input type="number" min="0" value="${Number(sala.cantidadConsumo) || 0}" class="room-consumption-amount" data-id="${sala.id}" title="Cantidad consumida por día"></div>
            <div><button class="delete-room" data-id="${sala.id}" title="Eliminar sala">🗑️</button></div>
        </div>`).join("");
    conectarEventosSalas();
    actualizarResumenSalas();
    mostrarBase(BASE);
}

function crearOpcionesRecurso(seleccionado) {
    const recursos = { "": "— Ninguno —", comida:"🍖 Comida", agua:"💧 Agua", lujos:"💎 Lujos", energia:"⚡ Energía", defensa:"🛡️ Defensa", salubridad:"🩺 Salubridad", moral:"😊 Moral" };
    return Object.entries(recursos).map(([id,nombre]) => `<option value="${id}" ${id === (seleccionado || "") ? "selected" : ""}>${nombre}</option>`).join("");
}

function crearOpcionesGastoSala(seleccionado) {
    return `
        <option value="" ${!seleccionado ? "selected" : ""}>— Ninguno —</option>
        <option value="comida" ${seleccionado === "comida" ? "selected" : ""}>🍖 Comida</option>
        <option value="agua" ${seleccionado === "agua" ? "selected" : ""}>💧 Agua</option>
        <option value="lujos" ${seleccionado === "lujos" ? "selected" : ""}>💎 Lujos</option>
        <option value="energia" ${seleccionado === "energia" ? "selected" : ""}>⚡ Energía</option>
    `;
}

function conectarEventosSalas() {
    const guardarCampo = (id, campo, valor) => {
        const salas = cargarSalas(); const sala = salas.find(s => s.id == id);
        if (!sala) return; sala[campo] = valor; guardarSalas(salas); actualizarResumenSalas(); mostrarBase(BASE);
    };

    document.querySelectorAll(".room-name-input").forEach(input => input.addEventListener("change", () => guardarCampo(input.dataset.id, "nombre", input.value.trim() || "Sala sin nombre")));
    document.querySelectorAll(".room-description-input").forEach(input => input.addEventListener("change", () => guardarCampo(input.dataset.id, "descripcion", input.value.trim())));
    document.querySelectorAll(".room-active").forEach(input => input.addEventListener("change", () => { guardarCampo(input.dataset.id, "activa", input.checked); mostrarSalas(); }));
    document.querySelectorAll(".room-resource").forEach(select => select.addEventListener("change", () => guardarCampo(select.dataset.id, "recurso", select.value)));
    document.querySelectorAll(".room-expense").forEach(select => select.addEventListener("change", () => guardarCampo(select.dataset.id, "gasto", select.value)));
    document.querySelectorAll(".room-production-amount").forEach(input => input.addEventListener("change", () => guardarCampo(input.dataset.id, "cantidadProduccion", Math.max(0, Number(input.value) || 0))));
    document.querySelectorAll(".room-consumption-amount").forEach(input => input.addEventListener("change", () => guardarCampo(input.dataset.id, "cantidadConsumo", Math.max(0, Number(input.value) || 0))));
    document.querySelectorAll(".delete-room").forEach(button => button.addEventListener("click", () => {
        const nuevas = cargarSalas().filter(sala => sala.id !== Number(button.dataset.id));
        guardarSalas(nuevas); mostrarSalas();
    }));
}

function escapeHTML(texto) { return String(texto).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c])); }
function escapeAttribute(texto) { return escapeHTML(texto); }

document.addEventListener("DOMContentLoaded", () => {
    const boton = document.getElementById("add-room");
    if (!boton) return;
    boton.addEventListener("click", () => {
        const salas = cargarSalas();
        salas.push({ id: Date.now(), nombre: "Nueva sala", descripcion: "", activa: false, recurso: "", cantidadProduccion: 0, cantidadConsumo: 0, gasto: "" });
        guardarSalas(salas); mostrarSalas();
        const ultimo = document.querySelector(".room-name-input:last-of-type");
        if (ultimo) { ultimo.focus(); ultimo.select(); }
    });
});


// ============================================
// PERSONAJES
// ============================================

let PERSONAJES_STATE = [];

function cargarPersonajes() {
    if (Array.isArray(PERSONAJES_STATE)) return PERSONAJES_STATE;
    PERSONAJES_STATE = [];
    return PERSONAJES_STATE;
}

function guardarPersonajes(personajes) {
    PERSONAJES_STATE = personajes;
    localStorage.setItem("scp_base_characters", JSON.stringify(personajes));
}

function crearOpcionesEstado(seleccionado) {
    return `
        <option value="disponible" ${seleccionado === "disponible" ? "selected" : ""}>Disponible</option>
        <option value="expedicion" ${seleccionado === "expedicion" ? "selected" : ""}>En expedición</option>
    `;
}

function crearOpcionesGastoPersonaje(seleccionado) {
    return `
        <option value="" ${!seleccionado ? "selected" : ""}>— Ninguno —</option>
        <option value="lujos" ${seleccionado === "lujos" ? "selected" : ""}>💎 Lujos</option>
    `;
}

function actualizarResumenPersonajes() {
    const contenedor = document.getElementById("active-characters-summary");
    if (!contenedor) return;
    const personajes = cargarPersonajes();
    if (!personajes.length) {
        contenedor.innerHTML = `<div class="empty-state"><span>👤</span><p>No hay personajes registrados.</p></div>`;
        return;
    }
    contenedor.innerHTML = `<div class="active-character-list">${personajes.map(p => {
        const disponible = p.estado === "disponible";
        return `<div class="active-character-summary"><span class="character-state-dot ${disponible ? "available" : "away"}"></span><div><strong>${escapeHTML(p.nombre || "Personaje sin nombre")}</strong><small>${escapeHTML(p.ocupacion || "Sin ocupación")} · ${disponible ? "Disponible" : "En expedición"}</small></div></div>`;
    }).join("")}</div>`;
}

function mostrarPersonajes() {
    const contenedor = document.getElementById("characters-list");
    if (!contenedor) return;
    const personajes = cargarPersonajes();

    if (!personajes.length) {
        contenedor.innerHTML = `<div class="empty-state"><span>👤</span><p>No hay personajes registrados.</p></div>`;
        return;
    }

    contenedor.innerHTML = personajes.map(personaje => `
        <div class="character-row">
            <div class="character-name">
                <span class="character-icon">👤</span>
                <input type="text" value="${escapeAttribute(personaje.nombre || "")}" data-id="${personaje.id}" class="character-name-input" placeholder="Nombre">
            </div>
            <div><input type="text" value="${escapeAttribute(personaje.ocupacion || "")}" data-id="${personaje.id}" class="character-occupation-input" placeholder="Ocupación"></div>
            <div><input type="text" value="${escapeAttribute(personaje.descripcion || "")}" data-id="${personaje.id}" class="character-description-input" placeholder="Descripción"></div>
            <div><select class="character-status" data-id="${personaje.id}">${crearOpcionesEstado(personaje.estado)}</select></div>
            <div><select class="character-expense" data-id="${personaje.id}">${crearOpcionesGastoPersonaje(personaje.gasto)}</select></div>
            <div><select class="character-resource" data-id="${personaje.id}">${crearOpcionesRecurso(personaje.recurso)}</select></div>
            <div><input type="number" min="0" value="${Number(personaje.cantidad) || 0}" class="character-amount" data-id="${personaje.id}"></div>
            <div><button class="delete-character" data-id="${personaje.id}" title="Eliminar personaje">🗑️</button></div>
        </div>
    `).join("");

    conectarEventosPersonajes();
}

function conectarEventosPersonajes() {
    const guardarCampo = (id, campo, valor) => {
        const personajes = cargarPersonajes();
        const personaje = personajes.find(p => p.id == id);
        if (!personaje) return;
        personaje[campo] = valor;
        guardarPersonajes(personajes);
        mostrarBase(BASE);
    };

    document.querySelectorAll(".character-name-input").forEach(input => input.addEventListener("change", () => guardarCampo(input.dataset.id, "nombre", input.value.trim() || "Personaje sin nombre")));
    document.querySelectorAll(".character-occupation-input").forEach(input => input.addEventListener("change", () => guardarCampo(input.dataset.id, "ocupacion", input.value.trim())));
    document.querySelectorAll(".character-description-input").forEach(input => input.addEventListener("change", () => guardarCampo(input.dataset.id, "descripcion", input.value.trim())));
    document.querySelectorAll(".character-status").forEach(select => select.addEventListener("change", () => guardarCampo(select.dataset.id, "estado", select.value)));
    document.querySelectorAll(".character-expense").forEach(select => select.addEventListener("change", () => guardarCampo(select.dataset.id, "gasto", select.value)));
    document.querySelectorAll(".character-resource").forEach(select => select.addEventListener("change", () => guardarCampo(select.dataset.id, "recurso", select.value)));
    document.querySelectorAll(".character-amount").forEach(input => input.addEventListener("change", () => guardarCampo(input.dataset.id, "cantidad", Math.max(0, Number(input.value) || 0))));
    document.querySelectorAll(".delete-character").forEach(button => button.addEventListener("click", () => {
        const personajes = cargarPersonajes().filter(personaje => personaje.id !== Number(button.dataset.id));
        guardarPersonajes(personajes);
        mostrarPersonajes();
        mostrarBase(BASE);
    }));
}

document.addEventListener("DOMContentLoaded", () => {
    const boton = document.getElementById("add-character");
    if (!boton) return;
    boton.addEventListener("click", () => {
        const personajes = cargarPersonajes();
        personajes.push({ id: Date.now(), nombre: "Nuevo personaje", ocupacion: "", descripcion: "", estado: "disponible", gasto: "", recurso: "", cantidadProduccion: 0, cantidadConsumo: 0, gasto: "" });
        guardarPersonajes(personajes);
        mostrarPersonajes();
        const ultimo = document.querySelector(".character-name-input:last-of-type");
        if (ultimo) { ultimo.focus(); ultimo.select(); }
    });
});

// ============================================
// FACCIONES
// ============================================

let FACCIONES_STATE = [];

function cargarFacciones() {
    if (Array.isArray(FACCIONES_STATE)) return FACCIONES_STATE;
    FACCIONES_STATE = [];
    return FACCIONES_STATE;
}

function guardarFacciones(facciones) {
    FACCIONES_STATE = facciones;
    localStorage.setItem("scp_base_factions", JSON.stringify(facciones));
}

function crearEstrellasRelacion(valor) {
    const n = Math.min(5, Math.max(1, Number(valor) || 1));
    return "★".repeat(n) + "☆".repeat(5 - n);
}

function actualizarResumenFacciones() {
    const contenedor = document.getElementById("factions-summary");
    if (!contenedor) return;

    const facciones = cargarFacciones();

    if (!facciones.length) {
        contenedor.innerHTML = `<div class="empty-state"><span>🤝</span><p>No hay facciones registradas.</p></div>`;
        return;
    }

    contenedor.innerHTML = `<div class="faction-summary-list">${facciones.map(f => {
        const relacion = Math.min(5, Math.max(1, Number(f.relacion) || 1));
        const estrellas = "★".repeat(relacion) + "☆".repeat(5 - relacion);
        return `
            <div class="faction-summary-card">
                <div class="faction-summary-icon">🤝</div>
                <div class="faction-summary-info">
                    <strong>${escapeHTML(f.nombre || "Facción sin nombre")}</strong>
                    <span class="faction-summary-relation">${estrellas}</span>
                </div>
            </div>`;
    }).join("")}</div>`;
}

function mostrarFacciones() {
    const contenedor = document.getElementById("factions-list");
    if (!contenedor) return;
    const facciones = cargarFacciones();
    if (!facciones.length) {
        contenedor.innerHTML = '<div class="empty-state"><span>🤝</span><p>No hay facciones registradas.</p></div>';
        return;
    }
    contenedor.innerHTML = facciones.map(f => `
        <div class="faction-row">
            <div><input type="text" class="faction-name-input" data-id="${f.id}" value="${escapeAttribute(f.nombre || "")}" placeholder="Nombre"></div>
            <div><input type="text" class="faction-leader-input" data-id="${f.id}" value="${escapeAttribute(f.lider || "")}" placeholder="Líder"></div>
            <div><select class="faction-relation" data-id="${f.id}">${[1,2,3,4,5].map(n => `<option value="${n}" ${Number(f.relacion) === n ? "selected" : ""}>${crearEstrellasRelacion(n)}</option>`).join("")}</select></div>
            <div><textarea class="faction-description-input" data-id="${f.id}" placeholder="Descripción">${escapeHTML(f.descripcion || "")}</textarea></div>
            <div><textarea class="faction-notes-input" data-id="${f.id}" placeholder="Notas de jugadores">${escapeHTML(f.notasJugadores || "")}</textarea></div>
            <div><button class="delete-faction" data-id="${f.id}" title="Eliminar facción">🗑️</button></div>
        </div>`).join("");
    conectarEventosFacciones();
}

function conectarEventosFacciones() {
    const guardarCampo = (id, campo, valor) => {
        const facciones = cargarFacciones();
        const f = facciones.find(x => x.id == id);
        if (!f) return;
        f[campo] = valor;
        guardarFacciones(facciones);
        actualizarResumenFacciones();
    };
    document.querySelectorAll(".faction-name-input").forEach(i => i.addEventListener("change", () => guardarCampo(i.dataset.id, "nombre", i.value.trim() || "Facción sin nombre")));
    document.querySelectorAll(".faction-leader-input").forEach(i => i.addEventListener("change", () => guardarCampo(i.dataset.id, "lider", i.value.trim())));
    document.querySelectorAll(".faction-relation").forEach(i => i.addEventListener("change", () => guardarCampo(i.dataset.id, "relacion", Math.min(5, Math.max(1, Number(i.value) || 1)))));
    document.querySelectorAll(".faction-description-input").forEach(i => i.addEventListener("change", () => guardarCampo(i.dataset.id, "descripcion", i.value.trim())));
    document.querySelectorAll(".faction-notes-input").forEach(i => i.addEventListener("change", () => guardarCampo(i.dataset.id, "notasJugadores", i.value.trim())));
    document.querySelectorAll(".delete-faction").forEach(b => b.addEventListener("click", () => { guardarFacciones(cargarFacciones().filter(f => f.id !== Number(b.dataset.id))); mostrarFacciones(); actualizarResumenFacciones(); mostrarBase(BASE); }));
}

document.addEventListener("DOMContentLoaded", () => {
    const boton = document.getElementById("add-faction");
    if (!boton) return;
    boton.addEventListener("click", () => {
        const facciones = cargarFacciones();
        facciones.push({ id: Date.now(), nombre: "Nueva facción", lider: "", relacion: 3, descripcion: "", notasJugadores: "" });
        guardarFacciones(facciones); mostrarFacciones(); actualizarResumenFacciones(); mostrarBase(BASE);
        const ultimo = document.querySelector(".faction-name-input:last-of-type");
        if (ultimo) { ultimo.focus(); ultimo.select(); }
    });
});

// ============================================
// INVENTARIO
// ============================================

let INVENTARIO_STATE = typeof window.INVENTARIO === "string" ? window.INVENTARIO : "";

function iniciarInventario() {
    const textarea = document.getElementById("inventory-text");
    if (!textarea) return;

    // Recuperar la copia local si existe; si no, cargar inventario.js.
    const local = localStorage.getItem("scp_base_inventory");
    if (local !== null) INVENTARIO_STATE = local;
    textarea.value = INVENTARIO_STATE;

    if (textarea.dataset.bound) return;

    textarea.addEventListener("input", () => {
        INVENTARIO_STATE = textarea.value;
        localStorage.setItem("scp_base_inventory", INVENTARIO_STATE);
        marcarCambiosPendientes();
    });



    textarea.dataset.bound = "true";
}


// ============================================
// GESTIÓN MANUAL DE RECURSOS
// ============================================

const RECURSOS_GESTION = [
    { id: "comida", nombre: "Comida", icono: "🍖" },
    { id: "agua", nombre: "Agua", icono: "💧" },
    { id: "lujos", nombre: "Lujos", icono: "💎" },
    { id: "energia", nombre: "Energía", icono: "⚡" },
    { id: "defensa", nombre: "Defensa", icono: "🛡️" },
    { id: "salubridad", nombre: "Salubridad", icono: "🩺" },
    { id: "moral", nombre: "Moral", icono: "😊" }
];

function mostrarGestionRecursos() {
    const contenedor = document.getElementById("resource-management-list");
    if (!contenedor) return;

    const recursos = BASE.resources || {};
    contenedor.innerHTML = RECURSOS_GESTION.map(recurso => `
        <div class="resource-management-card">
            <div class="resource-management-head">
                <div class="resource-management-icon">${recurso.icono}</div>
                <div>
                    <div class="resource-management-name">${recurso.nombre}</div>
                    <div class="resource-management-current">Cantidad actual: <strong>${Number(recursos[recurso.id]) || 0}</strong></div>
                </div>
            </div>
            <div class="resource-management-controls">
                <input type="number" min="0" step="1" value="0" class="resource-management-amount" data-resource="${recurso.id}" aria-label="Cantidad a modificar de ${recurso.nombre}">
                <button type="button" class="resource-management-button remove" data-action="remove" data-resource="${recurso.id}">➖ Quitar</button>
                <button type="button" class="resource-management-button add" data-action="add" data-resource="${recurso.id}">➕ Añadir</button>
            </div>
        </div>
    `).join("");

    contenedor.querySelectorAll(".resource-management-button").forEach(boton => {
        boton.addEventListener("click", () => {
            const recurso = boton.dataset.resource;
            const input = contenedor.querySelector(`.resource-management-amount[data-resource="${recurso}"]`);
            const cantidad = Math.max(0, Math.floor(Number(input?.value) || 0));
            if (!cantidad) return;

            const actual = Math.max(0, Number(BASE.resources?.[recurso]) || 0);
            const nuevo = boton.dataset.action === "add"
                ? actual + cantidad
                : Math.max(0, actual - cantidad);

            if (!BASE.resources) BASE.resources = {};
            BASE.resources[recurso] = nuevo;
            marcarCambiosPendientes();
            mostrarGestionRecursos();
            mostrarBase(BASE);
        });
    });
}

function marcarCambiosPendientes() {
    const status = document.getElementById("global-save-status");
    if (status) {
        status.textContent = "Cambios pendientes de guardar";
        status.classList.remove("saved");
    }
}

// ============================================
// NAVEGACION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".tab");
    const pages = document.querySelectorAll(".page");

    function activarPestana(nombre) {
        tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === nombre));
        pages.forEach(page => page.classList.toggle("active", page.id === nombre));
        if (nombre === "resources-manager") mostrarGestionRecursos();
        if (nombre === "rooms") mostrarSalas();
        if (nombre === "personal") mostrarPersonajes();
        if (nombre === "inv") iniciarInventario();
        if (nombre === "fac") mostrarFacciones();
    }

    tabs.forEach(tab => tab.addEventListener("click", () => activarPestana(tab.dataset.tab)));
    activarPestana("base");
});

// ============================================
// GUARDADO GLOBAL
// ============================================

function descargarArchivo(nombre, contenido, tipo = "text/plain;charset=utf-8") {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function construirBaseActual() {
    const produccion = combinarProduccion(calcularProduccionSalas(), calcularProduccionPersonajes());
    const consumo = calcularConsumoActual();
    return {
        semana: BASE.semana ?? 1,
        habitantes: BASE.habitantes ?? 0,
        resources: { ...(BASE.resources || {}) },
        production: produccion,
        consumption: consumo,
        salas: cargarSalas(),
        personajes: cargarPersonajes(),
        facciones: cargarFacciones(),
        inventario: INVENTARIO_STATE
    };
}

function guardarTodo() {
    const estado = construirBaseActual();

    // Un único archivo JS de datos: al sustituirlo, la aplicación recupera todo.
    const contenidoJS = `// Datos de la partida SCP\n// Generado automáticamente por SCP Base Manager.\nwindow.BASE = ${JSON.stringify(estado, null, 2)};\n`;
    descargarArchivo("base.js", contenidoJS, "text/javascript;charset=utf-8");

    const status = document.getElementById("global-save-status");
    const boton = document.getElementById("save-all");
    if (status) {
        status.textContent = "✓ Todo guardado";
        status.classList.add("saved");
    }
    if (boton) {
        boton.textContent = "✓ Guardado";
        setTimeout(() => { boton.textContent = "💾 Guardar todo"; }, 1500);
    }
}

// ============================================
// INICIO
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    // Cargar salas e inventario desde el único archivo de datos.
    if (Array.isArray(BASE.salas)) {
        SALAS_STATE = JSON.parse(JSON.stringify(BASE.salas));
    }
    if (Array.isArray(BASE.personajes)) {
        PERSONAJES_STATE = JSON.parse(JSON.stringify(BASE.personajes));
    } else {
        const localPersonajes = localStorage.getItem("scp_base_characters");
        if (localPersonajes) {
            try { PERSONAJES_STATE = JSON.parse(localPersonajes); } catch (e) { PERSONAJES_STATE = []; }
        }
    }
    if (Array.isArray(BASE.facciones)) {
        FACCIONES_STATE = JSON.parse(JSON.stringify(BASE.facciones));
    } else {
        const localFacciones = localStorage.getItem("scp_base_factions");
        if (localFacciones) { try { FACCIONES_STATE = JSON.parse(localFacciones); } catch (e) { FACCIONES_STATE = []; } }
    }
    if (typeof BASE.inventario === "string") {
        INVENTARIO_STATE = BASE.inventario;
    }

    mostrarBase(BASE);
    mostrarGestionRecursos();
    mostrarSalas();
    mostrarPersonajes();
    iniciarInventario();

    const botonGuardar = document.getElementById("save-all");
    if (botonGuardar) botonGuardar.addEventListener("click", guardarTodo);
});
