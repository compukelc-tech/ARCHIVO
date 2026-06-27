const API_URL = 'https://script.google.com/macros/s/AKfycbzQQ6ciE1IvS2L_wUVHKrVGSomxEOZAb8SU6MgfLBX9oia2hde2HrkCPpgHxTfP3zUO/exec';
let userEmail = null;
let userName = null;
let rawData = [];
let headers = [];

// Variables globales para el escáner multipágina
let streamGlobal = null;
let pdfDocument = null; 
let paginasEscaneadas = 0;

window.onload = () => {
    if (localStorage.getItem('savedUser')) {
        document.getElementById('log-username').value = localStorage.getItem('savedUser');
        document.getElementById('remember-me').checked = true;
    }
};

function toggleAuth(type) {
    document.getElementById('login-box').classList.toggle('hidden', type !== 'login');
    document.getElementById('register-box').classList.toggle('hidden', type !== 'register');
    document.getElementById('tab-login').classList.toggle('active', type === 'login');
    document.getElementById('tab-register').classList.toggle('active', type === 'register');
}

function togglePass(id) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function validarChecklist() {
    const pass = document.getElementById('reg-pass').value;
    const passConf = document.getElementById('reg-pass-conf').value;
    
    const rules = {
        'chk-mayus': /[A-Z]/.test(pass),
        'chk-num': /[0-9]/.test(pass),
        'chk-esp': /[!@#$%^&*(),.?":{}|<>]/.test(pass),
        'chk-match': pass !== '' && pass === passConf
    };

    let allValid = true;
    for (const [id, isValid] of Object.entries(rules)) {
        const el = document.getElementById(id);
        if (isValid) { el.classList.add('ok'); } 
        else { el.classList.remove('ok'); allValid = false; }
    }
    document.getElementById('btn-register').disabled = !allValid;
}

async function registrarUsuario() {
    const btn = document.getElementById('btn-register');
    const msg = document.getElementById('reg-msg');
    btn.disabled = true;
    msg.style.color = "var(--text-color)";
    msg.textContent = "Registrando de forma segura...";

    const payload = {
        action: 'registrarUsuario',
        email: document.getElementById('reg-email').value,
        nombre: document.getElementById('reg-nombre').value,
        documento: document.getElementById('reg-doc').value,
        cargo: document.getElementById('reg-cargo').value,
        password: document.getElementById('reg-pass').value
    };

    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await response.json();

        if (json.status === 'success') {
            msg.style.color = "var(--success-color)";
            msg.textContent = `Registro exitoso. Tu usuario es: ${json.data.username}. Pendiente de aprobación.`;
            setTimeout(() => toggleAuth('login'), 3000);
        } else { throw new Error(json.message); }
    } catch (error) {
        msg.style.color = "var(--error-color)";
        msg.textContent = "Error: " + error.message;
    } finally {
        btn.disabled = false;
    }
}

async function iniciarSesion() {
    const username = document.getElementById('log-username').value.toUpperCase();
    const password = document.getElementById('log-pass').value;
    const msgLabel = document.getElementById('login-msg');

    msgLabel.style.color = "var(--text-color)";
    msgLabel.textContent = "Validando credenciales...";

    try {
        const payload = { action: 'loginSeguro', username: username, password: password };
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await response.json();

        if (json.status === 'success') {
            if (document.getElementById('remember-me').checked) {
                localStorage.setItem('savedUser', username);
            } else {
                localStorage.removeItem('savedUser');
            }
            localStorage.setItem('userRole', json.data.rol);
            userEmail = json.data.email;
            userName = json.data.nombre;

            document.getElementById('display-user').textContent = `Usuario: ${userName}`;
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('user-info').classList.remove('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');

            if(json.data.rol === 'Superadmin') {
                document.getElementById('btn-admin-panel').classList.remove('hidden');
            }
            cargarDatos();
        } else { throw new Error(json.message); }
    } catch (error) {
        msgLabel.style.color = "var(--error-color)";
        msgLabel.textContent = "Error: " + error.message;
    }
}

