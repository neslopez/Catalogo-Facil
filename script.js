/* script.js - Versión estable final para CatálogoFácil PRO
   - No duplica modales
   - Cancelar funciona (botón, clic fuera, ESC)
   - Categoría manual (opción "Ingresar categoría...")
   - CRUD, filtros, orden, pdf, backup/restore
*/

/* ---------- Estado y elementos ---------- */
let productos = JSON.parse(localStorage.getItem("productos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || []; // gestionás manualmente

let editIndex = null;
/*let modoCliente = false;*/

const $ = id => document.getElementById(id);

const contenedor = $("contenedorProductos");
const filtro = $("filtroCategoria");
const ordenSelect = $("orden");
const btnAgregar = $("btnAgregar");
const btnPDF = $("btnPDF");
const btnLimpiar = $("btnLimpiar");
/*const btnModo = $("btnModo");*/
const btnBackup = $("btnBackup");
const btnAddCategoria = $("btnAddCategoria");
const nuevaCategoriaInput = $("nuevaCategoria");

const modal = $("modal");
const modalTitulo = $("modalTitulo");
const nombre = $("nombre");
const precio = $("precio");
const categoriaSelect = $("categoria"); // select en modal
const imagen = $("imagen");
const preview = $("preview");
const destacado = $("destacado");
const oferta = $("oferta");
const btnGuardar = $("guardar");
const btnCancelar = $("cancelar");

const statTotal = $("statTotal");
const statOfertas = $("statOfertas");
const statDestacados = $("statDestacados");
const statCategorias = $("statCategorias");

/* ---------- Utilidades ---------- */
function saveState() {
  localStorage.setItem("productos", JSON.stringify(productos));
  localStorage.setItem("categorias", JSON.stringify(categorias));
}

function mostrarAlerta(msg) {
  alert(msg);
}

/* Evita registrar listeners múltiples si este archivo se ejecuta otra vez */
function once(fn) {
  if (fn._done) return;
  fn._done = true;
  fn();
}

/* ---------- Inicialización ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // garantizar arrays
  if (!Array.isArray(productos)) productos = [];
  if (!Array.isArray(categorias)) categorias = [];

  // render inicial
  poblarFiltros();
  renderProductos(productos);
  actualizarStats();

  // listeners (registrar una sola vez)
  once(() => {
    // principal
    btnAgregar && btnAgregar.addEventListener("click", () => abrirModal(null));
    btnGuardar && btnGuardar.addEventListener("click", onGuardarClick);
    btnCancelar && btnCancelar.addEventListener("click", cerrarModal);

    imagen && imagen.addEventListener("change", onImagenChange);

    // modal: clic fuera
    modal && modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(); });

    // ESC cierra modal
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarModal(); });

    // filtros / orden
    filtro && filtro.addEventListener("change", () => { renderProductos(obtenerListaFiltrada()); actualizarStats(); });
    ordenSelect && ordenSelect.addEventListener("change", () => { renderProductos(obtenerListaFiltrada()); });

    // PDF / limpiar / modo / backup / restore
    btnPDF && btnPDF.addEventListener("click", generarPDF);
    btnLimpiar && btnLimpiar.addEventListener("click", () => {
      if (!confirm("¿Borrar todos los productos y categorias? Esta acción no se puede deshacer.")) return;
      productos = [];
      categorias = [];
      saveState();
      renderProductos(productos);
      cargarCategoriasEnSelect();
      actualizarStats();
    });

    /*btnModo && btnModo.addEventListener("click", () => {
      modoCliente = !modoCliente;
      document.body.classList.toggle("modo-cliente", modoCliente);
      btnModo.textContent = modoCliente ? "Modo Admin" : "Modo Cliente";
      renderProductos(obtenerListaFiltrada());
    });*/

    btnBackup && btnBackup.addEventListener("click", descargarBackup);
    

    // categorias
    btnAddCategoria && btnAddCategoria.addEventListener("click", () => {
      const v = nuevaCategoriaInput && nuevaCategoriaInput.value && nuevaCategoriaInput.value.trim();
      if (!v) return mostrarAlerta("Escribe el nombre de la categoría");
      if (!categorias.includes(v)) categorias.push(v);
      saveState();
      poblarCategoriasEnModal();
      nuevaCategoriaInput.value = "";
      actualizarStats();
    });
  });
});

/* ---------- Categorías / filtros population ---------- */
function poblarFiltros() {
  // filtro de la barra superior
  if (!filtro) return;
  const base = [
    { value: "todas", text: "Todas las categorías" },
    { value: "destacados", text: "Destacados" },
    { value: "ofertas", text: "Ofertas" }
  ];
  filtro.innerHTML = base.map(o => `<option value="${o.value}">${o.text}</option>`).join("");
  // luego agregamos categorías custom
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    filtro.appendChild(opt);
  });

  // poblar modal select
  poblarCategoriasEnModal();
}

