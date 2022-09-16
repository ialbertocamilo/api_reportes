const { extension } = require('./config')
const moment = require('moment')

// moment('es')
exports.response = (responseData) => {
  const { createAt, modulo, error, alert } = responseData
  if (modulo) {
    return {
      ruta_descarga: 'reports/' + createAt + extension,
      createAt,
      modulo,
      new_name: `${modulo}_${moment(createAt).format("L")}`
    }
  }
  return responseData
}