async function enviarRecuperacion() {
    const email = prompt("Ingresa tu correo electrónico registrado:");
    if(!email) return;

    try {
        const payload = { action: 'recuperarPassword', email: email }; 
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await response.json();

        if(json.status === 'success') {
            alert("Si el correo existe en el sistema, te hemos enviado tus credenciales de acceso.");
        } else { 
            alert("Error: " + json.message); 
        }
    } catch (err) { 
        alert("Error de red al intentar recuperar."); 
    }
}

function cerrarSesion() {
    userEmail = null; userName = null;
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('btn-admin-panel').classList.add('hidden');
    document.getElementById('login-msg').textContent = '';
    document.getElementById('log-pass').value = '';
    localStorage.removeItem('userRole');
    detenerCamara(); 
}

/* ====== VALIDACIÓN COMPARTIDA DE METADATOS ====== */
function obtenerMetadatosFormulario() {
    const carpeta = document.getElementById('carpeta-padre').value.trim();
    const subCarpeta = document.getElementById('sub-carpeta').value.trim();
    const anio = document.getElementById('anio-doc').value.trim();
    const tema = document.getElementById('tema-cat').value.trim();

    if (!carpeta || !subCarpeta || !anio || !tema) {
        throw new Error("Por favor, llena los 4 campos de 'Atributos del Documento' antes de subir.");
    }
    return { carpeta, subCarpeta, anio, tema };
}

function mostrarMensajeSubida(tipo, texto) {
    const container = document.getElementById('upload-msg-container');
    const msg = document.getElementById('upload-msg');
    container.style.display = 'block';
    
    if (tipo === 'exito') {
        container.style.backgroundColor = '#dcfce7';
        msg.style.color = 'var(--success-color)';
    } else if (tipo === 'error') {
        container.style.backgroundColor = '#fee2e2';
        msg.style.color = 'var(--error-color)';
    } else {
        container.style.backgroundColor = '#f1f5f9';
        msg.style.color = 'var(--text-color)';
    }
    msg.textContent = texto;
}

