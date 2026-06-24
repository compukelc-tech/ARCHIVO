const API_URL = 'https://script.google.com/macros/s/AKfycbzQQ6ciE1IvS2L_wUVHKrVGSomxEOZAb8SU6MgfLBX9oia2hde2HrkCPpgHxTfP3zUO/exec';
let userEmail = null;
let userName = null;
let rawData = [];
let headers = [];

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
    const email = prompt("Ingresa tu correo electrónico registrado en COMPUKELC:");
    
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
}

async function procesarFormulario(e) {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    if (fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const btn = document.getElementById('btn-upload');
    const msg = document.getElementById('upload-msg');

    btn.disabled = true;
    msg.style.color = "var(--text-color)";
    msg.textContent = "Preparando archivo...";

    try {
        const base64Data = await fileToBase64(file);
        msg.textContent = "Subiendo al servidor...";
        
        const payload = {
            action: 'subirArchivo',
            email: userEmail,
            carpetaPadre: document.getElementById('carpeta-padre').value,
            subCarpeta: document.getElementById('sub-carpeta').value,
            anio: document.getElementById('anio-doc').value,
            temaCategoria: document.getElementById('tema-cat').value,
            fileName: file.name,
            mimeType: file.type,
            fileData: base64Data.split(',')[1]
        };

        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await response.json();

        if (json.status === 'success') {
            msg.style.color = "var(--success-color)";
            msg.textContent = "Documento registrado y asegurado.";
            document.getElementById('upload-form').reset();
            cargarDatos();
        } else { throw new Error(json.message); }
    } catch (error) {
        msg.style.color = "var(--error-color)";
        msg.textContent = "Error: " + error.message;
    } finally {
        btn.disabled = false;
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

async function cargarDatos() {
    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getRegistros' }) });
        const json = await response.json();
        if (json.status === 'success') {
            headers = json.data.headers;
            rawData = json.data.filas;
            extraerCategorias(rawData);
            // IMPORTANTE: Arrancamos renderizando un array vacío para ocultar los datos iniciales
            renderTabla([]);
        }
    } catch (error) { console.error("Error cargando DB:", error); }
}

function extraerCategorias(filas) {
    const select = document.getElementById('filter-tema');
    // Índice 3 corresponde estáticamente a "Tema_Categoria" según nuestra nueva estructura
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
    
    // Si no han escrito nada y el filtro está en ALL, se vuelve a esconder todo
    if (texto === '' && temaFiltro === 'ALL') {
        renderTabla([]);
        return;
    }

    const idxTema = 3; // Índice fijo de Tema_Categoria

    const filasFiltradas = rawData.filter(fila => {
        const coincideTexto = texto === '' ? true : fila.some(celda => String(celda).toLowerCase().includes(texto));
        const coincideTema = temaFiltro === 'ALL' || String(fila[idxTema]) === temaFiltro;
        return coincideTexto && coincideTema;
    });
    
    renderTabla(filasFiltradas);
}

// PANEL DE ADMINISTRACIÓN

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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay solicitudes pendientes</td></tr>';
        return;
    }
    usuarios.forEach(usr => {
        tbody.innerHTML += `<tr>
            <td>${usr.nombre}</td><td><strong>${usr.username}</strong></td><td>${usr.cargo}</td>
            <td>
                <button class="btn-action btn-approve" onclick="ejecutarAccionUsuario('${usr.username}', 'Activo')">Activar</button>
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

async function ejecutarAccionUsuario(targetUsername, nuevoEstado) {
    if (!confirm(`¿Estás seguro de marcar al usuario ${targetUsername} como ${nuevoEstado}?`)) return;
    const adminUser = localStorage.getItem('savedUser');
    
    try {
        const payload = { action: 'adminGestionUsuario', adminUser: adminUser, targetUser: targetUsername, nuevoEstado: nuevoEstado };
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await response.json();

        if(json.status === 'success') { cargarUsuariosAdmin(); } 
        else { alert("Error: " + json.message); }
    } catch (error) { alert("Error de red al ejecutar acción."); }
}
