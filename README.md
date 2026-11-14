# Mini portal de Colombia con API

Portal web educativo que consulta datos públicos de API Colombia y los presenta de forma dinámica. El proyecto explora los departamentos del país y sus atractivos turísticos.

**Estudiante:** Andres Felipe Vasquez Velasco  
**Nombre sugerido para el repositorio público:** `andres-vasquez-api-colombia`

## Secciones del portal

- **Departamentos:** muestra región, capital, población, superficie, municipios y descripción. Incluye conteo por región, búsqueda y filtro por región, y presenta hasta 15 resultados por página.
- **Atractivos turísticos:** muestra los primeros 20 registros de la API con ciudad, departamento, descripción e imagen. La búsqueda se limita a esos 20 lugares.
- **Inicio:** enlaza las dos secciones y presenta la fuente de los datos.

## Tecnologías

- HTML5
- CSS3, con estilos adaptables a pantallas pequeñas
- JavaScript sin frameworks
- Fetch API y JSON
- API pública API Colombia

## Fuente y endpoints

API Colombia: <https://api-colombia.com/>

- Departamentos: `https://api-colombia.com/api/v1/Department`
- Regiones: `https://api-colombia.com/api/v1/Region`
- Atractivos: `https://api-colombia.com/api/v1/TouristicAttraction`

El portal relaciona `Department.regionId` con los identificadores de `/Region`. Para atractivos, toma la ciudad desde `city` y relaciona `city.departmentId` con los departamentos. La ruta sin `pagedList` devuelve una lista; la variante paginada devuelve los registros dentro de `data`.

La lista de atractivos usa las primeras 20 entradas en el orden recibido de la API. Las búsquedas de ambas secciones se hacen sobre los datos ya cargados y no vuelven a consultar el servidor.

La ruta `/api/v1/TouristicAttraction/pagedList` tiene una respuesta distinta: contiene metadatos de página y los atractivos dentro de `data`. Este portal usa la ruta de lista indicada en la actividad.

## Ejecutar en local

El sitio no necesita instalación de paquetes ni proceso de compilación. Sírvelo desde la carpeta del proyecto para que el navegador pueda usar `fetch`:

1. Abre una terminal en la carpeta del repositorio.
2. Ejecuta:

   ```powershell
   python -m http.server 5500
   ```

3. Abre <http://localhost:5500> en el navegador.

También puedes abrir `index.html` con la extensión Live Server de Visual Studio Code.

## Caché y manejo de errores

- Las respuestas se guardan en `localStorage` durante 24 horas para evitar consultas repetidas.
- Las solicitudes tienen un límite de espera de 12 segundos.
- El portal muestra estados de carga, error y ausencia de resultados.
- Ante una respuesta `429`, muestra el tiempo indicado por `Retry-After` y, si el encabezado incluye un plazo, espera antes de habilitar el reintento.
- Los campos de texto de la API se insertan con `textContent`.

La documentación de API Colombia indica que los endpoints de departamentos, ciudades y festivos comparten un límite de 60 solicitudes por minuto por IP; recomienda cachear las respuestas y respetar `Retry-After`: <https://docs.api-colombia.com/rate-limiting.html>.

## Imágenes

Se muestran primero las imágenes suministradas en los registros de atractivos. Si una imagen falta o no carga, el portal intenta reemplazarla con una fotografía de referencia de [Unsplash](https://unsplash.com/es/s/fotos/paisaje-de-colombia) y después con una imagen de [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:P%C3%B3rtico_Hacienda_N%C3%A1poles.JPG). La tarjeta enlaza a la fuente usada.

## Estructura del proyecto

```text
.
├── index.html
├── departamentos.html
├── atractivos.html
├── css/
│   └── styles.css
└── js/
    ├── api.js
    ├── site.js
    ├── departments.js
    └── attractions.js
```