function poblarCategoriasEnModal() {
  if (!categoriaSelect) return;
  // mantenemos siempre la opción manual al final
  categoriaSelect.innerHTML = "";
  // Agregar categorías existentes
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoriaSelect.appendChild(opt);
  });
  // opción manual
  const optManual = document.createElement("option");
  optManual.value = "__manual__";
  optManual.textContent = "Ingresar categoría (manual)";
  categoriaSelect.appendChild(optManual);

  // si seleccionan manual mostramos un input temporal
  categoriaSelect.onchange = () => {
    // eliminar input manual si existe
    const existing = document.getElementById("categoriaManual");
    if (categoriaSelect.value === "__manual__") {
      if (!existing) {
        const input = document.createElement("input");
        input.id = "categoriaManual";
        input.placeholder = "Escribe categoría...";
        input.className = "input";
        input.style.marginTop = "8px";
        categoriaSelect.parentNode.insertBefore(input, categoriaSelect.nextSibling);
      }
    } else {
      if (existing) existing.remove();
    }
  };

  // limpiar posible manual input
  const existing = document.getElementById("categoriaManual");
  if (existing) existing.remove();
}

/* ---------- Modal: abrir / cerrar (robusto) ---------- */
function abrirModal(prod = null) {
  // prevenir duplicados: cerrar cualquiera que exista
  document.querySelectorAll("#modal").forEach(m => m.classList.remove("modal-ghost")); // no crea ghosts, defensivo

  editIndex = null;
  modalTitulo && (modalTitulo.textContent = prod ? "Editar producto" : "Agregar producto");

  // si viene producto prellenar
  if (prod) {
    nombre.value = prod.nombre || "";
    precio.value = prod.precio || "";
    // si la categoria del prod no está en la lista, añadimos temporalmente como opción seleccionada
    poblarCategoriasEnModal();
    if (prod.categoria && !categorias.includes(prod.categoria)) {
      // añadir opción temporal y seleccionarla
      const tmp = document.createElement("option");
      tmp.value = prod.categoria;
      tmp.textContent = prod.categoria;
      categoriaSelect.insertBefore(tmp, categoriaSelect.firstChild);
    }
    categoriaSelect.value = prod.categoria || (categorias[0] || "");
    preview.src = prod.imagen || "";
    preview.style.display = prod.imagen ? "block" : "none";
    destacado.checked = !!prod.destacado;
    oferta.checked = !!prod.oferta;
    // localizar index
    editIndex = productos.findIndex(p => p === prod);
  } else {
    // abrir en modo nuevo
    limpiarModalFields();
    poblarCategoriasEnModal();
  }

  modal.classList.remove("oculto");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function cerrarModal() {
 const modal = document.getElementById("modal");

  modal.classList.add("oculto");
  modal.setAttribute("aria-hidden", "true");

  // limpiar campos
  document.getElementById("nombre").value = "";
  document.getElementById("precio").value = "";
  document.getElementById("categoria").value = "";
  document.getElementById("imagen").value = "";
  document.getElementById("preview").src = "";
  document.getElementById("destacado").checked = false;
  document.getElementById("oferta").checked = false;
  };

  document.body.style.overflow = "";
  limpiarModalFields();
  // remover input manual si quedó
  const manual = document.getElementById("categoriaManual");
  if (manual) manual.remove();
  editIndex = null;


function limpiarModalFields() {
  if (!nombre) return;
  nombre.value = "";
  precio.value = "";
  // si existe select, resetear
  if (categoriaSelect) {
    if (categorias.length) categoriaSelect.value = categorias[0];
    else categoriaSelect.selectedIndex = -1;
  }
  if (imagen) imagen.value = "";
  if (preview) { preview.src = ""; preview.style.display = "none"; }
  if (destacado) destacado.checked = false;
  if (oferta) oferta.checked = false;
}

/* ---------- Imagen preview ---------- */
function onImagenChange(e) {
  const file = e.target.files ? e.target.files[0] : null;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    preview.src = ev.target.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

/* ---------- Guardar producto (desde modal) ---------- */
function onGuardarClick() {
  // leer categoría manual si existe
  const manualInput = document.getElementById("categoriaManual");
  let categoriaValor = "";
  if (manualInput && manualInput.value.trim()) categoriaValor = manualInput.value.trim();
  else if (categoriaSelect && categoriaSelect.value && categoriaSelect.value !== "__manual__") categoriaValor = categoriaSelect.value;
  else categoriaValor = ""; // vacío permitido según tu pedido (manual)

  // validaciones básicas
  if (!nombre.value.trim()) return mostrarAlerta("Completá el nombre del producto.");
  if (!precio.value.trim()) return mostrarAlerta("Completá el precio.");
  if (!preview.src || preview.src === "") return mostrarAlerta("Subí una imagen antes de guardar.");

  const nuevo = {
    nombre: nombre.value.trim(),
    precio: Number(precio.value),
    categoria: categoriaValor,
    imagen: preview.src,
    destacado: !!(destacado && destacado.checked),
    oferta: !!(oferta && oferta.checked),
    id: Date.now()
  };

  // si la categoría es nueva y no está en la lista, NO la agregamos automáticamente (vos querías manual)
  // si quieses guardarla automáticamente, podríamos push(categoria) acá.

  if (editIndex !== null && typeof editIndex === "number") {
    produtosIndexGuard(nuevo);
  } else {
    productos.push(nuevo);
    saveState();
  }

  renderProductos(obtenerListaFiltrada());
  actualizarStats();
  cerrarModal();
}

function produtosIndexGuard(nuevo) {
  // Si editIndex se estableció por búsqueda, usarlo; si no, buscar por id coincidiente
  if (editIndex !== null && typeof editIndex === "number" && productos[editIndex]) {
    productos[editIndex] = nuevo;
  } else {
    // fallback: buscar por id
    productos.push(nuevo);
  }
  saveState();
}

/* ---------- Render productos ---------- */
function renderProductos(list = productos) {
  if (!contenedor) return;
  // aplicar orden
  const orden = ordenSelect ? ordenSelect.value : "default";
  if (orden === "nombre_asc") list = list.slice().sort((a,b)=> a.nombre.localeCompare(b.nombre));
  if (orden === "nombre_desc") list = list.slice().sort((a,b)=> b.nombre.localeCompare(a.nombre));
  if (orden === "precio_asc") list = list.slice().sort((a,b)=> a.precio - b.precio);
  if (orden === "precio_desc") list = list.slice().sort((a,b)=> b.precio - a.precio);

  contenedor.innerHTML = "";
  if (!list.length) {
    contenedor.innerHTML = `<p class="vacio">No hay productos cargados.</p>`;
    return;
  }

  list.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "producto";
    if (p.destacado) div.classList.add("destacado");
    if (p.oferta) div.classList.add("oferta");

    const badges = (p.destacado ? `<div class="badge destacado">⭐ Destacado</div>` : "") +
                   (p.oferta ? `<div class="badge oferta">🔥 Oferta</div>` : "");

    // acciones admin solo si no modo cliente
    const adminHtml = `
      <div class="acciones no-imprimir">
        <button class="btn outline" onclick="onEditar(${i})">✏️</button>
        <button class="btn outline" onclick="onEliminar(${i})">🗑️</button>
      </div>
    `;

    div.innerHTML = `
      ${badges}
      <img src="${p.imagen || ''}" alt="${p.nombre}">
      <h3>${p.nombre}</h3>
      <p class="categoria">${p.categoria || ''}</p>
      <p class="price"><b>$${p.precio}</b></p>
      ${adminHtml}
    `;
    contenedor.appendChild(div);
  });
}