/* ====== LÓGICA DE SUBIDA LOCAL (OPCIÓN A) ====== */
async function procesarSubidaLocal() {
    try {
        const meta = obtenerMetadatosFormulario();
        const fileInput = document.getElementById('file-input');
        
        if (fileInput.files.length === 0) {
            throw new Error("Selecciona un archivo desde tu dispositivo.");
        }

        const file = fileInput.files[0];
        const btn = document.getElementById('btn-upload-local');
        btn.disabled = true;
        mostrarMensajeSubida('info', "Preparando y subiendo archivo local...");

        const base64Data = await fileToBase64(file);
        
        const payload = {
            action: 'subirArchivo',
            email: userEmail,
            carpetaPadre: meta.carpeta,
            subCarpeta: meta.subCarpeta,
            anio: meta.anio,
            temaCategoria: meta.tema,
            fileName: file.name,
            mimeType: file.type,
            fileData: base64Data.split(',')[1]
        };

        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await response.json();

        if (json.status === 'success') {
            mostrarMensajeSubida('exito', "¡Archivo local guardado exitosamente en la Base de Datos!");
            fileInput.value = ""; // Limpiar input
            cargarDatos();
        } else { throw new Error(json.message); }
    } catch (error) {
        mostrarMensajeSubida('error', "Error: " + error.message);
    } finally {
        document.getElementById('btn-upload-local').disabled = false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/* ====== LÓGICA DEL ESCÁNER MÓVIL (OPCIÓN B) ====== */
async function iniciarCamara() {
    document.getElementById('scanner-container').classList.remove('hidden');
    const video = document.getElementById('video-preview');
    
    // Reiniciar valores multipágina
    pdfDocument = null;
    paginasEscaneadas = 0;
    document.getElementById('page-count').textContent = paginasEscaneadas;
    document.getElementById('upload-msg-container').style.display = 'none';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        streamGlobal = stream;
    } catch (err) {
        alert("Error al acceder a la cámara. Revisa permisos: " + err.message);
    }
}

function detenerCamara() {
    if (streamGlobal) {
        streamGlobal.getTracks().forEach(track => track.stop());
    }
    document.getElementById('scanner-container').classList.add('hidden');
    pdfDocument = null;
    paginasEscaneadas = 0;
}

function capturarPagina() {
    if (!streamGlobal) return;
    
    const video = document.getElementById('video-preview');
    const canvas = document.getElementById('canvas-capture');
    
    // COMPRESIÓN: Limitar resolución máxima
    const MAX_WIDTH = 1200; 
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    if (width > MAX_WIDTH) {
        height = Math.floor(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);
    
    // COMPRESIÓN: Formato JPEG con calidad al 50%
    const imageData = canvas.toDataURL('image/jpeg', 0.5); 
    
    const { jsPDF } = window.jspdf;
    const orientacion = width > height ? 'l' : 'p'; 

    if (paginasEscaneadas === 0) {
        pdfDocument = new jsPDF(orientacion, 'px', [width, height]);
        pdfDocument.addImage(imageData, 'JPEG', 0, 0, width, height);
    } else {
        pdfDocument.addPage([width, height], orientacion);
        pdfDocument.addImage(imageData, 'JPEG', 0, 0, width, height);
    }

    paginasEscaneadas++;
    document.getElementById('page-count').textContent = paginasEscaneadas;
}

async function subirPDFMultiPagina() {
    try {
        const meta = obtenerMetadatosFormulario();
        
        if (paginasEscaneadas === 0 || !pdfDocument) {
            throw new Error("No has capturado ninguna página aún. Usa 'Capturar Hoja'.");
        }

        const btn = document.getElementById('btn-upload-pdf');
        btn.disabled = true;
        mostrarMensajeSubida('info', "Generando PDF y subiendo a la nube...");

        const pdfBase64 = pdfDocument.output('datauristring');
        const base64Puro = pdfBase64.split(',')[1];
        const fileName = `Documento_Escaneado_${new Date().getTime()}.pdf`;

        const payload = {
            action: 'subirArchivo',
            email: userEmail,
            carpetaPadre: meta.carpeta,
            subCarpeta: meta.subCarpeta,
            anio: meta.anio,
            temaCategoria: meta.tema,
            fileName: fileName,
            mimeType: 'application/pdf',
            fileData: base64Puro
        };

        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await response.json();

        if (json.status === 'success') {
            mostrarMensajeSubida('exito', `¡PDF de ${paginasEscaneadas} hojas guardado exitosamente!`);
            cargarDatos();
            setTimeout(detenerCamara, 3000);
        } else {
            throw new Error(json.message);
        }
    } catch (error) {
        mostrarMensajeSubida('error', "Error: " + error.message);
    } finally {
        document.getElementById('btn-upload-pdf').disabled = false;
    }
}

async function cargarDatos() {
    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getRegistros' }) });
        const json = await response.json();
        if (json.status === 'success') {
            headers = json.data.headers;
            rawData = json.data.filas;
            extraerCategorias(rawData);
            renderTabla([]);
        }
    } catch (error) { console.error("Error cargando DB:", error); }
}

function extraerCategorias(filas) {
    const select = document.getElementById('filter-tema');
    const idx = 3; 

    const temas = new Set(filas.map(f => f[idx]));
    select.innerHTML = '<option value="ALL">Filtro por Categoría</option>';
    temas.forEach(tema => {
        if(tema) select.innerHTML += `<option value="${tema}">${tema}</option>`;
    });
}

function renderTabla(filas) {
    const thead = document.querySelector('#data-table thead');
    const tbody = document.querySelector('#data-table tbody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    if (headers.length === 0) return;

    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    
    if(filas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${headers.length}" style="text-align: center; color: gray;">Use la barra de búsqueda o el filtro para encontrar documentos.</td></tr>`;
        return;
    }
    
    filas.forEach(fila => {
        const tr = document.createElement('tr');
        tr.innerHTML = fila.map(celda => {
            if (typeof celda === 'string' && celda.startsWith('http')) {
                return `<td><a href="${celda}" target="_blank" style="color: blue; text-decoration: underline;">Abrir Archivo</a></td>`;
            }
            return `<td>${celda}</td>`;
        }).join('');
        tbody.appendChild(tr);
    });
}

function aplicarFiltros() {
    const texto = document.getElementById('search-text').value.toLowerCase();
    const temaFiltro = document.getElementById('filter-tema').value;
    
    if (texto === '' && temaFiltro === 'ALL') {
        renderTabla([]);
        return;
    }

    const idxTema = 3; 

    const filasFiltradas = rawData.filter(fila => {
        const coincideTexto = texto === '' ? true : fila.some(celda => String(celda).toLowerCase().includes(texto));
        const coincideTema = temaFiltro === 'ALL' || String(fila[idxTema]) === temaFiltro;
        return coincideTexto && coincideTema;
    });
    
    renderTabla(filasFiltradas);
}

function abrirPanelAdmin() {
    document.getElementById('admin-modal').classList.remove('hidden');
    cargarUsuariosAdmin();
}

function cerrarPanelAdmin() {
    document.getElementById('admin-modal').classList.add('hidden');
}

async function cargarUsuariosAdmin() {
    const adminUser = localStorage.getItem('savedUser');
    if (!adminUser) return;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUsuariosAdmin', adminUser: adminUser })
        });
        
        const json = await response.json();
        
        if (json.status === 'success') {
            renderTablaPendientes(json.data.pendientes);
            renderTablaGestionados(json.data.gestionados);
        } else { alert("Error al cargar panel: " + json.message); }
    } catch (error) { console.error("Error de conexión:", error); }
}

