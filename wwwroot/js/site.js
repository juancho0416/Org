// Inyectar el motor de físicas líquidas al DOM
if (!document.getElementById('liquid-filter-svg')) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "liquid-filter-svg";
    svg.style.display = "none";
    svg.innerHTML = `
        <defs>
            <filter id="liquid-fusion">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10" result="liquid" />
                <feComposite in="SourceGraphic" in2="liquid" operator="atop"/>
            </filter>
        </defs>`;
    document.body.appendChild(svg);
}
const CONFIG = {
    CHIEF_ID_FIELD: 'jefeId', 
    API_URL: '/api/empleado/todos', 
};
const AREA_COLORS = (function () {
    const arr = [];
    const css = getComputedStyle(document.documentElement);
    
    // Buscamos hasta 12 colores posibles en el CSS
   // En tu site.js, dentro de la función AREA_COLORS:
for (let i = 0; i < 10; i++) { // Cambiado de 6 a 10
    const p = css.getPropertyValue(`--area-color-${i}-primary`).trim();
    const s = css.getPropertyValue(`--area-color-${i}-secondary`).trim();
    if (p) arr.push({ primary: p, secondary: s || '#EEF0FA' });
}
    
    // Si no hay colores en CSS, paleta de emergencia variada
    return arr.length ? arr : [
        { primary: '#5A67D8', secondary: '#EEF0FA' }, // Azul
        { primary: '#38A169', secondary: '#F0FFF4' }, // Verde
        { primary: '#E53E3E', secondary: '#FFF5F5' }, // Rojo
        { primary: '#DD6B20', secondary: '#FFFAF0' }, // Naranja
        { primary: '#805AD5', secondary: '#FAF5FF' }, // Morado
        { primary: '#3182CE', secondary: '#EBF8FF' }  // Celeste
    ];
})();

let areaColorMap = new Map();
let colorIndex = 0;

window.datos = []; 
window.porId = new Map();
window.raiz = null;
window.areaDirectors = new Map(); 
let currentViewMode = 'grid'; 

let rootElModular, listContainer, chiefContainer; 

// --- Helpers de UI ---
// Variable global para recordar qué color le dimos a cada área
const assignedColors = new Map();

function getAreaColors(areaName) {
    const name = areaName?.toString().trim().toUpperCase() || 'DEFAULT';
    
    // 1. Si ya le asignamos un color en esta sesión, devolverlo
    if (assignedColors.has(name)) return assignedColors.get(name);

    // 2. Intentar leer de la paleta window (si existe)
    try {
        if (window.AREA_PALETTE && window.AREA_PALETTE[name]) {
            return window.AREA_PALETTE[name];
        }
    } catch (e) {}

    // 3. Lógica de asignación mejorada
    // Usamos un hash un poco más complejo para evitar colisiones simples
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i);
        hash |= 0; // Convertir a 32bit integer
    }
    
    // Usamos el índice basado en la cantidad de colores disponibles
    const idx = Math.abs(hash) % AREA_COLORS.length;
    const color = AREA_COLORS[idx];
    
    // Guardar para que no cambie y retornar
    assignedColors.set(name, color);
    return color;
}
function getNodeValue(node, prop, defaultText = 'N/A') {
    const value = node?.[prop];
    return (value !== null && value !== undefined && value.toString().trim() !== '') 
            ? value.toString().trim() 
            : defaultText;
}

function el(tag, className, text){
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
}

function getInitials(nombre) {
    if (!nombre) return '?';
    const parts = nombre.split(/\s+/).filter(p => p.length > 0);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : nombre[0].toUpperCase();
}
function createProfilePicture(node, colors) {
    const imageUrl = getNodeValue(node, 'imagenURL', null); 
    const nombre = getNodeValue(node, 'nombre');
    const imageContainer = el('div', 'profile-pic-container');
    imageContainer.style.setProperty('--profile-border-color', colors.primary);

    if (imageUrl && imageUrl !== 'N/A') {
        const img = el('img', 'profile-pic');
        img.src = imageUrl;
        img.loading = "lazy";
        img.onerror = function() {
            this.remove(); 
            imageContainer.classList.add('has-initials');
            imageContainer.textContent = getInitials(nombre);
        };
        imageContainer.appendChild(img);
    } else {
        imageContainer.classList.add('has-initials');
        imageContainer.textContent = getInitials(nombre);
        imageContainer.style.backgroundColor = colors.secondary;
        imageContainer.style.color = colors.primary;
    }
    return imageContainer;
}

