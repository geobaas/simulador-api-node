/**
 * Simulador de una API REST de usuarios (Node.js 18+).
 *
 * Uso:
 *   import { obtenerUsuario } from "./simulador_api.js";
 *   const respuesta = await obtenerUsuario(1);
 *   console.log(respuesta.statusCode);  // 200
 *   console.log(respuesta.json());      // { data: { ... } }
 *
 * Ejecuta `node simulador_api.js` para ver, por cada caso, el código que
 * hace la llamada, la petición HTTP y la respuesta HTTP completa (estado,
 * cabeceras y cuerpo JSON), igual que en Postman o en la documentación de una API.
 */

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as esperar } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { inspect } from "node:util";

export const HOST = "api.ejemplo.com";
export const BASE_PATH = "/api/v1";

/** Códigos de estado HTTP que usa el simulador. */
export const HTTPStatus = Object.freeze({
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
});

const FRASES = Object.freeze({
  200: "OK",
  400: "Bad Request",
  404: "Not Found",
  500: "Internal Server Error",
});

/** Nombre del código (p. ej. 404 -> "NOT_FOUND"). */
const nombreDeStatus = (codigo) =>
  Object.keys(HTTPStatus).find((k) => HTTPStatus[k] === codigo);

/**
 * @typedef {Object} Usuario
 * @property {number} id
 * @property {string} nombre
 * @property {string} email
 * @property {boolean} activo
 */

/** Respuesta HTTP simulada: estado + cabeceras + cuerpo JSON. */
export class RespuestaAPI {
  /**
   * @param {Object} opciones
   * @param {number} opciones.statusCode
   * @param {Usuario | null} [opciones.data]
   * @param {string | null} [opciones.error]
   * @param {string} [opciones.metodo]
   * @param {string} [opciones.ruta]
   * @param {number} [opciones.latenciaMs]
   */
  constructor({
    statusCode,
    data = null,
    error = null,
    metodo = "GET",
    ruta = "/",
    latenciaMs = 0,
  }) {
    this.statusCode = statusCode;
    this.data = data;
    this.error = error;
    this.metodo = metodo;
    this.ruta = ruta;
    this.requestId = randomUUID();
    this.fecha = new Date();
    this.latenciaMs = latenciaMs;
    Object.freeze(this);
  }

  get ok() {
    return this.statusCode === HTTPStatus.OK;
  }

  get url() {
    return `https://${HOST}${this.ruta}`;
  }

  /** Cabeceras HTTP de la respuesta (los metadatos van aquí, no en el JSON). */
  get headers() {
    return {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(Buffer.byteLength(this.toJSONString(), "utf8")),
      Date: this.fecha.toUTCString(),
      "X-Request-Id": this.requestId,
      "X-Response-Time": `${this.latenciaMs} ms`,
    };
  }

  /** Cuerpo de la respuesta como objeto (igual que `await fetch(...).json()`). */
  json() {
    if (this.data !== null) {
      return { data: { ...this.data } };
    }
    return {
      error: {
        codigo: this.statusCode,
        tipo: nombreDeStatus(this.statusCode),
        mensaje: this.error,
      },
    };
  }

  /** Cuerpo de la respuesta como texto JSON. */
  toJSONString() {
    return JSON.stringify(this.json(), null, 2);
  }

