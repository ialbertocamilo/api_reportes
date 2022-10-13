const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
const { CARPETA_DESCARGA } = require("./config");
// Cron schedule = sec | min | hour | day | month | dayofweek

cron.schedule("0 0 3 * * *", () => {
  borrarArchivos(CARPETA_DESCARGA);
});

function borrarArchivos(_path) {
  fs.readdir(_path, function (err, files) {
    if (err) return console.log("No se puede escanear el directorio: " + err);

    files.forEach(function (file) {
      const extension = path.extname(file);
      if (extension == ".xlsx" || extension == ".csv") {
        fs.unlink(_path + file, (err) => {
          if (!err) {
            console.log("El Archivo : " + file + " se borro.");
          }
        });
      }
    });
    console.log("Termino el proceos de borrado");
  });
}
