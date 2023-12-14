const { extension } = require('./config')
const moment = require('moment')
const { generateReportPath } = require('./helper/Queue')

// moment('es')
exports.response = (responseData) => {
  const { createAt, modulo, error, alert,file_ext } = responseData
  if (modulo) {
    console.log(modulo,createAt,file_ext);
    return {
      ruta_descarga: generateReportPath(createAt,file_ext),
      createAt,
      modulo,
      new_name: `${modulo}_${moment(createAt)
        .tz('America/Lima')
        .format('YYYY-MM-DD HH:mm')}`
    }
  }
  return responseData
}
