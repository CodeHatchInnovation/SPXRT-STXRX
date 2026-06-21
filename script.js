import { 
    firestoreDB,
    realtimeDB,
    collection,
    getDocs,
    ref,
    push,
    onValue,
    update
} from "./firebase.js";
// Importamos las herramientas de actualización directamente desde el CDN oficial de Google
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// Variables de estado accesibles en todo el módulo
let productos = [];
let carrito = [];
let seleccionado = null;
let tallaActiva = null;
let rating = 0;

document.addEventListener('DOMContentLoaded', () => {

    const grid = document.getElementById('contenedor-productos');
    const modal = document.getElementById('modal-producto');
    const sidebar = document.getElementById('carrito-sidebar');

    // ==========================================
    // CARGAR PRODUCTOS DESDE CLOUD FIRESTORE
    // ==========================================
    async function obtenerProductosDeFirestore() {
        try {
            const querySnapshot = await getDocs(collection(firestoreDB, "productos"));
            productos = [];
            
            querySnapshot.forEach((doc) => {
                productos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Espera a que termine el Splash Screen (5s + 0.5s margen) antes de renderizar
            setTimeout(() => {
                cargarProductos();
            }, 5500);

        } catch (error) {
            console.error("Error al traer productos de Firestore:", error);
        }
    }

    // Arrancamos la descarga de tenis en segundo plano
    obtenerProductosDeFirestore();

    // ===============================
    // MOSTRAR PRODUCTOS
    // ===============================
    function cargarProductos() {
        grid.innerHTML = "";
        productos.forEach((p) => {
            const div = document.createElement('div');
            div.className = "reveal card-vantage p-8 cursor-pointer flex flex-col group";
            div.innerHTML = `
                <div class="img-container-fix mb-6">
                    <img src="${p.img}" class="transition-transform duration-700 group-hover:scale-110">
                </div>
                <h3 class="font-nike text-lg mb-1">${p.nombre}</h3>
                <p class="text-gray-400 text-sm font-bold">$${p.precioVenta.toLocaleString()}</p>
            `;
            div.onclick = () => abrirModal(p);
            grid.appendChild(div);
        });
    }

    // ===============================
    // ABRIR MODAL PRODUCTO
    // ===============================
    window.abrirModal = (p) => {
        seleccionado = p;
        tallaActiva = null;
        document.getElementById('titulo-modal').innerText = p.nombre;
        document.getElementById('precio-modal').innerText = `$${p.precioVenta.toLocaleString()} MXN`;
        document.getElementById('desc-modal').innerText = p.desc;
        document.getElementById('img-modal').src = p.img;
        
        document.getElementById('tallas-modal').innerHTML = p.tallas ? p.tallas.map(t => `
            <button
                onclick="marcarTalla('${t.talla}', this)"
                class="py-4 border border-gray-100 text-xs font-bold hover:border-[#7c3aed] transition-all"
                ${t.stock <= 0 ? 'disabled' : ''}
            >
                ${t.talla}
                <br>
                <span class="text-[9px] text-gray-400">${t.stock} disponibles</span>
            </button>
        `).join('') : '<p class="text-xs text-gray-400">No hay tallas disponibles</p>';

        // ===========================================
        // CARGAR RESEÑAS DESDE REALTIME DATABASE
        // ===========================================
        const resenasRef = ref(realtimeDB, `resenas_v4/${p.id}`);
        onValue(resenasRef, (snap) => {
            const data = snap.val();
            document.getElementById('lista-reseñas').innerHTML = data ? 
                Object.values(data).reverse().map(r => `
                    <div class="border-b border-gray-50 pb-4">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-[9px] font-black uppercase text-[#7c3aed]">${r.u}</span>
                            <div class="text-[#7c3aed] text-[7px]">
                                ${'<i class="ph-fill ph-star"></i>'.repeat(r.e)}
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 font-light">"${r.c}"</p>
                    </div>
                `).join('')
                :
                '<p class="text-[10px] text-gray-300 uppercase tracking-widest">Sin reseñas todavía.</p>';
        });
        modal.classList.remove('hidden');
    };

    // ===============================
    // SELECCIONAR TALLA
    // ===============================
    window.marcarTalla = (t, b) => {
        tallaActiva = t;
        document.querySelectorAll('#tallas-modal button').forEach(x => {
            x.classList.remove('talla-active');
        });
        b.classList.add('talla-active');
    };

    // ===============================
    // ESTRELLAS RESEÑAS
    // ===============================
    window.setRating = (n) => {
        rating = n;
        document.querySelectorAll('.star').forEach((s, i) => {
            s.classList.toggle('star-active', i < n);
        });
    };

    // ===============================
    // PUBLICAR RESEÑA
    // ===============================
    document.getElementById('btn-publicar-reseña').onclick = () => {
        const u = document.getElementById('nombre-usuario').value;
        const c = document.getElementById('texto-reseña').value;
        if (!u || !c || !rating) return alert("Completa los campos de la reseña.");
        
        const nuevaResenaRef = ref(realtimeDB, `resenas_v4/${seleccionado.id}`);
        push(nuevaResenaRef, {
            u,
            c,
            e: rating
        })
        .then(() => {
            document.getElementById('nombre-usuario').value = "";
            document.getElementById('texto-reseña').value = "";
            window.setRating(0);
        });
    };

    // ===============================
    // AGREGAR AL CARRITO
    // ===============================
    document.getElementById('btn-agregar-carrito').onclick = () => {
        if (!tallaActiva) return alert("Selecciona una talla.");
        const tallaSeleccionada = seleccionado.tallas.find(t => t.talla == tallaActiva);
        if (tallaSeleccionada.stock <= 0) return alert("Esta talla está agotada.");
        
        carrito.push({
            ...seleccionado,
            talla: tallaActiva,
            cId: Date.now()
        });
        actualizarCarrito();
        modal.classList.add('hidden');
        sidebar.classList.remove('hidden');
    };

    // ===============================
    // ACTUALIZAR CARRITO
    // ===============================
    function actualizarCarrito() {
        let total = 0;
        document.getElementById('items-carrito').innerHTML = carrito.map(i => {
            total += i.precioVenta;
            return `
                <div class="flex gap-4 items-center bg-gray-50 p-4 border border-gray-100">
                    <img src="${i.img}" class="w-12 h-12 object-contain">
                    <div class="flex-1 text-[10px] font-bold uppercase truncate">${i.nombre}</div>
                    <button onclick="borrarItem(${i.cId})" class="text-gray-300 hover:text-red-500">
                        <i class="ph-fill ph-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        document.getElementById('total-carrito').innerText = `$${total.toLocaleString()}`;
        document.getElementById('badge-carrito').innerText = carrito.length;
        document.getElementById('badge-carrito').classList.toggle('hidden', !carrito.length);
    }

    // ===============================
    // ELIMINAR PRODUCTO CARRITO
    // ===============================
    window.borrarItem = (id) => {
        carrito = carrito.filter(i => i.cId !== id);
        actualizarCarrito();
    };

    document.getElementById('abrir-carrito').onclick = () => { sidebar.classList.remove('hidden'); };
    document.getElementById('btn-cerrar-carrito').onclick = () => { sidebar.classList.add('hidden'); };
    document.getElementById('btn-cerrar-modal').onclick = () => { modal.classList.add('hidden'); };
    document.getElementById('cerrar-fondo-modal').onclick = () => { modal.classList.add('hidden'); };

    // ===============================
    // FORMULARIO DE ENVÍO
    // ===============================
    document.getElementById('btn-continuar-pedido').onclick = (e) => {
        e.preventDefault();
        if (carrito.length === 0) return alert("Tu carrito está vacío.");
        
        // Cierra el carrito
        sidebar.classList.add('hidden'); 
        
        // Abre el formulario de envío al instante sin trabas
        document.getElementById('modal-envio').classList.remove('hidden');
    };

    document.getElementById('cerrar-envio').onclick = () => { document.getElementById('modal-envio').classList.add('hidden'); };
    document.getElementById('cerrar-fondo-envio').onclick = () => { document.getElementById('modal-envio').classList.add('hidden'); };

    // ===============================
    // BUSCADOR
    // ===============================
    document.getElementById('buscador-productos').addEventListener('input', function() {
        const texto = this.value.toLowerCase();
        document.querySelectorAll('#contenedor-productos .card-vantage').forEach(card => {
            const nombre = card.querySelector('h3').innerText.toLowerCase();
            card.style.display = nombre.includes(texto) ? 'flex' : 'none';
        });
    });

    // ===========================================
    // WHATSAPP PEDIDO Y DESCUENTO DE INVENTARIO 🚀
    // ===========================================
    document.getElementById('form-envio').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('envio-nombre').value;
        const telefono = document.getElementById('envio-telefono').value;
        const correo = document.getElementById('envio-correo').value;
        const estado = document.getElementById('envio-estado').value;
        const city = document.getElementById('envio-ciudad').value;
        const colonia = document.getElementById('envio-colonia').value;
        const cp = document.getElementById('envio-cp').value;
        const calle = document.getElementById('envio-calle').value;
        const referencias = document.getElementById('envio-referencias').value;
        
        let productosTexto = "";
        
        try {
            // Importamos las herramientas y el inicializador oficial de Firebase en caliente
            const { getFirestore, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const { getApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");

            // Obtenemos la base de datos garantizando que sea la instancia correcta del SDK
            const app Activa = getApp();
            const dbCorrecta = getFirestore(appActiva);

            for (const item of carrito) {
                productosTexto += `• ${item.nombre}\nTalla: ${item.talla}\nPrecio: $${item.precioVenta}\n\n`;

                const productoOriginal = productos.find(p => p.id === item.id);
                if (productoOriginal && productoOriginal.tallas) {
                    const tallasActualizadas = productoOriginal.tallas.map(t => {
                        if (t.talla == item.talla) { 
                            return { ...t, stock: Math.max(0, Number(t.stock) - 1) };
                        }
                        return t;
                    });

                    // Usamos la db unificada y verificada por el SDK
                    const productoDocRef = doc(dbCorrecta, "productos", item.id);
                    await updateDoc(productoDocRef, {
                        tallas: tallasActualizadas
                    });
                }
            }

            const total = document.getElementById('total-carrito').innerText;
            const mensaje = `
🛒 NUEVO PEDIDO SPXRT STXRX
👤 Cliente:
${nombre}
📞 Teléfono:
${telefono}
📧 Correo:
${correo}
📍 Dirección:
${calle}
${colonia}
${city}
${estado}
CP: ${cp}
📝 Referencias:
${referencias}
━━━━━━━━━━━━━━
PRODUCTOS:
${productosTexto}━━━━━━━━━━━━━━
💰 Total:
${total}
🚚 Pago contra entrega
`;
            const numero = "+525525621721";
            
            window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank');
            
            carrito = [];
            actualizarCarrito();
            document.getElementById('modal-envio').classList.add('hidden');

        } catch (error) {
            console.error("Error al actualizar el stock en la compra:", error);
            alert("Hubo un problema al descontar el inventario. Por favor, inténtalo de nuevo.");
        }
    });
