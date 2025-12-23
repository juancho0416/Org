// 1. CONFIGURACIÓN Y CONSTANTES
const CONFIG = {
    CHIEF_ID_FIELD: 'jefeId',
    API_URL: '/api/empleado/todos',
    PARTICLE_COUNT: 8,
    SEARCH_MIN_LENGTH: 3,
    ANIMATION_DURATION: 600,
};
// 2. GESTIÓN DE COLORES (Optimizada)
const ColorManager = (() => {
    const colors = [];
    const assignedColors = new Map();
    
    // Cargar colores desde CSS
    const loadColors = () => {
        const css = getComputedStyle(document.documentElement);
        for (let i = 0; i < 12; i++) {
            const primary = css.getPropertyValue(`--area-color-${i}-primary`).trim();
            const secondary = css.getPropertyValue(`--area-color-${i}-secondary`).trim();
            if (primary) colors.push({ primary, secondary: secondary || '#EEF0FA' });
        }
        // Colores por defecto si no hay en CSS
        if (!colors.length) {
            colors.push(
                { primary: '#5A67D8', secondary: '#EEF0FA' },
                { primary: '#38A169', secondary: '#F0FFF4' },
                { primary: '#E53E3E', secondary: '#FFF5F5' },
                { primary: '#DD6B20', secondary: '#FFFAF0' }
            );
        }
    };
    
    // Obtener colores para un área específica
    const getColors = (areaName) => {
        const name = (areaName?.toString().trim() || 'DEFAULT').toUpperCase();
        
        if (assignedColors.has(name)) {
            return assignedColors.get(name);
        }
        
        // Hash simple para distribución consistente
        const hash = Array.from(name).reduce((acc, char) => 
            ((acc << 5) - acc) + char.charCodeAt(0), 0
        );
        
        const color = colors[Math.abs(hash) % colors.length];
        assignedColors.set(name, color);
        return color;
    };
    
    loadColors();
    return { getColors };
})();

// 3. ESTADO GLOBAL (Mejor organizado)
const State = {
    employees: new Map(),
    root: null,
    areaDirectors: new Map(),
    currentView: 'grid',
    containers: {
        rootEl: null,
        chiefContainer: null,
        listContainer: null
    }
};
// 4. UTILIDADES DOM
const DOM = {
    create: (tag, className = '', text = null) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== null) el.textContent = text;
        return el;
    },
    
    getValue: (node, prop, defaultVal = 'N/A') => {
        const val = node?.[prop];
        return (val !== null && val !== undefined && val.toString().trim()) 
            ? val.toString().trim() 
            : defaultVal;
    },
    
    injectSVGFilter: () => {
        if (document.getElementById('liquid-filter-svg')) return;
        
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "liquid-filter-svg";
        svg.style.cssText = "position:absolute;width:0;height:0";
        svg.innerHTML = `
            <defs>
                <filter id="liquid-fusion">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                    <feColorMatrix in="blur" mode="matrix" 
                        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10" 
                        result="liquid" />
                    <feComposite in="SourceGraphic" in2="liquid" operator="atop"/>
                </filter>
            </defs>`;
        document.body.appendChild(svg);
    }
};

// 5. EFECTOS VISUALES