/* Exponer handlers globales para botones inline */
window.onEditar = function(i) {
  editIndex = i;
  abrirModal(productos[i]);
};
window.onEliminar = function(i) {
  if (!confirm("¿Eliminar este producto?")) return;
  productos.splice(i, 1);
  saveState();
  renderProductos(obtenerListaFiltrada());
  actualizarStats();
};

/* ---------- Filtrar / lista ---------- */
function obtenerListaFiltrada() {
  if (!filtro) return productos;
  const cat = filtro.value;
  if (cat === "todas") return productos;
  if (cat === "destacados") return productos.filter(p=>p.destacado);
  if (cat === "ofertas") return productos.filter(p=>p.oferta);
  return productos.filter(p=>p.categoria === cat);
}

/* ---------- Backup / Restore ---------- */
function descargarBackup() {
  const data = { productos, categorias, creado: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `catalogo_backup_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function restaurarDesdeArchivo(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.productos)) throw new Error("Archivo inválido");
      if (!confirm("Restaurar sobrescribirá los datos actuales. ¿Continuar?")) return;
      productos = data.productos;
      categorias = Array.isArray(data.categorias) ? data.categorias : [];
      saveState();
      poblarFiltros();
      renderProductos(productos);
      actualizarStats();
      mostrarAlerta("Restauración completa.");
    } catch (err) {
      mostrarAlerta("Error al restaurar: " + err.message);
    }
  };
  reader.readAsText(file);
}

/* ---------- PDF (compacto) ---------- */
function generarPDF() {
  const lista = obtenerListaFiltrada();
  if (!lista.length) return mostrarAlerta("No hay productos para generar el PDF.");

  const categoriasPDF = [...new Set(lista.map(p => p.categoria || "Sin categoría"))];
  const pdfDiv = document.createElement("div");
  pdfDiv.style.fontFamily = "Arial, sans-serif";
  pdfDiv.style.padding = "8px";

  // header compacto
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "center";
  header.style.gap = "12px";

  const logo = document.createElement("img");
  logo.src = "logo.png";
  logo.style.width = "72px";
  logo.style.objectFit = "contain";
  header.appendChild(logo);

  const htxt = document.createElement("div");
  htxt.style.textAlign = "center";
  const h1 = document.createElement("h1");
  h1.textContent = "Catálogo";
  h1.style.margin = "0";
  h1.style.fontSize = "18px";
  const h2 = document.createElement("div");
  h2.textContent = `Generado: ${new Date().toLocaleDateString()}`;
  h2.style.fontSize = "11px";
  h2.style.color = "#444";
  htxt.appendChild(h1);
  htxt.appendChild(h2);
  header.appendChild(htxt);
  pdfDiv.appendChild(header);

  categoriasPDF.forEach(cat => {
    const secTitle = document.createElement("h2");
    secTitle.textContent = cat;
    secTitle.style.background = "#0074D9";
    secTitle.style.color = "white";
    secTitle.style.padding = "6px";
    secTitle.style.borderRadius = "4px";
    secTitle.style.margin = "10px 0 6px 0";
    pdfDiv.appendChild(secTitle);

    const grupo = document.createElement("div");
    grupo.style.display = "flex";
    grupo.style.flexWrap = "wrap";
    grupo.style.justifyContent = "center";

    lista.filter(p => (p.categoria || "Sin categoría") === cat).forEach(p => {
      const card = document.createElement("div");
      card.style.width = "120px";
      card.style.margin = "6px";
      card.style.border = "1px solid #e6e6e6";
      card.style.borderRadius = "6px";
      card.style.padding = "6px";
      card.style.textAlign = "center";
      if (p.destacado) card.style.boxShadow = "0 0 0 3px rgba(255,215,0,0.12)";
      if (p.oferta) card.style.border = "2px solid #d9534f";

      if (p.destacado || p.oferta) {
        const et = document.createElement("div");
        et.style.fontSize = "10px";
        et.style.fontWeight = "700";
        et.style.marginBottom = "4px";
        et.textContent = p.destacado ? "⭐ DESTACADO" : (p.oferta ? "🔥 OFERTA" : "");
        if (p.destacado) et.style.color = "#b58300";
        if (p.oferta) et.style.color = "#b30000";
        card.appendChild(et);
      }

      const img = document.createElement("img");
      img.src = p.imagen || "";
      img.style.width = "100%";
      img.style.height = "80px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "4px";
      card.appendChild(img);

      const n = document.createElement("div");
      n.textContent = p.nombre;
      n.style.fontWeight = "700";
      n.style.fontSize = "12px";
      n.style.marginTop = "6px";
      card.appendChild(n);

      const pr = document.createElement("div");
      pr.textContent = `$${p.precio}`;
      pr.style.fontSize = "12px";
      pr.style.marginTop = "4px";
      if (p.oferta) pr.style.color = "#d9534f";
      card.appendChild(pr);

      grupo.appendChild(card);
    });

    pdfDiv.appendChild(grupo);
  });

  const pie = document.createElement("div");
  pie.style.marginTop = "12px";
  pie.style.fontSize = "11px";
  pie.style.color = "#666";
  pie.textContent = `Productos: ${lista.length} • Generado: ${new Date().toLocaleString()}`;
  pdfDiv.appendChild(pie);

  html2pdf().set({ margin: 0.18, filename: "catalogo_pro.pdf", html2canvas: { scale: 2 }, jsPDF: { unit: "in", format: "a4", orientation: "portrait" } }).from(pdfDiv).save();
}

/* ---------- Estadísticas ---------- */
function actualizarStats() {
  if (statTotal) statTotal.textContent = productos.length;
  if (statOfertas) statOfertas.textContent = productos.filter(p => p.oferta).length;
  if (statDestacados) statDestacados.textContent = productos.filter(p => p.destacado).length;
  if (statCategorias) statCategorias.textContent = categorias.length;
}

/* ---------- Inicial render (seguro) ---------- */
poblarFiltros();
renderProductos(productos);
actualizarStats();

/* Exponer para debugging si hace falta */
window._productos = productos;
window._categorias = categorias;
