# Reportes para San Pablo

Servicio de APIs para reportes em gestor y en app Cursalab v2.

###Requerimientos

- Node <= 12

## Comenzando 🚀

_Esta api sirve a el modulo de reportes desde el uso de los filtros, hasta la generacion de los reportes en formato .xlsx._

###### https://api.reportes.DOMINIO/api/node/exportar/

## Ramas

main -> para producción
testing -> para testing

### Primeros pasos 📋

Clonar

```
git clone http:///
```

Instalar despendencias

```
npm install
```

Iniciar el servidor de desarrollo

```
npm run dev
```

Iniciar el servidor de pm2 _(Solo producción)_

```
npm run pm2
```

<!-- ### Instalación 🔧

_Una serie de ejemplos paso a paso que te dice lo que debes ejecutar para tener un entorno de desarrollo ejecutandose_

_Dí cómo será ese paso_

```
Da un ejemplo
```

_Y repite_

```
hasta finalizar
``` -->

_Puedes ver tambien los comandos en el paquete package.json > scripts_

# HTTP Request

Para usar el api se necesita enviar los datos al endpoint que se muestran a continuación

<!--  -->

#### Notas usuario `Valores` `POST`

- Valores necesarios : `si`
- Tipos de datos
  - dni : `int`

```
POST  /notas_usuario
{
  "dni": "11111111"
}
```

<!--  -->

#### Usuarios `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos
  - modulo : `int`
  - carrera : `array`

```
POST  /usuarios
{
  "modulo": 8,
  "carrera": [
    49,
    50,
    51
  ]
}
```

<!--  -->

#### Visitas `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos :
  - modulo : `int`
  - carrera : `array`

```
POST  /visitas
{
  "modulo": 8,
  "carrera": [
    49,
    50,
    51
  ]
}
```

<!--  -->

#### Notas por tema `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos
  - Integer :
    - modulo
    - escuela
    - curso
    - tema
  - String :
    - start
    - end
  - Boolean
    - aprobados
    - desaprobados
    - temasActivos
    - temasInactivos

```
POST  /notas_tema
{
  "modulo": 9,
  "escuela": 67,
  "curso": 575,
  "tema": 2155,
  "start": "2020-12-24",
  "end": "",
  "aprobados": true,
  "desaprobados": true,
  "temasActivos": true,
  "temasInactivos": true
}
```

<!--  -->

#### Notas por curso `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos
  - Integer :
    - modulo
    - escuela
    - curso
  - String :
    - start
    - end
  - Boolean
    - aprobados
    - desaprobados
    - pendientes
    - realizados
    - cursosActivos
    - cursosInactivos

```
POST  /notas_curso
{
  "modulo": 9,
  "escuela": 67,
  "curso": 575,
  "start": "2020-12-08",
  "end": "2020-12-30",
  "aprobados": true,
  "desaprobados": true,
  "pendientes": true,
  "realizados": true,
  "cursosActivos": true,
  "cursosInactivos": true
}
```

<!--  -->

#### Evaluaciones abiertas `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos
  - Integer :
    - modulo
    - escuela
    - curso
    - tema
  - String :
    - start
    - end

```
POST  /evaluaciones_abiertas
{
  "modulo": 14,
  "escuela": 72,
  "curso": "",
  "tema": "",
  "start": "2020-12-30",
  "end": "2020-12-31"
}
```

<!--  -->

#### Reinicios `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos
  - Integer :
    - admin
  - String :
    - tipo
    - start
    - end

```
POST  /reinicios
{
  "admin": 34,
  "tipo": "por_tema",
  "start": "2020-12-09",
  "end": "2020-12-05"
}
```

<!--  -->

#### Versiones usadas `Reporte` `GET`

```
GET  /versiones_usadas
```

<!--  -->

#### Cursos pendientes `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos`int`

```
POST  /cursos_pendientes
{
  "modulo": 8,
  "escuela": 66,
  "curso": 574
}
```

<!--  -->

#### Consolidado por cursos `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos
  - Integer :
    - modulo
    - escuela
    - curso
  - String :
    - start
    - end
  - Boolean :
    - completados
    - pendientes

```
POST  /consolidado_cursos
{
  "modulo": 8,
  "escuela": 66,
  "curso": 574,
  "start": "",
  "end": "",
  "completados": true,
  "pendientes": true
}
```

<!--  -->

#### Consolidado por temas `Reporte` `POST`

- Valores necesarios : `no`
- Tipos de datos
  - Integer :
    - modulo
    - escuela
    - curso
    - tema
  - String :
    - start
    - end
  - Boolean :
    - aprobados
    - desaprobados
    - pendientes
    - temasActivos
    - temasInactivos

```
POST  /consolidado_temas
{
  "modulo": 9,
  "escuela": 67,
  "curso": 575,
  "tema": 2165,
  "start": "",
  "end": "",
  "aprobados": true,
  "desaprobados": true,
  "pendientes": true,
  "temasActivos": true,
  "temasInactivos": true
}
```

<!--  -->

# HTTP Response

### Reportes

- createAt : `UNIX_TIMESTAMP`
  - Es el nombre del archivo descargado en formato `UNIX_TIMESTAMP`.
    Esto se usa para encontrar el archivo en el `/storage` de laravel y descargarlo con un nuevo nombre desde el cliente
- modulo : `String`
  - Nombre del modulo que se usara como un nuevo nombre para el archivo .xlsx
- extension : `String`
  - Extension que usara el nuevo archivo para completar la creación de este.

```
{
  "createAt": 1608333441649,
  "modulo": "Consolidado_Tema",
  "extension": ".xlsx"
}
```

### Valores

- Tipo de datos : `Object`
- Usuarios
  - Datos basicos del usuario
- Notas
  - Informacion de su avance

```
{
  "Usuario": {
    "Nombres": "pruebas",
    "Modulo": "GRUPO SAN PABLO (pruebas)",
    "Carrera": "BACK OFFICE",
    "Ciclo": "GRUPO OCUPACIONAL 1"
  },
  "Notas": [
    {
      "Escuela": "Escuela 1",
      "Curso": "¡Bienvenidos a todos al Grupo San Pablo!",
      "Tema": "Tema 3 Libre",
      "Nota": null,
      "Estado": "Desaprobado",
      "Ultima evaluación": "24/11/2020",
      "_cellVariants": {
        "Estado": "danger"
      }
    }
  ]
}
```

<!--  -->

## Paquetes 📦

- [Cron](https://github.com/node-cron/node-cron) - Ejecuta tareas en un momento especifico
- [ExcelJS](https://github.com/exceljs/exceljs#readme) - Importa/Exporta/Maneja excel en formato .xslx
- [mysql2](https://github.com/sidorares/node-mysql2#readme) - Cliente MySQL para Node.JS
- [pm2](pm2.keymetrics.io/) - Administrador de procesos para producción
- [Express](https://expressjs.com/) - Framework web para Node.JS
- [morgan](https://github.com/expressjs/morgan#readme) - Framework web para Node.JS

## Versionado 📌

Por el momento no se esta implementando el sistema de versionado v1/v2/v3, ya que por la necesidad de rapidez todo se trabajo en una sola version.
_Proximamente necesario como una buena practica._

<!-- ## Licencia 📄

Este proyecto está bajo la Licencia (Tu Licencia) - mira el archivo [LICENSE.md](LICENSE.md) para detalles

## Expresiones de Gratitud 🎁

* Comenta a otros sobre este proyecto 📢
* Invita una cerveza 🍺 o un café ☕ a alguien del equipo.
* Da las gracias públicamente 🤓.
* etc.

 -->