// --- NUEVA MEJORA: REDIRECCIÓN A PÁGINA .NET ---
function irAlPerfil(id) {
    // Redirige a la página física de Razor pasando el ID por parámetro
    window.location.href = `/Ventanaperfil?id=${id}`;
}

// --- BÚSQUEDA ACTUALIZADA ---
function performSearch() {
    const searchInput = document.getElementById('employee-search-input');
    const searchStatus = document.getElementById('search-status');
    const query = searchInput.value.trim().toLowerCase();
    
    if (query.length < 3) {
        if (searchStatus) searchStatus.textContent = "Mínimo 3 letras.";
        return;
    }

    const found = Array.from(window.porId.values()).find(
        emp => getNodeValue(emp, 'nombre').toLowerCase().includes(query) || 
               getNodeValue(emp, 'puesto').toLowerCase().includes(query)
    );

    if (found) {
        if (searchStatus) searchStatus.textContent = "";
        searchInput.value = '';
        irAlPerfil(found.id); // Salta a la nueva página
    } else {
        if (searchStatus) searchStatus.textContent = "No encontrado.";
    }
}

// --- RENDERS DEL ORGANIGRAMA ---

function renderChiefModule(chiefNode) { 
    chiefContainer.innerHTML = '';
    const colors = getAreaColors(getNodeValue(chiefNode, 'area')); 
    
    const wrapper = el('div', 'chief-wrapper');
    const card = el('div', 'chief-card-premium');
    card.style.borderTop = `5px solid ${colors.primary}`;
    
    // Badge de "Líder"
    const badge = el('span', 'leader-badge', 'Responsable de Equipo');
    badge.style.backgroundColor = colors.secondary;
    badge.style.color = colors.primary;

    const cardContent = el('div', 'chief-card-content');
    cardContent.onclick = () => irAlPerfil(chiefNode.id);

    cardContent.append(createProfilePicture(chiefNode, colors));
    
    const info = el('div', 'chief-info');
    info.innerHTML = `
        <span class="area-label" style="color:${colors.primary}">${getNodeValue(chiefNode, 'area')}</span>
        <h3>${getNodeValue(chiefNode, 'nombre')}</h3>
        <p>${getNodeValue(chiefNode, 'puesto')}</p>
    `;
    
    cardContent.appendChild(info);
    card.append(badge, cardContent); 

    if (chiefNode.jefe) {
        const btn = el('button', 'btn-up-modern', `↑ Subir a ${chiefNode.jefe.nombre}`);
        btn.onclick = (e) => { 
            e.stopPropagation(); 
            window.renderOrgView(chiefNode.jefe.id); 
        };
        wrapper.appendChild(btn);
    }
    
    wrapper.appendChild(card);
    chiefContainer.appendChild(wrapper);
}


function renderNodeTree(node, colors) {
    const li = el('li', 'org-node');
    const module = el('div', 'subordinate-module diagram-view');
    
    // Clic en nodo del diagrama -> Perfil
    module.onclick = () => irAlPerfil(node.id);
    module.style.cursor = 'pointer';

    module.style.setProperty('--card-primary-color', colors.primary);
    module.append(createProfilePicture(node, colors));
    const info = el('div', 'subordinate-info', null);
    info.innerHTML = `<strong>${getNodeValue(node, 'nombre')}</strong><span>${getNodeValue(node, 'puesto')}</span>`;
    module.appendChild(info);
    li.appendChild(module);

    if (node.hijos.length > 0) {
        const ul = el('ul', 'org-children');
        node.hijos.forEach(h => ul.appendChild(renderNodeTree(h, getAreaColors(getNodeValue(h, 'area')))));
        li.appendChild(ul);
    }
    return li;
}/**
 * 1. INYECTOR DE FÍSICAS LÍQUIDAS
 * Ejecuta esto una vez al cargar tu aplicación o antes de renderizar.
 */
