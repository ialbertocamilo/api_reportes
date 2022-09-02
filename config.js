if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE: process.env.DB_NAME,
  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASS,

  CARPETA_DESCARGA: process.env.CARPETA_DESCARGA ? `../html/${process.env.CARPETA_GESTOR + process.env.CARPETA_DESCARGA}` : '',
  CARPETA_DESCARGA_TEST: process.env.CARPETA_DESCARGA ? `../html/${process.env.CARPETA_GESTOR_TEST + process.env.CARPETA_DESCARGA}` : '',

  extension: '.xlsx',
  URL_TEST: process.env.URL,
}
