if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Remove start and final slashes of path

const CARPETA_DESCARGA = process.env.CARPETA_DESCARGA.replace(/^\/|\/$/g, "");

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PORT: process.env.DB_PORT || 3306,
  DATABASE: process.env.DB_NAME,
  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASS,

  CARPETA_DESCARGA: CARPETA_DESCARGA,

  extension: ".xlsx",
  URL_TEST: process.env.URL,
};