if (!document.getElementById('liquid-filter-svg')) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "liquid-filter-svg";
    svg.setAttribute("style", "position:absolute; width:0; height:0; pointer-events:none;");
    svg.innerHTML = `
        <defs>
            <filter id="liquid-fusion">
                <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="liquid" />
                <feComposite in="SourceGraphic" in2="liquid" operator="atop"/>
            </filter>
        </defs>`;
    document.body.appendChild(svg);
}

/**
 * 2. FUNCIÓN DE RENDERIZADO CON EFECTO LIQUID GLASS
 */
function renderSubordinateContent(chiefNode) { 
    listContainer.innerHTML = '';
    
    // Contenedores principales
    const controls = el('div', 'subordinate-controls');
    const viewSwitch = el('div', 'view-switch liquid-container'); 
    
    // La gota (blob) que se mueve entre botones
    const liquidBlob = el('div', 'view-switch-blob');
    
    // Botones con lógica de vista
    const btnGrid = el('button', `btn-view ${currentViewMode === 'grid' ? 'active' : ''}`, 'Lista');
    const btnDiag = el('button', `btn-view ${currentViewMode === 'diagram' ? 'active' : ''}`, 'Diagrama');

    // Lógica de magnetismo para los botones
    [btnGrid, btnDiag].forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            // El botón sigue al cursor ligeramente (30% de fuerza)
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = `translate(0, 0)`;
        });
    });

    btnGrid.onclick = () => { 
        currentViewMode = 'grid'; 
        window.renderOrgView(chiefNode.id); 
    };
    
    btnDiag.onclick = () => { 
        currentViewMode = 'diagram'; 
        window.renderOrgView(chiefNode.id); 
    };
    
    // Construcción del Switch: El blob va primero para quedar al fondo
    viewSwitch.append(liquidBlob, btnGrid, btnDiag);
    
    controls.append(el('h4', null, 'Estructura de Equipo'), viewSwitch);
    listContainer.appendChild(controls);

    // Lógica de contenido (Grid vs Diagrama)
    if (currentViewMode === 'diagram') {
        const treeCont = el('div', 'org-tree-container');
        const chart = el('ul', 'org-chart');
        chart.appendChild(renderNodeTree(window.raiz, getAreaColors(getNodeValue(window.raiz, 'area'))));
        treeCont.appendChild(chart);
        listContainer.appendChild(treeCont);
    } else {
        const areasContainer = el('div', 'areas-container-modern');
        
        const grupos = chiefNode.hijos.reduce((acc, emp) => {
            const a = getNodeValue(emp, 'area');
            if (!acc[a]) acc[a] = []; 
            acc[a].push(emp); 
            return acc;
        }, {});

        Object.keys(grupos).sort().forEach(area => {
            const colors = getAreaColors(area);
            const areaWrapper = el('div', 'area-bubble-wrapper liquid-area'); // Añadimos la clase liquid-area
            // Creamos un elemento "gota de expansión" para el fondo
const expansionBlob = el('div', 'expansion-blob');
expansionBlob.style.backgroundColor = colors.secondary;
            const areaHeader = el('div', 'area-bubble-header');
            areaHeader.style.borderLeft = `6px solid ${colors.primary}`;
            areaHeader.style.backgroundColor = colors.secondary;
            
            areaHeader.innerHTML = `
                <div class="area-info">
                    <div class="area-icon-pill" style="background:${colors.primary}">
                        <i class="fas fa-sitemap" style="color:white; font-size:0.8rem;"></i>
                    </div>
                    <div>
                        <h5 style="color: ${colors.primary}; margin:0; font-weight:800;">${area}</h5>
                        <span class="area-badge">${grupos[area].length} integrantes</span>
                    </div>
                </div>
                <span class="toggle-icon">▼</span>
            `;

            const collapsibleBody = el('div', 'area-collapsible-body');
            const hierarchyContainer = el('div', 'internal-hierarchy-flow');

            grupos[area].forEach(empleado => {
                hierarchyContainer.appendChild(renderHierarchicalNode(empleado, colors));
            });

            areaHeader.onclick = () => areaWrapper.classList.toggle('is-open');

            collapsibleBody.appendChild(hierarchyContainer);
            areaWrapper.append(areaHeader, collapsibleBody);
            areasContainer.appendChild(areaWrapper);
        });
        listContainer.appendChild(areasContainer);
        // Insertamos la gota de expansión al inicio del wrapper
areaWrapper.append(expansionBlob, areaHeader, collapsibleBody);
    }
}
/**
 * Función recursiva para crear la cascada jerárquica dentro de la burbuja
 */
