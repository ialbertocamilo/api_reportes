if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

// Remove start and final slashes of path

const CARPETA_DESCARGA = process.env.CARPETA_DESCARGA.replace(/^\/|\/$/g, '')
const CARPETA_DESCARGA_TEST = process.env.CARPETA_DESCARGA_TEST.replace(/^\/|\/$/g, '')

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE: process.env.DB_NAME,
  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASS,

  CARPETA_DESCARGA: CARPETA_DESCARGA,
  CARPETA_DESCARGA_TEST: CARPETA_DESCARGA_TEST,

  extension: '.xlsx',
  URL_TEST: process.env.URL
}
