const { Router } = require('express')
const router = Router()
const db = require('../db')
const handler = require('./index')
const { ReportTypes } = require('../helper/Enums')
const {
  isServerAvailable,
  registerInQueue,
  markReportAsReady,
  startNextReport
} = require('../helper/Queue')
const { fork } = require('child_process')

module.exports = function (io) {
  router.get('/', async (req, res) => {
    console.log(db.con)
    res.send({ response: 'Bienvenido a la api Node 3.0.0' })
  })

  //  Reports with responses
  // ========================================

  router.post('/supervisores_notas', handler.supervisores_notas2)
  router.post('/supervisores_avance_curricula', handler.supervisores_avance_curricula)
  router.post('/notas_usuario', handler.notasUsuario2)
  router.post('/historial_usuario', handler.historialUsuario)

  //  Reports with push notifications
  // ========================================

  router.post('/:reportPath', async ({ body, params }, res) => {

    const reportType = ReportTypes[params.reportPath]
    const reportName = body.reportName || reportType
    const filtersDescriptions = body.filtersDescriptions
    const skipQueue = !!body.skipQueue
    delete body.filtersDescriptions
    delete body.skipQueue

    let isAvailable = await isServerAvailable(body.workspaceId, body.adminId)

    if (!skipQueue) {
      await registerInQueue(reportType, reportName, body.workspaceId, body.adminId, body, filtersDescriptions)
    }

    if (skipQueue) {
      isAvailable = true
    }

    if (isAvailable) {

      // Process report

      const children = fork(getReportFilePath(reportType))
      children.send(body)
      children.on('message', async (result) => {
        children.kill()

        await markReportAsReady(
          reportType,
          result.alert ? '' : result.ruta_descarga,
          body.workspaceId,
          body.adminId,
          body
        )

        // Start the next report

        startNextReport(reportType)

        // Broadcast event to frontend

        let message
        let success = false
        if (result.alert) {
          message = `No se encontraron resultados para tu reporte "${reportName}".`
        } else {
          message = `Tu reporte "${reportName}" se encuentra listo.`
          success = true
        }
        io.sockets.emit('report-finished', {
          adminId: body.adminId,
          success,
          message,
          name: reportName,
          url: result.ruta_descarga
        })
      })

      res.json({ result: 'response will be sent over IO' })
    } else {
      res.send({ serverIsBusy: true })
    }
  })

  return router
}

function getReportFilePath (reportType) {
  let file
  switch (reportType) {
    case ReportTypes.ranking: file = 'ranking.js'; break
    case ReportTypes.historial_usuario: file = 'historial_usuario.js'; break
    case ReportTypes.usuarios: file = 'usuarios.js'; break
    case ReportTypes.consolidado_cursos: file = 'consolidado_cursos_v2.js'; break
    case ReportTypes.segmentation: file = 'segmentation.js'; break
    case ReportTypes.consolidado_temas: file = 'consolidado_temas_v3.js'; break

    case ReportTypes.visitas: file = 'visitas.js'; break
    case ReportTypes.reinicios: file = 'reinicios.js'; break
    case ReportTypes.evaluaciones_abiertas: file = 'eva_abiertas_v2.js'; break
    case ReportTypes.temas_no_evaluables: file = 'temas_no_evaluables_v2.js'; break

    case ReportTypes.user_uploads: file = 'user_uploads.js'; break
    case ReportTypes.checklist_general: file = 'checklist_general.js'; break
    case ReportTypes.checklist_detallado: file = 'checklist_detallado.js'; break
    case ReportTypes.videoteca: file = 'videoteca.js'; break
    case ReportTypes.vademecum: file = 'vademecum.js'; break
    case ReportTypes.diplomas: file = 'diplomas2.js'; break
    case ReportTypes.avance_curricula: file = 'avance_curricula.js'; break
    case ReportTypes['poll-questions']: file = 'poolQuestions.js'; break
  }

  return `./controllers/${file}`
}
