# Dashboard de Voces que Corren para Netlify

Dashboard aislado de solo lectura. La interfaz se publica como sitio estático y los datos se consultan mediante `netlify/functions/dashboard-data.js`.

## Configuración en Netlify

1. Crea un sitio nuevo apuntando a la carpeta `dashboard-netlify` o a un repositorio cuyo directorio base sea esa carpeta.
2. En **Site configuration → Environment variables**, agrega únicamente:

   ```text
   DATABASE_URL=postgresql://...
   ```

3. Netlify detectará `netlify.toml`, instalará `pg` y publicará `index.html`.

La cadena queda disponible únicamente para la Function; nunca se inserta en el HTML del navegador.

## Prueba local

```bash
npm install
npm run dev
```

La vista quedará disponible en `http://localhost:8000`.

El servidor local incluye la misma ruta de datos que Netlify:
`/.netlify/functions/dashboard-data`.

El dashboard consulta datos en modo solo lectura y se actualiza automáticamente cada tres minutos. No contiene rutas de escritura, confirmación ni reenvío de correos.