function renderHierarchicalNode(node, colors) {
    const wrapper = el('div', 'hierarchy-node-wrapper');
    
    // La tarjeta del empleado
    const card = el('div', 'subordinate-module-modern');
    card.style.setProperty('--area-color', colors.primary);
    card.onclick = (e) => { e.stopPropagation(); irAlPerfil(node.id); };

    card.onmouseenter = (e) => showTooltip(e, node.id);
    card.onmousemove = (e) => moveTooltip(e);
    card.onmouseleave = () => hideTooltip();

    const top = el('div', 'subordinate-top-content');
    top.append(createProfilePicture(node, colors));
    
    const info = el('div', 'subordinate-info');
    info.innerHTML = `<strong>${getNodeValue(node, 'nombre')}</strong><span class="puesto-label">${getNodeValue(node, 'puesto')}</span>`;
    
    top.appendChild(info);
    card.appendChild(top);

    // Si tiene hijos, creamos el contenedor para el siguiente nivel
    if (node.hijos && node.hijos.length > 0) {
        const childrenBox = el('div', 'hierarchy-children-box');
        node.hijos.forEach(hijo => {
            childrenBox.appendChild(renderHierarchicalNode(hijo, colors));
        });
        wrapper.append(card, childrenBox);
    } else {
        wrapper.appendChild(card);
    }

    return wrapper;
}
// --- INICIALIZACIÓN Y BREADCRUMBS ---
window.renderOrgView = function(nodeId){ 
    const node = window.porId.get(nodeId);
    if (!node) return;
    
    rootElModular.innerHTML = ''; 
    rootElModular.appendChild(chiefContainer);
    renderChiefModule(node); 
    renderBreadcrumbs(node);
    
    rootElModular.appendChild(listContainer);
    renderSubordinateContent(node); 
}


function renderBreadcrumbs(node) {
    const bc = document.getElementById('org-breadcrumbs');
    if (!bc) return;
    let path = []; let curr = node;
    while(curr) { path.unshift(curr); curr = curr.jefe; }
    bc.innerHTML = '';
    path.forEach((emp, i) => {
        const item = el('span', 'breadcrumb-item');
        if (i < path.length - 1) {
            const a = el('a', 'breadcrumb-link', emp.nombre);
            a.onclick = () => window.renderOrgView(emp.id);
            item.append(a, el('span', null, ' / '));
        } else item.append(el('span', null, emp.nombre));
        bc.appendChild(item);
    });
}

function construirEstructuraDeDatos(nodosDesdeDB) {
    window.porId = new Map(nodosDesdeDB.map(d => [d.id, {...d, hijos: [], jefe: null, jefeId: d[CONFIG.CHIEF_ID_FIELD]}]));
    let raices = []; 
    window.porId.forEach(node => {
        const jefe = window.porId.get(parseInt(node.jefeId));
        if (jefe) { jefe.hijos.push(node); node.jefe = jefe; }
        else { raices.push(node); }
    });
    window.raiz = raices[0];
    mapAreasAndDirectors();
    populateAreaSelector();
    window.renderOrgView(window.raiz.id);
}

