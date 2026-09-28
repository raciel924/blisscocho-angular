# Blisscocho · Angular 22

Sitio de repostería con vistas para clientes y un panel privado de administración. Incluye Angular 22, servidor HTTP Node.js 24 y SQLite local. El catálogo inicial conserva los productos de la propuesta; **sus precios son referenciales** y los pedidos están desactivados hasta que el administrador los revise.

## Ejecutar

Requiere Node.js 24.15 o posterior y npm. En la carpeta del proyecto:

```bash
npm install
ADMIN_PASSWORD='elige-una-clave-de-al-menos-12-caracteres' npm run dev
```

Abre <http://localhost:4200>. El panel está en <http://localhost:4200/admin>. La contraseña se define en `ADMIN_PASSWORD`; no está guardada en el código. La API escucha en `localhost:3001` y Angular envía `/api` y `/uploads` mediante el proxy de desarrollo.

Para servir la versión compilada desde un solo proceso:

```bash
npm run build
ADMIN_PASSWORD='elige-una-clave-de-al-menos-12-caracteres' PORT=3001 npm run serve:prod
```

Abre <http://localhost:3001>. Al publicar mediante HTTPS, configura `COOKIE_SECURE=1`. Protege la base `data/blisscocho.db` y los archivos de `public/uploads` con copias de seguridad. Usa un administrador de procesos que reinicie el servicio y un proxy TLS en producción. El almacenamiento es local: para alojar en un servicio efímero, configura `DB_FILE` en un volumen persistente o adapta la capa de datos.

## Vistas

| Perfil | Menú | Ruta | Acciones |
|---|---|---|---|
| Cliente | Inicio | `/` | Explorar catálogo y leer la historia |
| Cliente | Postres | `/postres` | Filtrar, buscar, excluir ingredientes, abrir ficha y agregar |
| Cliente | Ficha de postre | `/postres/:id` | Elegir toppings y cantidad |
| Cliente | Nuestra historia | `/nuestra-historia` | Leer el relato íntegro y ver las imágenes originales |
| Cliente | Carrito | `/carrito` | Cambiar cantidad, eliminar y continuar |
| Cliente | Hacer pedido | `/pedidos` | Elegir fecha y entrega, enviar consulta o pedido |
| Cliente | Mi pedido | `/mi-pedido` | Consultar estado con número y código privado |
| Administrador | Resumen | `/admin` → Resumen | Ver indicadores y solicitudes recientes |
| Administrador | Catálogo | `/admin` → Catálogo | Crear y editar postres, precios, inventario e imágenes |
| Administrador | Toppings | `/admin` → Toppings | Crear y editar extras |
| Administrador | Solicitudes | `/admin` → Solicitudes | Revisar datos, importes y avanzar estados |
| Administrador | Configuración | `/admin` → Configuración | WhatsApp, mínimo de entrega y activar pedidos |

## Flujo de operación

1. Las fichas comienzan como borrador, sin stock. Los clientes pueden armar una selección y enviarla como **consulta** sin reservar inventario ni pagar.
2. El administrador verifica los precios, los ingredientes y las imágenes, asigna existencias y publica productos. Luego activa los pedidos en Configuración.
3. Un pedido válido reserva existencias en una transacción SQLite. La cancelación repone esas existencias. El servidor recalcula todos los importes; nunca confía en el subtotal del navegador.
4. El cliente recibe un número de solicitud y un código privado único. El código se entrega una sola vez y se almacena solo como hash en la base de datos. También se conserva en la sesión del navegador para abrir «Mi pedido» al momento.
5. El envío se cotiza después y no existe pasarela de pagos en esta versión. Un enlace de WhatsApp aparece al configurar el número de la tienda.

## Recursos y organización

- `src/app/customer.pages.ts`: vistas de cliente.
- `src/app/admin.page.ts`: perfil administrador.
- `src/app/shop.service.ts`: carrito, catálogo y solicitudes.
- `server/index.mjs`: API, sesión, persistencia y servidor estático.
- `server/seed.mjs`: datos iniciales propuestos.
- `public/brand/`: fotografías y páginas de la historia proporcionadas.

Para personalizar el contenido inicial, edita `server/seed.mjs` antes del primer arranque. La base creada en `data/` mantiene los cambios posteriores; los datos de ejemplo nuevos se insertan sin sobrescribir los editados. El servidor limita intentos por dirección IP, verifica origen en escrituras, usa cookie `HttpOnly` y valida las solicitudes en el servidor. La sesión de administración se conserva en memoria durante ocho horas; se pierde al reiniciar el servidor.
