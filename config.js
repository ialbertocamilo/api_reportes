if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Remove start and final slashes of path

const CARPETA_DESCARGA = process.env.CARPETA_DESCARGA.replace(/^\/|\/$/g, "");
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME
const AWS_BUCKET_REGION = process.env.AWS_BUCKET_REGION
const AWS_PUBLIC_KEY = process.env.AWS_PUBLIC_KEY
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY
const AWS_ENDPOINT = process.env.AWS_ENDPOINT
const MARCA = process.env.MARCA

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PORT: process.env.DB_PORT || 3306,
  DATABASE: process.env.DB_NAME,
  HOST: process.env.DB_HOST,
  HOST_WRITE: process.env.DB_HOST_WRITE,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASS,

  CARPETA_DESCARGA: CARPETA_DESCARGA,

  extension: ".xlsx",
  URL_TEST: process.env.URL,
  AWS_BUCKET_NAME, AWS_BUCKET_REGION, AWS_PUBLIC_KEY, AWS_SECRET_KEY, AWS_ENDPOINT,MARCA
};
