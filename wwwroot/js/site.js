
const CONFIG = {
    CHIEF_ID_FIELD: 'jefeId', 
    API_URL: '/api/empleado/todos', 
};

const AREA_COLORS = [
    { primary: '#5A67D8', secondary: '#EEF0FA' }, 
    { primary: '#d85a9bff', secondary: '#F1EEFA' }, 
    { primary: '#48bb78ff', secondary: '#EBF9F1' }, 
    { primary: '#00b7ffff', secondary: '#E6F6EC' }, 
    { primary: '#F56565', secondary: '#FEEEEE' }, 
    { primary: '#ED64A6', secondary: '#FDEFF6' }, 
   
];

let areaColorMap = new Map();
let colorIndex = 0;

window.datos = []; 
window.porId = new Map();
window.raiz = null;
window.areaDirectors = new Map(); 
let currentViewMode = 'grid'; 

let rootElModular, listContainer, chiefContainer; 

// --- Helpers de UI ---
function getAreaColors(areaName) {
    if (!areaColorMap.has(areaName)) {
        const color = AREA_COLORS[colorIndex % AREA_COLORS.length];
        areaColorMap.set(areaName, color);
        colorIndex++;
        return color;
    }
    return areaColorMap.get(areaName);
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
        img.loading = "lazy"; // Mejora de rendimiento
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
}
function renderSubordinateContent(chiefNode) { 
    listContainer.innerHTML = '';
    const controls = el('div', 'subordinate-controls');
    const viewSwitch = el('div', 'view-switch');
    const btnGrid = el('button', `btn-view ${currentViewMode === 'grid' ? 'active' : ''}`, 'Lista');
    const btnDiag = el('button', `btn-view ${currentViewMode === 'diagram' ? 'active' : ''}`, 'Diagrama');

    btnGrid.onclick = () => { currentViewMode = 'grid'; window.renderOrgView(chiefNode.id); };
    btnDiag.onclick = () => { currentViewMode = 'diagram'; window.renderOrgView(chiefNode.id); };
    
    viewSwitch.append(btnGrid, btnDiag);
    controls.append(el('h4', null, 'Estructura de Equipo'), viewSwitch);
    listContainer.appendChild(controls);

    if (currentViewMode === 'diagram') {
        const treeCont = el('div', 'org-tree-container');
        const chart = el('ul', 'org-chart');
        chart.appendChild(renderNodeTree(window.raiz, getAreaColors(getNodeValue(window.raiz, 'area'))));
        treeCont.appendChild(chart);
        listContainer.appendChild(treeCont);
    } else {
        const areasContainer = el('div', 'areas-container-modern');
        
        // Agrupamos inicialmente por área para crear las burbujas
        const grupos = chiefNode.hijos.reduce((acc, emp) => {
            const a = getNodeValue(emp, 'area');
            if (!acc[a]) acc[a] = []; 
            acc[a].push(emp); 
            return acc;
        }, {});

        Object.keys(grupos).sort().forEach(area => {
            const colors = getAreaColors(area);
            const areaWrapper = el('div', 'area-bubble-wrapper');
            
            // --- ENCABEZADO DE LA BURBUJA ---
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

            //LÓGICA DE JERARQUÍA INTERNA 
            // Renderizar solo los nodos raíz de esta área dentro de la burbuja
            grupos[area].forEach(empleado => {
                hierarchyContainer.appendChild(renderHierarchicalNode(empleado, colors));
            });

            areaHeader.onclick = () => areaWrapper.classList.toggle('is-open');

            collapsibleBody.appendChild(hierarchyContainer);
            areaWrapper.append(areaHeader, collapsibleBody);
            areasContainer.appendChild(areaWrapper);
        });
        listContainer.appendChild(areasContainer);
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
    
    // A. EFECTO TILT 3D Y BRILLO
    const tiltElements = document.querySelectorAll('.chief-card-premium, .subordinate-module-modern');

    tiltElements.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Cálculos para rotación
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (centerY - y) / 15; // Sensibilidad X
            const rotateY = (x - centerX) / 15; // Sensibilidad Y

            // Aplicar transformación y variables para el brillo CSS
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
            card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
        });

        card.addEventListener('mouseleave', () => {
            card.style.transition = 'transform 0.5s ease';
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        });
    });

    // B. EFECTO RIPPLE (ONDA AL CLIC)
    document.addEventListener('click', function (e) {
        const target = e.target.closest('.btn-search, .area-bubble-header, .btn-up-modern');
        if (target) {
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
            setTimeout(() => ripple.remove(), 600);
        }
    });

    // C. CASCADA DINÁMICA (Si las áreas se cargan dinámicamente, llamar esta función después de renderizar)
    const animateCascade = () => {
        const items = document.querySelectorAll('.area-bubble-wrapper');
        items.forEach((item, index) => {
            item.style.animationDelay = `${index * 0.1}s`;
        });
    };
    animateCascade();
});







/* --- MICRO-INTERACCIONES ADICIONALES --- */

// 1. Efecto Magnético en el Avatar
// El avatar se inclina ligeramente hacia el mouse de forma independiente
document.querySelectorAll('.profile-pic-container').forEach(avatar => {
    avatar.addEventListener('mousemove', (e) => {
        const rect = avatar.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / 5;
        const y = (e.clientY - rect.top - rect.height / 2) / 5;
        avatar.style.transform = `translate(${x}px, ${y}px)`;
    });
    
    avatar.addEventListener('mouseleave', () => {
        avatar.style.transform = `translate(0px, 0px)`;
        avatar.style.transition = "all 0.5s ease";
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