function mapAreasAndDirectors() {
    window.areaDirectors.clear();
    window.porId.forEach(node => {
        const area = getNodeValue(node, 'area');
        if (area === 'N/A') return;
        let curr = node;
        while (curr.jefe && getNodeValue(curr.jefe, 'area') === area) curr = curr.jefe;
        if (!window.areaDirectors.has(area)) window.areaDirectors.set(area, curr);
    });
}

function populateAreaSelector() {
    const selector = document.getElementById('area-selector');
    if (!selector) return;
    Array.from(window.areaDirectors.keys()).sort().forEach(area => {
        const opt = el('option', null, area);
        opt.value = window.areaDirectors.get(area).id;
        selector.appendChild(opt);
    });
    selector.onchange = (e) => { 
        if (e.target.value) { 
            currentViewMode = 'grid'; 
            window.renderOrgView(parseInt(e.target.value)); 
        }
    };
}

function obtenerDatosDesdeDB() {
    fetch(CONFIG.API_URL).then(r => r.json()).then(d => construirEstructuraDeDatos(d));
}

document.addEventListener('DOMContentLoaded', () => {
    rootElModular = document.getElementById('org-view');
    chiefContainer = el('div'); chiefContainer.id = 'current-chief-module';
    listContainer = el('div'); listContainer.id = 'subordinate-list';
    
    const searchBtn = document.getElementById('employee-search-button');
    if(searchBtn) searchBtn.onclick = performSearch;

    const searchInput = document.getElementById('employee-search-input');
    if(searchInput) searchInput.onkeypress = (e) => { if(e.key === 'Enter') performSearch(); };
    
    obtenerDatosDesdeDB();
});


const tooltip = document.getElementById('custom-tooltip');
function showTooltip(e, id) {
    const emp = window.porId.get(id);
    if (!emp) return;

    const colors = getAreaColors(getNodeValue(emp, 'area'));
    
    // Obtenemos el nombre del jefe si existe
    const nombreJefe = emp.jefe ? emp.jefe.nombre : "Dirección General";
    
    tooltip.innerHTML = `
        <div class="tooltip-content">
            <div class="profile-pic-container" style="--size: 60px; --profile-border-color: ${colors.primary}; margin-bottom: 5px;">
                ${createProfilePicture(emp, colors).innerHTML}
            </div>
            <strong>${getNodeValue(emp, 'nombre')}</strong>
            <span style="font-weight: 600; color: ${colors.primary}">${getNodeValue(emp, 'puesto')}</span>
            
            <div class="tooltip-hierarchy-info" style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px; width: 100%;">
                <div style="font-size: 0.65rem; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.5px;">Reporta a:</div>
                <div style="font-size: 0.75rem; color: #4a5568; font-weight: 500;">${nombreJefe}</div>
            </div>

            <div class="tooltip-area-tag" style="background:${colors.secondary}; color:${colors.primary}; margin-top: 10px;">
                ${getNodeValue(emp, 'area')}
            </div>
        </div>
    `;

    tooltip.style.display = 'block';
    moveTooltip(e);
}

