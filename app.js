const API_URL = 'https://script.google.com/macros/s/AKfycbzQQ6ciE1IvS2L_wUVHKrVGSomxEOZAb8SU6MgfLBX9oia2hde2HrkCPpgHxTfP3zUO/exec';

let appState = {
    userEmail: null,
    userName: null,
    rawData: [],
    headers: []
};

window.onload = () => {
    if (localStorage.getItem('savedUser') && localStorage.getItem('savedPass')) {
        document.getElementById('log-username').value = localStorage.getItem('savedUser');
        document.getElementById('log-pass').value = localStorage.getItem('savedPass');
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
    const conf = document.getElementById('reg-pass-conf').value;
    
    const hasMayus = /[A-Z]/.test(pass);
    const hasNum = /[0-9]/.test(pass);
    const hasEsp = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const match = pass === conf && pass.length > 0;

    const setStatus = (id, isValid, text) => {
        const el = document.getElementById(id);
        el.innerHTML = isValid ? `✅ ${text}` : `❌ ${text}`;
        el.className = isValid ? 'ok' : '';
    };

    setStatus('chk-mayus', hasMayus, 'Al menos una letra mayúscula');
    setStatus('chk-num', hasNum, 'Al menos un número');
    setStatus('chk-esp', hasEsp, 'Al menos un carácter especial (!@#$%^&*)');
    setStatus('chk-match', match, 'Las contraseñas coinciden');

    document.getElementById('btn-register').disabled = !(hasMayus && hasNum && hasEsp && match);
}

async function registrarUsuario() {
    const btn = document.getElementById('btn-register');
    const msg = document.getElementById('reg-msg');
    btn.disabled = true;
    msg.innerText = "Registrando de forma segura...";

    const payload = {
        action: 'registrarUsuario',
        email: document.getElementById('reg-email').value,
        nombre: document.getElementById('reg-nombre').value,
        documento: document.getElementById('reg-doc').value,
        cargo: document.getElementById('reg-cargo').value,
        password: document.getElementById('reg-pass').value
    };

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
        const json = await res.json();
        
        if(json.status === 'success') {
            alert(`Registro exitoso. Tu nombre de usuario generado es: ${json.data.username}`);
            toggleAuth('login');
        } else { throw new Error(json.message); }
    } catch (error) {
        msg.style.color = "var(--error)";
        msg.innerText = error.message;
    } finally { btn.disabled = false; }
}

async function iniciarSesion() {
    const username = document.getElementById('log-username').value.trim().toUpperCase();
    const pass = document.getElementById('log-pass').value;
    const remember = document.getElementById('remember-me').checked;
    const msg = document.getElementById('login-msg');

    msg.style.color = "var(--text)";
    msg.innerText = "Validando credenciales...";
    
    try {
        const payload = { action: 'loginSeguro', username: username, password: pass };
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
        const json = await res.json();

        if(json.status === 'success') {
            appState.userEmail = json.data.email; 
            appState.userName = json.data.username;
            
            if(remember) {
                localStorage.setItem('savedUser', username);
                localStorage.setItem('savedPass', pass);
            } else {
                localStorage.removeItem('savedUser');
                localStorage.removeItem('savedPass');
            }
            
            document.getElementById('display-user').innerText = `Usuario Activo: ${appState.userName}`;
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('user-info').classList.remove('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            
            cargarDatos();
        } else { throw new Error(json.message); }
    } catch (error) {
        msg.style.color = "var(--error)";
        msg.innerText = error.message;
    }
}

function cerrarSesion() {
    appState.userEmail = null;
    appState.userName = null;
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('login-msg').innerText = '';
    document.getElementById('log-pass').value = '';
    
    // Limpiar tabla al salir
    renderTabla([]);
}

async function procesarFormulario(e) {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const btn = document.getElementById('btn-upload');
    const msg = document.getElementById('upload-msg');

    btn.disabled = true;
    msg.style.color = "var(--text)";
    msg.innerText = "Convirtiendo archivo para transporte seguro...";

    try {
        const base64String = await fileToBase64(file);
        const rawBase64 = base64String.split(',')[1];

        msg.innerText = "Estructurando carpetas y subiendo a Drive...";

        const payload = {
            action: 'subirArchivo',
            email: appState.userEmail, 
            carpetaPadre: document.getElementById('carpeta-padre').value.trim(),
            subCarpeta: document.getElementById('sub-carpeta').value.trim(),
            anio: document.getElementById('anio-doc').value,
            temaCategoria: document.getElementById('tema-cat').value,
            fileName: file.name,
            mimeType: file.type,
            base64Data: rawBase64
        };

        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
        const json = await res.json();

        if (json.status === 'success') {
            msg.style.color = "var(--success)";
            msg.innerText = "Documento registrado y asegurado en Drive.";
            document.getElementById('upload-form').reset();
            cargarDatos(); 
        } else { throw new Error(json.message); }

    } catch (error) {
        msg.style.color = "var(--error)";
        msg.innerText = "Error: " + error.message;
    } finally { btn.disabled = false; }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function cargarDatos() {
    try {
        const payload = { action: 'getRegistros' };
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
        const json = await res.json();

        if (json.status === 'success') {
            appState.headers = json.data.headers;
            appState.rawData = json.data.filas;
            extraerCategorias(appState.rawData);
            
            // Renderizar tabla vacía al inicio
            renderTabla([]);
        }
    } catch (error) { console.error("Error cargando DB:", error); }
}

function extraerCategorias(filas) {
    const selectTema = document.getElementById('filter-tema');
    const indexTema = appState.headers.indexOf('Tema_Categoria'); 
    if (indexTema === -1) return;

    const temasUnicos = new Set(filas.map(f => f[indexTema]).filter(t => t));
    selectTema.innerHTML = '<option value="ALL">Todas las Categorías</option>';
    temasUnicos.forEach(tema => { selectTema.innerHTML += `<option value="${tema}">${tema}</option>`; });
}

function renderTabla(filas) {
    const theadDOM = document.querySelector('#data-table thead');
    const tbodyDOM = document.querySelector('#data-table tbody');

    if (filas.length === 0) {
        theadDOM.innerHTML = '';
        tbodyDOM.innerHTML = '';
        return;
    }

    theadDOM.innerHTML = '<tr>' + appState.headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    tbodyDOM.innerHTML = filas.map(fila => {
        return '<tr>' + fila.map(celda => {
            if (typeof celda === 'string' && celda.startsWith('http')) {
                return `<td><a href="${celda}" target="_blank">Ver</a></td>`;
            }
            return `<td>${celda}</td>`;
        }).join('') + '</tr>';
    }).join('');
}

function aplicarFiltros() {
    const searchText = document.getElementById('search-text').value.toLowerCase().trim();
    const filterTema = document.getElementById('filter-tema').value;
    const indexTema = appState.headers.indexOf('Tema_Categoria');

    // Ocultar datos si no hay búsqueda
    if (searchText === '') {
        renderTabla([]);
        return;
    }

    const filtradas = appState.rawData.filter(fila => {
        const matchText = fila.some(celda => String(celda).toLowerCase().includes(searchText));
        const matchTema = filterTema === 'ALL' || (indexTema !== -1 && String(fila[indexTema]) === filterTema);
        return matchText && matchTema;
    });

    renderTabla(filtradas);
}
