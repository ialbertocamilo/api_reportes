const defaultMsg = 'No se pudo descargar el reporte. Por favor vuelva a intentarlo más tarde, o comuníquese con el administrador'

process.on('unhandledRejection', (error) => {
  console.log(error)
  process.send({
    error: defaultMsg,
    info: error.message
  })
  process.exit()
})
process.on('uncaughtException', (error) => {
  console.log(error)
  process.send({
    error: defaultMsg,
    info: error.message
  })
  process.exit()
})