function moveTooltip(e) {
    // Offset de 15px para que no quede justo bajo el cursor
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

/* --- COMBO DINÁMICO: INTERACCIONES --- */

document.addEventListener('DOMContentLoaded', () => {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // A. EFECTO TILT 3D Y BRILLO (optimizado con requestAnimationFrame)
    if (!prefersReduced) {
        const tiltElements = document.querySelectorAll('.chief-card-premium, .subordinate-module-modern');

        tiltElements.forEach(card => {
            let lastEvent = null;
            let ticking = false;

            function applyTilt() {
                if (!lastEvent) { ticking = false; return; }
                const e = lastEvent;
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (centerY - y) / 18; // sensibilidad ajustada
                const rotateY = (x - centerX) / 18;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
                card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
                ticking = false;
            }

            card.addEventListener('mousemove', (ev) => {
                lastEvent = ev;
                if (!ticking) {
                    ticking = true;
                    requestAnimationFrame(applyTilt);
                }
            }, { passive: true });

            card.addEventListener('mouseleave', () => {
                // Suaviza la vuelta a posición neutra
                card.style.transition = 'transform 420ms cubic-bezier(0.2,0.9,0.2,1)';
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
                // quitar la transición inline pasado el tiempo
                setTimeout(() => { card.style.transition = ''; }, 450);
            });
        });
    }

    // B. EFECTO RIPPLE (ONDA AL CLIC) - limpiar con animationend para precisión
    document.addEventListener('click', function (e) {
        const target = e.target.closest('.btn-search, .area-bubble-header, .btn-up-modern');
        if (target && !prefersReduced) {
            const ripple = document.createElement('span');
            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            ripple.classList.add('ripple');

            target.appendChild(ripple);
            // Remove when animation finishes; fallback timeout
            const cleanup = () => { if (ripple && ripple.parentNode) ripple.parentNode.removeChild(ripple); };
            ripple.addEventListener('animationend', cleanup, { once: true });
            setTimeout(cleanup, 700);
        }
    });

    // C. CASCADA DINÁMICA (Si las áreas se cargan dinámicamente, llamar esta función después de renderizar)
    const animateCascade = () => {
        const items = document.querySelectorAll('.area-bubble-wrapper');
        items.forEach((item, index) => {
            item.style.animationDelay = `${index * 0.08}s`;
        });
    };
    animateCascade();
});







/* --- MICRO-INTERACCIONES ADICIONALES --- */

// 1. Efecto Magnético en el Avatar (optimizado y respetando reduced-motion)
document.addEventListener('DOMContentLoaded', () => {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const avatars = document.querySelectorAll('.profile-pic-container');
    avatars.forEach(avatar => {
        let last = null, ticking = false;
        function apply() {
            if (!last) { ticking = false; return; }
            const e = last;
            const rect = avatar.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) / 6; // más sutil
            const y = (e.clientY - rect.top - rect.height / 2) / 6;
            avatar.style.transform = `translate(${x}px, ${y}px)`;
            ticking = false;
        }

        avatar.addEventListener('mousemove', (e) => {
            last = e;
            if (!ticking) { ticking = true; requestAnimationFrame(apply); }
        }, { passive: true });

        avatar.addEventListener('mouseleave', () => {
            avatar.style.transition = 'transform 420ms cubic-bezier(0.2,0.9,0.2,1)';
            avatar.style.transform = 'translate(0px, 0px)';
            setTimeout(() => { avatar.style.transition = ''; }, 450);
        });
    });
});

// 2. Notificación Visual al Copiar Email
// Si el usuario hace clic en el email, lanza un pequeño aviso dinámico
document.querySelectorAll('.glass-pill').forEach(pill => {
    if(pill.innerText.includes('@')) {
        pill.style.cursor = 'pointer';
        pill.addEventListener('click', () => {
            const email = pill.innerText.trim();
            navigator.clipboard.writeText(email);
            
            const originalText = pill.innerHTML;
            pill.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
            pill.style.background = '#4ade80';
            pill.style.color = 'white';
            
            setTimeout(() => {
                pill.innerHTML = originalText;
                pill.style.background = '';
                pill.style.color = '';
            }, 2000);
        });
    }
});


















/**
 * Crea una explosión de gotas de cristal líquido
 */
function splashParticles(x, y, color) {
    const container = document.body;
    const particleCount = 6; // Número de gotas

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'liquid-particle';
        particle.style.backgroundColor = color;
        
        // Posición inicial
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';

        // Dirección aleatoria
        const angle = Math.random() * Math.PI * 2;
        const velocity = 50 + Math.random() * 80;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;

        container.appendChild(particle);

        // Animación con física simple
        const anim = particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
            duration: 600 + Math.random() * 400,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        });

        anim.onfinish = () => particle.remove();
    }
}
 