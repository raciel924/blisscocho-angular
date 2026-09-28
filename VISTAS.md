# Recorrido visual de Blisscocho

Abre la aplicación con `npm run dev` y usa las rutas de esta guía. Los botones del encabezado abren las pantallas de cliente; «Administración» está en el pie de página y abre el acceso privado.

| Pantalla | Qué verá la persona | Botones y resultado |
|---|---|---|
| Inicio `/` | Portada cálida, tres postres destacados, relato breve | «Explorar postres», «Nuestra historia», «Ver todo el menú», «Agregar» |
| Postres `/postres` | Tarjetas con fotos, precio propuesto y stock | Filtros Panqués/Roles, búsqueda, excluir ingrediente, ficha, agregar |
| Ficha `/postres/panque-de-platano-con-chocolate` | Descripción, ingredientes, extras y cantidad | Seleccionar toppings y agregar al carrito |
| Nuestra historia `/nuestra-historia` | Los tres capítulos íntegros y las páginas originales enviadas | «Leer la historia» y «Conoce nuestros postres» |
| Carrito `/carrito` | Selección, subtotal y mínimo de envío | `+`, `−`, «Eliminar», «Continuar» |
| Hacer pedido `/pedidos` | Pasos Postres → Fecha → Entrega → Revisar | Consulta sin reserva por defecto; pedido con inventario cuando admin lo active |
| Mi pedido `/mi-pedido` | Formulario de número y código; ficha de estado | «Ver estado» |
| Administrador `/admin` | Contraseña, resumen y cinco pestañas | Catálogo, toppings, solicitudes, configuración, cerrar sesión |

La pantalla de administración requiere la contraseña configurada al iniciar el servidor. Al entrar, cada pestaña cambia la vista en el mismo URL `/admin`. Ninguna acción de compra realiza un cobro en línea.
