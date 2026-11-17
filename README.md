# Simulador de API REST de usuarios (Node.js)

Versión para Node.js del [simulador en Python](../Simulacion_Api/).
Simula un endpoint REST `GET /api/v1/usuarios/{id}`.
No necesita servidor ni librerías externas: imita en memoria cómo responde una API real,
con código de estado, cabeceras HTTP y cuerpo JSON, como lo verías en Postman.

## Requisitos

- Node.js **18** o superior (usa módulos ES y `await` de nivel superior)
- Sin dependencias externas

## Ejecutar la demo

```bash
node simulador_api.js
# o
npm start
```

Por cada caso muestra:

1. El código JavaScript que hace la llamada
2. El equivalente con `curl`
3. La petición HTTP
4. La respuesta HTTP completa (estado, cabeceras y JSON)
5. Lo que imprime el código

## Casos incluidos

| Caso | Entrada | Resultado |
|------|---------|-----------|
| 1 | `1` | `200 OK`: usuario existente |
| 2 | `3` | `200 OK`: usuario inactivo |
| 3 | `99` | `404 Not Found` |
| 4 | `-5` | `400 Bad Request`: ID negativo |
| 5 | `"abc"` | `400 Bad Request`: ID que no es número |
| 6 | `2`, `{ tasaError: 1 }` | `500 Internal Server Error` |

## Usarlo desde tu código

```js
import { obtenerUsuario } from "./simulador_api.js";

const respuesta = await obtenerUsuario(1);
console.log(respuesta.statusCode);  // 200
console.log(respuesta.json());      // { data: { id: 1, nombre: 'Ana López', ... } }
console.log(respuesta.headers);     // Content-Type, Date, X-Request-Id, ...
console.log(respuesta.comoHttp());  // respuesta completa en formato HTTP
```

`obtenerUsuario` es asíncrona (devuelve una `Promise`), igual que una llamada real con `fetch`.

### Parámetros de `obtenerUsuario`

| Parámetro | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `userId` | `number` | — | ID del usuario (entero positivo) |
| `opciones.latencia` | `[number, number]` | `[0.05, 0.2]` | Rango en segundos de la demora de red simulada |
| `opciones.tasaError` | `number` | `0` | Probabilidad (0 a 1) de devolver un error 500 |

### Equivalencias con la versión Python

| Python | Node.js |
|--------|---------|
| `obtener_usuario(1, tasa_error=1.0)` | `await obtenerUsuario(1, { tasaError: 1 })` |
| `respuesta.status_code` | `respuesta.statusCode` |
| `respuesta.json()` | `respuesta.json()` |
| `respuesta.headers` | `respuesta.headers` |
| `respuesta.como_http()` | `respuesta.comoHttp()` |
| `respuesta.to_json()` | `respuesta.toJSONString()` |
| `respuesta.ok` / `respuesta.url` | `respuesta.ok` / `respuesta.url` |

## Ejemplo de respuesta

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
X-Request-Id: 6f1c...
X-Response-Time: 123.45 ms

{
  "data": {
    "id": 1,
    "nombre": "Ana López",
    "email": "ana@ejemplo.com",
    "activo": true
  }
}
```

Respuesta de error:

```json
{
  "error": {
    "codigo": 404,
    "tipo": "NOT_FOUND",
    "mensaje": "Usuario 99 no encontrado"
  }
}
```
