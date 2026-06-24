import { 
    firestoreDB,
    realtimeDB,
    collection,
    getDocs,
    addDoc,     
    updateDoc,  
    doc,        
    ref,
    push,
    onValue,
    update,
    runTransaction
} from "./firebase.js";

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
            
            querySnapshot.forEach((docSnap) => {
                const datosProducto = docSnap.data();
                
                productos.push({
                    ...datosProducto,
                    id: docSnap.id 
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
        
        // Verificamos si tiene tallas y filtramos solo las que tienen stock > 0
        const tallasDisponibles = p.tallas ? p.tallas.filter(t => Number(t.stock) > 0) : [];

        if (tallasDisponibles.length > 0) {
            document.getElementById('tallas-modal').innerHTML = tallasDisponibles.map(t => `
                <button
                    onclick="marcarTalla('${t.talla}', this)"
                    class="py-4 border border-gray-100 text-xs font-bold hover:border-[#7c3aed] transition-all"
                >
                    ${t.talla}
                    <br>
                    <span class="text-[9px] text-gray-400">${t.stock} disponibles</span>
                </button>
            `).join('');
        } else {
            // Si el producto no tiene tallas con stock, mostramos un mensaje limpio
            document.getElementById('tallas-modal').innerHTML = '<p class="text-xs text-gray-400 uppercase tracking-widest">No hay stock disponible actualmente.</p>';
        }

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

    // =========================================================
    // PROCESAR COMPRA: CON TRANSACCIONES ANTI-SOBREPOSICIÓN 🚀
    // =========================================================
    document.getElementById('form-envio').addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. AGRUPAR EL CARRITO (Esto es lo nuevo que evita el error)
        const carritoAgrupado = carrito.reduce((acc, item) => {
            const key = `${item.id}-${item.talla}`;
            if (!acc[key]) acc[key] = { ...item, cantidad: 0 };
            acc[key].cantidad += 1;
            return acc;
        }, {});

        const nombre = document.getElementById('envio-nombre').value;
        const telefono = document.getElementById('envio-telefono').value;
        const correo = document.getElementById('envio-correo').value;
        const estado = document.getElementById('envio-estado').value;
        const city = document.getElementById('envio-ciudad').value;
        const colonia = document.getElementById('envio-colonia').value;
        const cp = document.getElementById('envio-cp').value;
        const calle = document.getElementById('envio-calle').value;
        const referencias = document.getElementById('envio-referencias').value;
        
        try {
            let productosTextoEmail = ""; 
            const totalTexto = document.getElementById('total-carrito').innerText;
            const direccionCompleta = `${calle}, Col. ${colonia}, ${city}, ${estado}. CP: ${cp}. (Ref: ${referencias})`;

            // Ejecutamos la Transacción Atómica en Firestore
            await runTransaction(firestoreDB, async (transaction) => {
                const actualizacionesAfectadas = [];

                // 2. Iteramos sobre el carrito AGRUPADO en lugar del carrito original
                for (const key in carritoAgrupado) {
                    const item = carritoAgrupado[key];
                    const productoDocRef = doc(firestoreDB, "productos", item.id);
                    const sfDoc = await transaction.get(productoDocRef);
                    
                    if (!sfDoc.exists()) {
                        throw "¡Uno de los productos en tu carrito ya no existe en la tienda!";
                    }

                    const datosProductoNube = sfDoc.data();
                    let stockSuficiente = false;

                    const tallasActualizadas = datosProductoNube.tallas.map(t => {
                        if (t.talla == item.talla) {
                            const stockRealNube = Number(t.stock);
                            // 3. Restamos la cantidad agrupada (item.cantidad)
                            if (stockRealNube >= item.cantidad) {
                                stockSuficiente = true;
                                return { ...t, stock: stockRealNube - item.cantidad };
                            }
                        }
                        return t;
                    });

                    if (!stockSuficiente) {
                        throw `Lo sentimos, el producto "${item.nombre}" en Talla [${item.talla}] no tiene suficiente stock.`;
                    }

                    actualizacionesAfectadas.push({ ref: productoDocRef, nuevasTallas: tallasActualizadas });
                    productosTextoEmail += `• ${item.nombre} - Talla: ${item.talla} (Cant: ${item.cantidad}) - Precio: $${item.precioVenta.toLocaleString()} MXN\n`;
                }

                actualizacionesAfectadas.forEach(act => {
                    transaction.update(act.ref, { tallas: act.nuevasTallas });
                });
            });

            // 2. Guardar el Pedido en la colección "pedidos" de Firestore
            const productosPedido = carrito.map(item => ({
                id: item.id,
                nombre: item.nombre,
                talla: item.talla,
                precio: item.precioVenta
            }));

            const nuevoPedido = {
                cliente: { nombre, telefono, correo },
                direccion: { calle, colonia, ciudad: city, estado, cp, referencias },
                productos: productosPedido,
                total: totalTexto,
                metodoPago: "Pago contra entrega",
                estatus: "Pendiente",
                fecha: new Date().toISOString()
            };

            await addDoc(collection(firestoreDB, "pedidos"), nuevoPedido);

            // 3. Enviar Correo de Confirmación mediante EmailJS ✉️
            const templateParams = {
                cliente_nombre: nombre,
                cliente_correo: correo,
                cliente_telefono: telefono,
                productos: productosTextoEmail,
                total: totalTexto,
                direccion: direccionCompleta
            };

            await emailjs.send('service_jcmou3p', 'template_9wxljc7', templateParams);
            
            alert(`¡Compra procesada con éxito, ${nombre}!\nTu pedido ha sido registrado y el ticket fue enviado a tu correo: ${correo}`);

            carrito = [];
            actualizarCarrito();
            
            document.getElementById('form-envio').reset();
            document.getElementById('modal-envio').classList.add('hidden');
            sidebar.classList.add('hidden'); 

            window.location.reload();

        } catch (error) {
            console.error("Error al procesar la compra completa:", error);
            if (typeof error === 'string' && error.includes('stock')) {
                alert(`⚠️ ¡STOCK INSUFICIENTE!\n\n${error}\n\nLa página se recargará para actualizar el stock real.`);
                window.location.reload();
            } else {
                alert("Hubo un problema al procesar tu compra. Por favor, inténtalo de nuevo.");
            }
        }
    });
});