const Effects = {
    splashParticles: (x, y, color) => {
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            const particle = DOM.create('div', 'liquid-particle');
            particle.style.cssText = `
                background-color: ${color};
                left: ${x}px;
                top: ${y}px;
            `;
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = 30 + Math.random() * 50;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            
            document.body.appendChild(particle);
            
            particle.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
            ], {
                duration: CONFIG.ANIMATION_DURATION,
                easing: 'ease-out'
            }).onfinish = () => particle.remove();
        }
    },
    
    addRipple: (e, element) => {
        const rect = element.getBoundingClientRect();
        const ripple = DOM.create('span', 'ripple');
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${e.clientX - rect.left - size / 2}px;
            top: ${e.clientY - rect.top - size / 2}px;
        `;
        
        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }
};

// 6. COMPONENTES UI

const Components = {
    createProfilePicture: (node, colors) => {
        const imageUrl = DOM.getValue(node, 'imagenURL', null);
        const nombre = DOM.getValue(node, 'nombre');
        const container = DOM.create('div', 'profile-pic-container');
        
        container.style.setProperty('--profile-border-color', colors.primary);
        
        if (imageUrl && imageUrl !== 'N/A') {
            const img = DOM.create('img', 'profile-pic');
            img.src = imageUrl;
            img.onerror = function() {
                this.remove();
                container.classList.add('has-initials');
                container.textContent = nombre[0].toUpperCase();
                container.style.backgroundColor = colors.secondary;
                container.style.color = colors.primary;
            };
            container.appendChild(img);
        } else {
            container.classList.add('has-initials');
            container.textContent = nombre[0].toUpperCase();
            container.style.backgroundColor = colors.secondary;
            container.style.color = colors.primary;
        }
        
        return container;
    },
    
    createChiefModule: (chiefNode) => {
        const colors = ColorManager.getColors(DOM.getValue(chiefNode, 'area'));
        const wrapper = DOM.create('div', 'chief-wrapper chief-animate-in');
        const card = DOM.create('div', 'chief-card-premium active-liquid');
        
        const liquidBg = DOM.create('div', 'chief-liquid-bg');
        liquidBg.innerHTML = `
            <div class="blob-1" style="background: ${colors.primary}"></div>
            <div class="blob-2" style="background: ${colors.secondary}"></div>
        `;
        
        card.style.borderTop = `5px solid ${colors.primary}`;
        
        const badge = DOM.create('span', 'leader-badge', 'Responsable');
        badge.style.backgroundColor = colors.primary;
        
        const cardContent = DOM.create('div', 'chief-card-content');
        cardContent.onclick = () => Navigation.goToProfile(chiefNode.id);
        
        const profilePic = Components.createProfilePicture(chiefNode, colors);
        const info = DOM.create('div', 'chief-info');
        info.innerHTML = `
            <span class="area-label" style="color:${colors.primary}">
                ${DOM.getValue(chiefNode, 'area')}
            </span>
            <h3 class="chief-name">${DOM.getValue(chiefNode, 'nombre')}</h3>
            <p class="chief-puesto">${DOM.getValue(chiefNode, 'puesto')}</p>
        `;
        
        cardContent.append(profilePic, info);
        card.append(liquidBg, badge, cardContent);
        
        if (chiefNode.jefe) {
            const btn = DOM.create('button', 'btn-up-modern', 
                `↑ Subir a ${chiefNode.jefe.nombre}`);
            btn.onclick = (e) => {
                e.stopPropagation();
                Render.renderOrgView(chiefNode.jefe.id);
            };
            wrapper.appendChild(btn);
        }
        
        wrapper.appendChild(card);
        return wrapper;
    },
    
    createSubordinateCard: (node, colors) => {
        const wrapper = DOM.create('div', 'hierarchy-node-wrapper subordinate-appear');
        const card = DOM.create('div', 'subordinate-module-modern liquid-item');
        
        card.style.setProperty('--area-color', colors.primary);
        card.style.setProperty('--area-color-soft', colors.secondary);
        
        if (node.hijos?.length > 0) {
            const pulse = DOM.create('div', 'team-pulse');
            pulse.style.backgroundColor = colors.primary;
            card.appendChild(pulse);
        }
        
        card.onclick = (e) => {
            e.stopPropagation();
            Effects.splashParticles(e.clientX, e.clientY, colors.primary);
            setTimeout(() => Navigation.goToProfile(node.id), 150);
        };
        
        const top = DOM.create('div', 'subordinate-top-content');
        top.append(Components.createProfilePicture(node, colors));
        
        const info = DOM.create('div', 'subordinate-info');
        info.innerHTML = `
            <strong>${DOM.getValue(node, 'nombre')}</strong>
            <span class="puesto-label">${DOM.getValue(node, 'puesto')}</span>
        `;
        
        top.appendChild(info);
        card.appendChild(top);
        
        if (node.hijos?.length > 0) {
            const childrenBox = DOM.create('div', 'hierarchy-children-box');
            node.hijos.forEach(hijo => {
                const hijoColors = ColorManager.getColors(DOM.getValue(hijo, 'area'));
                childrenBox.appendChild(Components.createSubordinateCard(hijo, hijoColors));
            });
            wrapper.append(card, childrenBox);
        } else {
            wrapper.appendChild(card);
        }
        
        return wrapper;
    },
    
    createDiagramNode: (node, colors) => {
        const li = DOM.create('li', 'org-node');
        const module = DOM.create('div', 'subordinate-module diagram-view');
        
        module.onclick = () => Navigation.goToProfile(node.id);
        module.style.setProperty('--card-primary-color', colors.primary);
        module.append(Components.createProfilePicture(node, colors));
        
        const info = DOM.create('div', 'subordinate-info');
        info.innerHTML = `
            <strong>${DOM.getValue(node, 'nombre')}</strong>
            <span>${DOM.getValue(node, 'puesto')}</span>
        `;
        module.appendChild(info);
        li.appendChild(module);
        
        if (node.hijos?.length > 0) {
            const ul = DOM.create('ul', 'org-children');
            node.hijos.forEach(h => {
                const hColors = ColorManager.getColors(DOM.getValue(h, 'area'));
                ul.appendChild(Components.createDiagramNode(h, hColors));
            });
            li.appendChild(ul);
        }
        
        return li;
    }
};

// 7. NAVEGACIÓN

const Navigation = {
    goToProfile: (id) => {
        window.location.href = `/Ventanaperfil?id=${id}`;
    }
};


// 8. BÚSQUEDA Y FILTROS

const Search = {
    perform: () => {
        const input = document.getElementById('employee-search-input');
        const query = input.value.trim().toLowerCase();
        
        if (query.length < CONFIG.SEARCH_MIN_LENGTH) return;
        
        const found = Array.from(State.employees.values()).find(emp =>
            DOM.getValue(emp, 'nombre').toLowerCase().includes(query) ||
            DOM.getValue(emp, 'puesto').toLowerCase().includes(query)
        );
        
        if (found) {
            input.value = '';
            Navigation.goToProfile(found.id);
        } else {
            input.classList.add('search-error');
            setTimeout(() => input.classList.remove('search-error'), 500);
        }
    },
    
    mapAreas: () => {
        State.areaDirectors.clear();
        
        State.employees.forEach(node => {
            const area = DOM.getValue(node, 'area');
            if (area === 'N/A') return;
            
            let curr = node;
            while (curr.jefe && DOM.getValue(curr.jefe, 'area') === area) {
                curr = curr.jefe;
            }
            
            if (!State.areaDirectors.has(area)) {
                State.areaDirectors.set(area, curr);
            }
        });
    },
    
    populateAreaSelector: () => {
        const selector = document.getElementById('area-selector');
        if (!selector) return;
        
        selector.innerHTML = '<option value="">-- Seleccionar Área --</option>';
        
        Array.from(State.areaDirectors.keys()).sort().forEach(area => {
            const opt = DOM.create('option', null, area);
            opt.value = State.areaDirectors.get(area).id;
            selector.appendChild(opt);
        });
        
        selector.onchange = (e) => {
            if (e.target.value) {
                State.currentView = 'grid';
                Render.renderOrgView(parseInt(e.target.value));
            }
        };
    }
};

// 9. RENDERIZADO

const Render = {
    renderOrgView: (nodeId) => {
        const node = State.employees.get(nodeId);
        if (!node) return;
        
        const { rootEl, chiefContainer, listContainer } = State.containers;
        
        rootEl.innerHTML = '';
        chiefContainer.innerHTML = '';
        listContainer.innerHTML = '';
        
        chiefContainer.appendChild(Components.createChiefModule(node));
        rootEl.append(chiefContainer, listContainer);
        
        Render.renderSubordinates(node, listContainer);
    },
    
    renderSubordinates: (chiefNode, container) => {
        const controls = DOM.create('div', 'subordinate-controls');
        const viewSwitch = DOM.create('div', 'view-switch liquid-container');
        const liquidBlob = DOM.create('div', 'view-switch-blob');
        
        const btnGrid = DOM.create('button', 
            `btn-view ${State.currentView === 'grid' ? 'active' : ''}`, 'Lista');
        const btnDiag = DOM.create('button', 
            `btn-view ${State.currentView === 'diagram' ? 'active' : ''}`, 'Diagrama');
        
        btnGrid.onclick = () => {
            State.currentView = 'grid';
            Render.renderOrgView(chiefNode.id);
        };
        btnDiag.onclick = () => {
            State.currentView = 'diagram';
            Render.renderOrgView(chiefNode.id);
        };
        
        viewSwitch.append(liquidBlob, btnGrid, btnDiag);
        controls.append(DOM.create('h4', null, 'Estructura de Equipo'), viewSwitch);
        container.appendChild(controls);
        
        if (State.currentView === 'diagram') {
            Render.renderDiagram(chiefNode, container);
        } else {
            Render.renderGrid(chiefNode, container);
        }
    },
    
    renderDiagram: (chiefNode, container) => {
        const treeCont = DOM.create('div', 'org-tree-container');
        const chart = DOM.create('ul', 'org-chart');
        const colors = ColorManager.getColors(DOM.getValue(chiefNode, 'area'));
        
        chart.appendChild(Components.createDiagramNode(chiefNode, colors));
        treeCont.appendChild(chart);
        container.appendChild(treeCont);
    },
    
    renderGrid: (chiefNode, container) => {
        const areasContainer = DOM.create('div', 'areas-container-modern');
        
        // Agrupar por área
        const grupos = chiefNode.hijos.reduce((acc, emp) => {
            const area = DOM.getValue(emp, 'area');
            if (!acc[area]) acc[area] = [];
            acc[area].push(emp);
            return acc;
        }, {});
        
        Object.keys(grupos).sort().forEach(area => {
            const colors = ColorManager.getColors(area);
            const areaWrapper = DOM.create('div', 'area-bubble-wrapper liquid-area');
            const areaHeader = DOM.create('div', 'area-bubble-header');
            
            areaHeader.style.cssText = `
                border-left: 6px solid ${colors.primary};
                background-color: ${colors.secondary};
            `;
            
            areaHeader.innerHTML = `
                <div class="area-info">
                    <div class="area-icon-pill" style="background:${colors.primary}">
                        <i class="fas fa-sitemap" style="color:white; font-size:0.8rem;"></i>
                    </div>
                    <div>
                        <h5 style="color: ${colors.primary}; margin:0;">${area}</h5>
                        <span class="area-badge">${grupos[area].length} integrantes</span>
                    </div>
                </div>
                <span class="toggle-icon">▼</span>
            `;
            
            const expansionBlob = DOM.create('div', 'expansion-blob');
            expansionBlob.style.background = colors.secondary;
            
            const collapsibleBody = DOM.create('div', 'area-collapsible-body');
            const hierarchyFlow = DOM.create('div', 'internal-hierarchy-flow');
            hierarchyFlow.style.setProperty('--area-color', colors.primary);
            
            grupos[area].forEach(emp => 
                hierarchyFlow.appendChild(Components.createSubordinateCard(emp, colors))
            );
            
            areaHeader.onclick = (e) => {
                areaWrapper.classList.toggle('is-open');
                Effects.addRipple(e, areaHeader);
            };
            
            collapsibleBody.appendChild(hierarchyFlow);
            areaWrapper.append(expansionBlob, areaHeader, collapsibleBody);
            areasContainer.appendChild(areaWrapper);
        });
        
        container.appendChild(areasContainer);
    }
};

// 10. INICIALIZACIÓN

const DataManager = {
    buildStructure: (nodes) => {
        State.employees = new Map(
            nodes.map(d => [
                d.id, 
                { ...d, hijos: [], jefe: null, jefeId: d[CONFIG.CHIEF_ID_FIELD] }
            ])
        );
        
        const roots = [];
        
        State.employees.forEach(node => {
            const jefeId = parseInt(node.jefeId);
            const jefe = State.employees.get(jefeId);
            
            if (jefe && node.id !== jefeId) {
                jefe.hijos.push(node);
                node.jefe = jefe;
            } else {
                roots.push(node);
            }
        });
        
        State.root = roots[0];
        
        Search.mapAreas();
        Search.populateAreaSelector();
        
        if (State.root) {
            Render.renderOrgView(State.root.id);
        }
    },
    
    fetchData: async () => {
        try {
            const response = await fetch(CONFIG.API_URL);
            const data = await response.json();
            DataManager.buildStructure(data);
        } catch (err) {
            console.error("Error al cargar datos:", err);
        }
    }
};

// 11. EVENTO DE INICIO

document.addEventListener('DOMContentLoaded', () => {
    // Inyectar filtro SVG
    DOM.injectSVGFilter();
    
    // Inicializar contenedores
    State.containers.rootEl = document.getElementById('org-view');
    State.containers.chiefContainer = DOM.create('div');
    State.containers.chiefContainer.id = 'current-chief-module';
    State.containers.listContainer = DOM.create('div');
    State.containers.listContainer.id = 'subordinate-list';
    
    // Configurar búsqueda
    const searchBtn = document.getElementById('employee-search-button');
    const searchInput = document.getElementById('employee-search-input');
    
    if (searchBtn) searchBtn.onclick = Search.perform;
    if (searchInput) {
        searchInput.onkeypress = (e) => {
            if (e.key === 'Enter') Search.perform();
        };
    }
    
    // Cargar datos
    DataManager.fetchData();
    
    // Exponer API global (para compatibilidad)
    window.porId = State.employees;
    window.raiz = State.root;
    window.renderOrgView = Render.renderOrgView;
});