function renderTablaPendientes(usuarios) {
    const tbody = document.querySelector('#table-pendientes tbody');
    tbody.innerHTML = '';
    if(usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay solicitudes pendientes</td></tr>';
        return;
    }
    usuarios.forEach(usr => {
        tbody.innerHTML += `<tr>
            <td>${usr.nombre}</td>
            <td><strong>${usr.username}</strong></td>
            <td>${usr.cargo}</td>
            <td>
                <select id="rol-${usr.username}">
                    <option value="Usuario Estándar">Usuario Estándar</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Superadmin">Superadmin</option>
                </select>
            </td>
            <td>
                <button class="btn-action btn-approve" onclick="aprobarUsuarioConRol('${usr.username}')">Activar</button>
                <button class="btn-action btn-deny" onclick="ejecutarAccionUsuario('${usr.username}', 'Denegado')">Denegar</button>
            </td></tr>`;
    });
}

function renderTablaGestionados(usuarios) {
    const tbody = document.querySelector('#table-gestionados tbody');
    tbody.innerHTML = '';
    if(usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay usuarios activos gestionados</td></tr>';
        return;
    }
    usuarios.forEach(usr => {
        tbody.innerHTML += `<tr>
            <td>${usr.nombre}</td><td><strong>${usr.username}</strong></td><td>${usr.estado}</td>
            <td>
                <button class="btn-action btn-pause" onclick="ejecutarAccionUsuario('${usr.username}', 'Pausado')">Pausar</button>
                <button class="btn-action btn-block" onclick="ejecutarAccionUsuario('${usr.username}', 'Bloqueado')">Bloquear</button>
                <button class="btn-action btn-deny" onclick="ejecutarAccionUsuario('${usr.username}', 'Eliminado')">Eliminar</button>
                ${usr.estado !== 'Activo' ? `<button class="btn-action btn-approve" onclick="ejecutarAccionUsuario('${usr.username}', 'Activo')">Reactivar</button>` : ''}
            </td></tr>`;
    });
}

function aprobarUsuarioConRol(targetUsername) {
    const selectElement = document.getElementById(`rol-${targetUsername}`);
    const nuevoRol = selectElement.value;
    ejecutarAccionUsuario(targetUsername, 'Activo', nuevoRol);
}

async function ejecutarAccionUsuario(targetUsername, nuevoEstado, nuevoRol = null) {
    if (!confirm(`¿Estás seguro de marcar al usuario ${targetUsername} como ${nuevoEstado}?`)) return;
    const adminUser = localStorage.getItem('savedUser');
    
    try {
        const payload = { 
            action: 'adminGestionUsuario', 
            adminUser: adminUser, 
            targetUser: targetUsername, 
            nuevoEstado: nuevoEstado,
            nuevoRol: nuevoRol 
        };
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await response.json();

        if(json.status === 'success') { cargarUsuariosAdmin(); } 
        else { alert("Error: " + json.message); }
    } catch (error) { alert("Error de red al ejecutar acción."); }
}

// ==========================================
// Registro del Service Worker para PWA
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('ServiceWorker registrado con éxito con el alcance: ', registration.scope);
      })
      .catch(err => {
        console.warn('El registro del ServiceWorker ha fallado: ', err);
      });
  });
}