  /** Respuesta completa tal como viaja por la red. */
  comoHttp() {
    const lineaEstado = `HTTP/1.1 ${this.statusCode} ${FRASES[this.statusCode]}`;
    const cabeceras = Object.entries(this.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    return `${lineaEstado}\n${cabeceras}\n\n${this.toJSONString()}`;
  }
}

// "Base de datos" en memoria
/** @type {Map<number, Readonly<Usuario>>} */
const USUARIOS = new Map(
  [
    { id: 1, nombre: "Ana López", email: "ana@ejemplo.com", activo: true },
    { id: 2, nombre: "Carlos Pérez", email: "carlos@ejemplo.com", activo: true },
    { id: 3, nombre: "María Gómez", email: "maria@ejemplo.com", activo: false },
  ].map((u) => [u.id, Object.freeze(u)]),
);

const aleatorioEntre = (min, max) => min + Math.random() * (max - min);

/**
 * Simula GET /api/v1/usuarios/{userId}.
 *
 * @param {number} userId ID del usuario a consultar (entero positivo).
 * @param {Object} [opciones]
 * @param {[number, number]} [opciones.latencia=[0.05, 0.2]] Rango (min, max) en
 *   segundos de la demora simulada de red.
 * @param {number} [opciones.tasaError=0] Probabilidad (0-1) de simular un error 500.
 * @returns {Promise<RespuestaAPI>} El usuario (200) o un mensaje de error (400/404/500).
 */
export async function obtenerUsuario(
  userId,
  { latencia = [0.05, 0.2], tasaError = 0 } = {},
) {
  const ruta = `${BASE_PATH}/usuarios/${userId}`;
  const inicio = performance.now();
  await esperar(aleatorioEntre(...latencia) * 1000);

  const responder = (statusCode, extra = {}) => {
    const ms = Math.round((performance.now() - inicio) * 100) / 100;
    return new RespuestaAPI({ statusCode, metodo: "GET", ruta, latenciaMs: ms, ...extra });
  };

  if (Math.random() < tasaError) {
    return responder(HTTPStatus.INTERNAL_ERROR, { error: "Error interno del servidor" });
  }

  // Number.isInteger descarta strings, booleanos, decimales, NaN, etc.
  if (!Number.isInteger(userId) || userId <= 0) {
    return responder(HTTPStatus.BAD_REQUEST, {
      error: "userId debe ser un entero positivo",
    });
  }

  const usuario = USUARIOS.get(userId);
  if (usuario === undefined) {
    return responder(HTTPStatus.NOT_FOUND, { error: `Usuario ${userId} no encontrado` });
  }

  return responder(HTTPStatus.OK, { data: usuario });
}

// ----------------------------------------------------------------------------
// Demostración por consola
// ----------------------------------------------------------------------------

const sangrar = (texto, prefijo = "    ") =>
  texto
    .split("\n")
    .map((linea) => (linea ? prefijo + linea : ""))
    .join("\n");

const mostrar = (valor) => inspect(valor, { depth: null, colors: false });

async function mostrarCaso(titulo, entrada, opciones) {
  const r = await obtenerUsuario(entrada, opciones);

  const args = [mostrar(entrada), ...(opciones ? [mostrar(opciones)] : [])].join(", ");
  const codigo = [
    'import { obtenerUsuario } from "./simulador_api.js";',
    "",
    `const respuesta = await obtenerUsuario(${args});`,
    "console.log(respuesta.statusCode);",
    "console.log(respuesta.json());",
  ].join("\n");
  const peticion = [
    `${r.metodo} ${r.ruta} HTTP/1.1`,
    `Host: ${HOST}`,
    "Accept: application/json",
  ].join("\n");
  const curl = `curl -i -H "Accept: application/json" ${r.url}`;

  const barra = "=".repeat(72);
  console.log(barra);
  console.log(` ${titulo}`);
  console.log(barra);
  console.log("\n▶ Código (Node.js)\n");
  console.log(sangrar(codigo));
  console.log("\n▶ Equivalente con curl\n");
  console.log(sangrar(curl));
  console.log("\n▶ Petición HTTP\n");
  console.log(sangrar(peticion));
  console.log("\n◀ Respuesta HTTP\n");
  console.log(sangrar(r.comoHttp()));
  console.log("\n◀ Salida del código\n");
  console.log(sangrar(`${r.statusCode}\n${mostrar(r.json())}`));
  console.log();
}

const esEjecucionDirecta =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  await mostrarCaso("Caso 1 · Usuario existente (200 OK)", 1);
  await mostrarCaso("Caso 2 · Usuario inactivo (200 OK)", 3);
  await mostrarCaso("Caso 3 · Usuario que no existe (404 Not Found)", 99);
  await mostrarCaso("Caso 4 · ID negativo (400 Bad Request)", -5);
  await mostrarCaso("Caso 5 · ID que no es número (400 Bad Request)", "abc");
  await mostrarCaso("Caso 6 · Fallo del servidor (500)", 2, { tasaError: 1 });
}
