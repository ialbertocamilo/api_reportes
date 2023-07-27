const { extension } = require('./config')
const moment = require('moment')
const { generateReportPath } = require('./helper/Queue')

// moment('es')
exports.response = (responseData) => {
  const { createAt, modulo, error, alert } = responseData
  if (modulo) {
    return {
      ruta_descarga: generateReportPath(createAt),
      createAt,
      modulo,
      new_name: `${modulo}_${moment(createAt)
        .tz('America/Lima')
        .format('YYYY-MM-DD HH:mm')}`
    }
  }
  return responseData
}
