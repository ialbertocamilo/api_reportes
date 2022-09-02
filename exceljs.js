const Excel = require('exceljs')
const _ = require('lodash')
const { CARPETA_DESCARGA, extension } = require('./config')

const fs = require('fs')
if (CARPETA_DESCARGA && !fs.existsSync(CARPETA_DESCARGA)) {
  console.log('La carpeta de DESCARGA no existe, creandola en ' + CARPETA_DESCARGA)
  fs.mkdirSync(CARPETA_DESCARGA)
}

const createAt = Date.now()
const name = createAt + extension
const options = {
  filename: CARPETA_DESCARGA + name,
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
