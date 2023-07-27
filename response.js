const moment = require('moment')
const { generateReportPath } = require('./helper/Queue')
const {downloadFile} = require('./s3/storage')
const { extension } = require('./config')

// moment('es')
exports.response = async (responseData) => {
  const { createAt, modulo, error, alert } = responseData
  const url = await downloadFile(createAt+extension)
  if (modulo) {
    return {
      ruta_descarga: url,
      createAt,
      modulo,
      new_name: `${modulo}_${moment(createAt)
        .tz('America/Lima')
        .format('YYYY-MM-DD HH:mm')}`
    }
  }
  return responseData
}
