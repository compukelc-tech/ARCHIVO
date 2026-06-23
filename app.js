// Constante con tu URL de Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbzQQ6ciE1IvS2L_wUVHKrVGSomxEOZAb8SU6MgfLBX9oia2hde2HrkCPpgHxTfP3zUO/exec';

// Estado global de la aplicación
let appState = {
    userEmail: null,
    userRole: null,
    rawData: [], // Datos crudos desde GAS
    headers: []
};

/**
 * 1. Autenticación y Validación de Sesión
 */
async function iniciarSesion() {
    const email = document.getElementById('email-input').value.trim();
    if (!email) return alert("Ingrese un correo.");

    document.getElementById('login-msg').innerText = "Validando credenciales...";
    document.getElementById('btn-login').disabled = true;

    try {
        const payload = { action: 'validarSesion', userEmail: email };
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            redirect: 'follow'
        });
        const json = await res.json();

        if (json.status === 'success') {
            appState.userEmail = json.data.email;
            appState.userRole = json.data.rol;
            
            // Actualizar UI
            document.getElementById('display-email').innerText = appState.userEmail;
            document.getElementById('display-role').innerText = appState.userRole;
            
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            document.getElementById('user-info').classList.remove('hidden');

            cargarDatos(); // Traer los registros al iniciar sesión
        } else {
            throw new Error(json.message);
        }
    } catch (error) {
        document.getElementById('login-msg').innerText = error.message;
        document.getElementById('btn-login').disabled = false;
    }
}

function cerrarSesion() {
    appState.userEmail = null;
    appState.userRole = null;
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('email-input').value = '';
    document.getElementById('login-msg').innerText = '';
    document.getElementById('btn-login').disabled = false;
}

/**
 * 2. Carga de Datos y Renderizado
 */
async function cargarDatos() {
    try {
        const payload = { action: 'getRegistros', userEmail: appState.userEmail };
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            redirect: 'follow'
        });
        const json = await res.json();

        if (json.status === 'success') {
            appState.headers = json.data.headers;
            appState.rawData = json.data.filas;
            extraerCategorias(appState.rawData);
            renderTabla(appState.rawData);
        }
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

function extraerCategorias(filas) {
    const selectTema = document.getElementById('filter-tema');
    // Asumiendo que el Tema/Categoría está en algún índice (ajustar según tu Sheet)
    // Para este ejemplo, lo dejaremos genérico o asumiremos el índice 3
    const indexTema = appState.headers.indexOf('Tema_Categoria'); 
    if (indexTema === -1) return;

    const temasUnicos = new Set(filas.map(f => f[indexTema]).filter(t => t));
    
    // Limpiar y rellenar opciones
    selectTema.innerHTML = '<option value="ALL">Todas las Categorías</option>';
    temasUnicos.forEach(tema => {
        selectTema.innerHTML += `<option value="${tema}">${tema}</option>`;
    });
}

function renderTabla(filas) {
    const thead = document.querySelector('#data-table and thead'); // Corrección selector
    const theadDOM = document.getElementById('data-table').querySelector('thead');
    const tbodyDOM = document.getElementById('data-table').querySelector('tbody');

    // Render Headers
    theadDOM.innerHTML = '<tr>' + appState.headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

    // Render Rows
    tbodyDOM.innerHTML = filas.map(fila => {
        return '<tr>' + fila.map(celda => {
            // Si la celda parece una URL, hacerla clickeable
            if (typeof celda === 'string' && celda.startsWith('http')) {
                return `<td><a href="${celda}" target="_blank">Ver Enlace</a></td>`;
            }
            return `<td>${celda}</td>`;
        }).join('') + '</tr>';
    }).join('');
}

/**
 * 3. Búsqueda y Filtros Cruzados (Inteligentes en Front-End)
 */
function aplicarFiltros() {
    const searchText = document.getElementById('search-text').value.toLowerCase();
    const filterYear = document.getElementById('filter-year').value;
    const filterTema = document.getElementById('filter-tema').value;

    const indexAnio = appState.headers.indexOf('Año');
    const indexTema = appState.headers.indexOf('Tema_Categoria');

    const filasFiltradas = appState.rawData.filter(fila => {
        // 1. Filtro Full-Text (Busca coincidencia en cualquier columna de texto)
        const coincideTexto = searchText === '' || fila.some(celda => 
            String(celda).toLowerCase().includes(searchText)
        );

        // 2. Filtro Año
        const coincideAnio = filterYear === 'ALL' || (indexAnio !== -1 && String(fila[indexAnio]) === filterYear);

        // 3. Filtro Tema
        const coincideTema = filterTema === 'ALL' || (indexTema !== -1 && String(fila[indexTema]) === filterTema);

        return coincideTexto && coincideAnio && coincideTema;
    });

    renderTabla(filasFiltradas);
}

/**
 * 4. Subida de Archivos y Conversión a Base64
 */
async function procesarFormulario(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const nombreAsignado = document.getElementById('nombre-asignado').value;
    const anio = document.getElementById('anio-doc').value;
    const tema = document.getElementById('tema-cat').value;
    const btn = document.getElementById('btn-upload');
    const msg = document.getElementById('upload-msg');

    btn.disabled = true;
    msg.innerText = "Convirtiendo archivo...";

    try {
        // Convertir a Base64
        const base64String = await fileToBase64(file);
        
        // Extraer solo la parte de datos crudos descartando el encabezado (data:MIME;base64,)
        const rawBase64 = base64String.split(',')[1];

        // Opcional: Crear la carpeta primero si es necesario
        // Aquí pasaremos la subida directamente asumiendo la función en GAS
        msg.innerText = "Subiendo archivo a Drive...";

        const payload = {
            action: 'subirArchivo',
            userEmail: appState.userEmail,
            fileName: `${nombreAsignado} - ${file.name}`,
            mimeType: file.type,
            base64Data: rawBase64,
            anio: anio,
            temaCategoria: tema
        };

        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            redirect: 'follow'
        });
        const json = await res.json();

        if (json.status === 'success') {
            msg.style.color = "green";
            msg.innerText = "Archivo registrado correctamente.";
            document.getElementById('upload-form').reset();
            cargarDatos(); // Refrescar la tabla
        } else {
            throw new Error(json.message);
        }

    } catch (error) {
        msg.style.color = "red";
        msg.innerText = "Error: " + error.message;
    } finally {
        btn.disabled = false;
    }
}

// Utilidad para leer archivos asíncronamente
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
