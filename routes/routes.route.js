const { Router } = require('express')
const router = Router()
const db = require('../db')
const handler = require('./index')
const {
  isServerAvailable,
  registerInQueue,
  markReportAsReady,
  startNextReport, findNextPendingReport
} = require('../helper/Queue')
const { fork } = require('child_process')
const { reportErrorInSlackError } = require('../helper/Slack')
const { uploadFile,downloadFile } = require('../s3/storage')

module.exports = function (io) {
  router.get('/', async (req, res) => {
    console.log(db.con)
    res.send({ response: 'Bienvenido a la api Node 3.0.0' })
  })

  //  Reports with standard responses
  // ========================================

  router.post('/supervisores_notas', handler.supervisores_notas2)
  router.post('/supervisores_notas_temas', handler.supervisores_notas_temas)
  router.post('/supervisores_avance_curricula', handler.supervisores_avance_curricula)
  router.post('/notas_usuario', handler.notasUsuario2)
  router.post('/notas_usuario_v3', handler.notasUsuario3)
  router.post('/historial_usuario', handler.historialUsuario)
  router.post('/poll-questions', handler.poolQuestions)
  router.post('/evaluations_data', handler.evaluationsData)
  router.post('/evaluations_detail_data', handler.evaluationsDetailData)
  router.post('/asistencias', handler.assistsSessionReport)

  //  Reports with queues and push notifications
  // ========================================

  router.post('/:reportType', async ({ body, params, headers }, res) => {
    const protocol = process.env.IS_LOCALHOST == 1 ? 'http' : 'https'
    const reportType = params.reportType
    const reportName = body.reportName || reportType
    const filtersDescriptions = body.filtersDescriptions
    const skipQueue = !!body.skipQueue
    delete body.filtersDescriptions
    delete body.skipQueue
    const ext = body.ext || '.xlsx'

    let isAvailable = await isServerAvailable(body.workspaceId, body.adminId)

    if (!skipQueue) {
      await registerInQueue(reportType, reportName, body.workspaceId, body.adminId, body, filtersDescriptions,ext)
    }

    if (skipQueue) {
      isAvailable = true
    }

    if (isAvailable) {
      // Execute report in a child process
      const children = fork(getReportFilePath(reportType), { silent: true })

      // Print child process' console logs
      children.stdout.on('data', data => console.log(data.toString()))

      // Print child process' error log and report error to Slack
      children.stderr.on('data', async (data) => {

        // When report execution has finished, notify user
        await reportFinishedHandler(protocol, headers, children, io, reportType, reportName, body, null, true,ext)

        // Print error log
        console.log(data.toString())
      })

      children.on('message', async (result) => {
        const hasError = !!result.error
        // When report execution has finished, notify user
        await reportFinishedHandler(
          protocol, headers, children, io, reportType, reportName, body,
          hasError ? null : result,
          hasError,ext
        )
      })

      // Send request values to child process to execute report

      children.send(body)

      res.json({ result: 'response will be sent over IO' })
    } else {
      res.send({ serverIsBusy: true })
    }
  })

  return router
}

/**
 * Mark report as ready, broadcast result and start next report
 * @returns {Promise<void>}
 */
const reportFinishedHandler = async (protocol, headers, children, io, reportType, reportName, body, result, failed,ext) => {

  const rutaDescarga = result ? result.ruta_descarga : ''
  await markReportAsReady(
    reportType,
    rutaDescarga || '',
    body.workspaceId,
    body.adminId,
    body,
    failed
  )

  if (failed) {
    await reportErrorInSlackError(`
      Error in report execution
      WorkspaceId: ${body.workspaceId}
      Report type: ${reportType}
      File: ${getReportFilePath(reportType)}
    `)
  }
  uploadFile(rutaDescarga)  

  // Broadcast event to frontend

  let message = `No se encontraron resultados para tu reporte "${reportName}".`
  let success = false
  let nombreArchivo = ''
  if (rutaDescarga) {
    message = `Tu reporte "${reportName}" se encuentra listo.`
    success = true
    const partes = rutaDescarga.split('/');
    nombreArchivo = partes[partes.length - 1];    
  }
  const urlS3 = await downloadFile(nombreArchivo)
  console.log(urlS3,'urlDownload')
  console.log('Notify user: report-finished')
  io.sockets.emit('report-finished', {
    adminId: body.adminId,
    success,
    message,
    name: reportName,
    url: urlS3 || null,
    ext:ext
  })
  // Start the next report
  console.log('findNextPendingReport');
  const nextReport = await findNextPendingReport(body.workspaceId)
  console.log(nextReport);
  if (nextReport) {
    console.log('emit: report-started');
    io.sockets.emit('report-started', {
      report: nextReport,
      adminId: body.adminId
    })
    // Submit a request to start report
    console.log('startNextReport');
    startNextReport(nextReport, protocol + '://' + headers.host)
  }
  console.log('children.kill');
  children.kill()
}

/**
 * Get the controller's path for each report type
 * @param reportType
 * @returns {string}
 */
function getReportFilePath (reportType) {
  let file
  switch (reportType) {
    case 'ranking': file = 'ranking.js'; break
    case 'historial_usuario': file = 'historial_usuario.js'; break
    case 'usuarios': file = 'usuarios.js'; break
    case 'consolidado_cursos': file = 'consolidado_cursos_v2.js'; break
    case 'segmentation': file = 'segmentation.js'; break
    case 'consolidado_temas': file = 'consolidado_temas_v3.js'; break
    case 'visitas': file = 'visitas.js'; break
    case 'reinicios': file = 'reinicios.js'; break
    case 'evaluaciones_abiertas': file = 'eva_abiertas_v2.js'; break
    case 'temas_no_evaluables': file = 'temas_no_evaluables_v2.js'; break
    case 'user_uploads': file = 'user_uploads.js'; break
    case 'checklist_general': file = 'checklist_general.js'; break
    case 'checklist_detallado': file = 'checklist_detallado_v2.js'; break
    case 'videoteca': file = 'videoteca.js'; break
    case 'vademecum': file = 'vademecum.js'; break
    case 'diplomas': file = 'diplomas2.js'; break
    case 'avance_curricula': file = 'avance_curricula.js'; break
    case 'empty_criteria': file = 'empty_criteria.js'; break
    case 'votaciones': file = 'votaciones.js'; break
    case 'benefit_report': file = 'benefit_report.js'; break
    case 'user_benefit_report': file = 'user_benefit_report.js'; break
    case 'users_history': file = 'users_history.js'; break
    case 'evaluations_excel': file = 'evaluations_excel.js'; break
    case 'evaluations_detail_excel': file = 'evaluations_detail_excel.js'; break
    case 'dc3-report': file = 'dc3-report';break;
    case 'registro_capacitacion': file = 'registro_capacitacion';break;
  }

  return `./controllers/${file}`
}
