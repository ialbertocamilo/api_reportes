const Excel = require('exceljs')
const _ = require('lodash')
const { CARPETA_DESCARGA_TEST, extension } = require('./config')

const fs = require('fs')
if (CARPETA_DESCARGA_TEST && !fs.existsSync(CARPETA_DESCARGA_TEST)) {
  console.log('La carpeta de DESCARGA no existe, creandola en ' + CARPETA_DESCARGA_TEST)
  fs.mkdirSync(CARPETA_DESCARGA_TEST)
}

const createAt = Date.now()
const name = createAt + extension
const options = {
  filename: CARPETA_DESCARGA_TEST + name,
  useStyles: true,
  useSharedStrings: true
}

const workbook = new Excel.stream.xlsx.WorkbookWriter(options)
const worksheet = workbook.addWorksheet('sheet')

worksheet.getRow(1).font = { bold: true }

const createHeaders = async function (headersAgregados, headersFijos) {
  let Fijos = headersFijos ? await headersFijos() : []
  let $Headers = _.concat(Fijos, headersAgregados)
  const array = []
  $Headers.forEach(el => {
    const json = {}
    json.header = el
    array.push(json)
  })

  worksheet.columns = array
}
//
module.exports = {
  workbook,
  worksheet,
  createHeaders,
  createAt
}
