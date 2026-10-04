# Órbita

PWA personal para ordenador y iPhone, con una interfaz oscura y adaptable. Código en GitHub; aplicación y datos en **Cloudflare Workers + D1**.

## Primera versión

- **Mi mundo:** globo 3D con fronteras reales, giro con ratón o tacto, zoom y navegación con las flechas del teclado. Toca un punto para guardar un lugar, país, fecha y recuerdo. También puedes introducir coordenadas. Los viajes empiezan vacíos.
- **Hábitos:** hábitos personalizados, marcación diaria, historial mensual y racha actual. Puedes corregir días anteriores.
- **Tareas:** crear, editar, priorizar, fechar, completar, reabrir y eliminar. Filtros de pendientes, hechas y todas.
- **Diario:** entradas con fecha y estado de ánimo. Sección provisional.
- **Resumen:** actividad real de los últimos siete días, tareas completadas y rachas. Sección provisional.
- Clave privada, sesión HttpOnly y datos persistentes. La vista de prueba usa datos temporales y está claramente identificada.
- Manifest e iconos para instalación. El service worker conserva solo la aplicación, nunca respuestas privadas de la API. Se necesita conexión para cargar y guardar datos. No hay edición sin conexión ni notificaciones push en esta versión.

## Publicar en tu cuenta de Cloudflare

**Todavía no está desplegada.** No se incluyen credenciales ni un identificador real de base de datos.

### Opción A: asistente de despliegue

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Guilleeeeeeeeee/Orbita)

El asistente oficial puede crear los recursos D1 y solicitar la clave `ORBITA_PASSWORD`. Usa una clave privada de **16 caracteres como mínimo**, preferiblemente generada por un gestor de contraseñas. No la envíes por chat ni la guardes en el repositorio.

**Este asistente crea una copia del repositorio en tu cuenta de GitHub.** Si quieres seguir trabajando exactamente en `Guilleeeeeeeeee/Orbita`, usa la opción B. Revisa qué repositorio queda conectado antes de continuar haciendo cambios.

Configuración esperada:

| Campo | Valor |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Base de datos | D1, binding `DB` |
| Clave privada | secreto `ORBITA_PASSWORD` |

El despliegue aplica las migraciones antes de subir el Worker. Si la clave no queda configurada en el asistente, añádela en **Worker → Settings → Variables and Secrets**, tipo Secret. Sin una clave válida la API permanece bloqueada.

### Opción B: conectar este mismo repositorio

1. En Cloudflare, crea una base de datos D1 llamada `orbita-db`.
2. Sustituye `REPLACE_WITH_YOUR_D1_DATABASE_ID` en `wrangler.jsonc` por el UUID que devuelve Cloudflare. Este UUID no es una contraseña.
3. En **Workers & Pages**, crea una aplicación e importa `Guilleeeeeeeeee/Orbita` desde GitHub. Usa `orbita` como nombre del Worker y `main` como rama.
4. Configura build `npm run build` y deploy `npm run deploy`. La identidad de despliegue debe poder escribir en esa base de datos D1 y desplegar Workers. Las tablas se crean mediante las migraciones incluidas.
5. Añade el secreto `ORBITA_PASSWORD` (mínimo 16 caracteres) y aplica el cambio. Abre la dirección HTTPS que te asigne Cloudflare.

Para conectar mediante terminal, con Node 22 o superior:

```bash
npm ci
npx wrangler login
npx wrangler d1 create orbita-db
# Copia el database_id devuelto a wrangler.jsonc
npm run build
npm run deploy
npx wrangler secret put ORBITA_PASSWORD
```

GitHub aloja el código; Cloudflare aloja la app y sus datos. Revisa los límites vigentes del plan Free en tu cuenta. No se ha contratado ningún plan ni dominio.

## Instalar en el iPhone 15

Abre la **URL HTTPS desplegada** en Safari → Compartir → Añadir a pantalla de inicio. Entra con tu clave privada. En ordenador, abre la misma dirección en Chrome o Edge y utiliza el icono de instalación de la barra de direcciones. También funciona sin instalar, como una web normal.

Los datos se cargan al abrir la app; **Ajustes → Actualizar datos** recupera los cambios realizados en el otro dispositivo. Si dos dispositivos editan a partir de versiones distintas, el servidor rechaza la escritura antigua para evitar sobrescribir cambios. Copia cualquier texto pendiente antes de recargar. No hay sincronización en tiempo real.

## Desarrollo local

```bash
npm ci
cp .dev.vars.example .dev.vars
# Define una clave solo local de al menos 16 caracteres en .dev.vars
npm run build
npm run db:local
npm start
```

`npm start` sirve el Worker y los assets con D1 local. Para editar con recarga automática, mantén Wrangler en el puerto 8787 y ejecuta `npm run dev` en otra terminal. Vite usa el puerto 4173 y redirige `/api` al Worker local. No subas `.dev.vars`, `.wrangler/` ni datos personales.

## Validación

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

Las pruebas comprueban las cinco vistas y operaciones principales con un DOM de prueba, persistencia mediante SQLite, sesión, rechazo de escrituras sin permiso, límite de intentos de inicio de sesión, validación de datos y conflictos entre dispositivos. No equivalen a una prueba visual en Safari o a una instalación en un iPhone físico. El despliegue real y la instalación deben verificarse tras conectar Cloudflare.

## Estructura

- `src/`: interfaz y globo Three.js.
- `worker/index.js`: API y acceso privado.
- `migrations/`: esquema D1 versionado.
- `public/`: iconos, manifest y cabeceras.
- `scripts/build-sw.mjs`: precaché versionada de la PWA.
- `wrangler.jsonc`: configuración Cloudflare.

Mapas: `world-atlas`, basados en Natural Earth (dominio público). Iconos: Lucide (ISC). Tipografías: DM Sans y Manrope, incluidas localmente mediante Fontsource (SIL OFL). No hay peticiones de fuentes ni mapas a terceros en ejecución.
