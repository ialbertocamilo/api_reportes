const { fork } = require('child_process')
const { logtime } = require('../helper/Helper')

module.exports = {
  // * Usuarios
  usuarios(req, res) {
    logtime('Start report: Usuarios')
    const children = fork('./controllers/usuarios.js')
    children.send(req.body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Notas usuario
  notasUsuario({ body }, res) {
    const children = fork('./controllers/notas_usuario.js')
    children.send(body)

    children.on('message', datos => {
      res.send(datos)
      children.kill()
    })
  },
  // * Notas usuario
  notasUsuario2({ body }, res) {
    const children = fork('./controllers/notas_usuario2.js')
    children.send(body)

    children.on('message', datos => {
      res.send(datos)
      children.kill()
    })
  },
  notasUsuario3({ body }, res) {
    const children = fork('./controllers/notas_usuario3.js')
    children.send(body)

    children.on('message', datos => {
      res.send(datos)
      children.kill()
    })
  },
  // * Historial usuario
  historialUsuario ({ body }, res) {
    const children = fork('./controllers/historial_usuario.js')
    children.send(body)

    children.on('message', datos => {
      res.send(datos)
      children.kill()
    })
  },
  segmentation({body},res){
    const children = fork('./controllers/segmentation.js')
    children.send(body)
    children.on('message', datos => {
      res.send(datos)
      children.kill()
    })
  },
  // * Consolidado por curso
  consolidadoCursos({ body }, res) {
    const children = fork('./controllers/consolidado_cursos.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Consolidado por curso con compatibles
  consolidadoCursosV2({ body }, res) {
    const children = fork('./controllers/consolidado_cursos_v2.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Consolidado por temas
  consolidadoTemas({ body }, res) {
    const children = fork('./controllers/consolidado_temas_v2.js')
    // const children = fork('./controllers/consolidado_temas_v3.js')

    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  consolidadoTemasV3({ body }, res) {
    const children = fork('./controllers/consolidado_temas_v3.js')

    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  avanceCurricula({ body }, res) {
    const children = fork('./controllers/avance_curricula.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  avanceCurriculaV2({ body }, res) {
    const children = fork('./controllers/avance_curricula_v2.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Visitas
  visitas({ body }, res) {
    const children = fork('./controllers/visitas.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Reinicios
  reinicios({ body }, res) {
    const children = fork('./controllers/reinicios.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Evaluaciones abiertas
  evaluacionesAbiertas({ body }, res) {
    const children = fork('./controllers/eva_abiertas.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  evaluacionesAbiertasV2({ body }, res) {
    const children = fork('./controllers/eva_abiertas_v2.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Temas no evaluable
  temasNoEvaluables({ body }, res) {
    const children = fork('./controllers/temas_no_evaluables.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  temasNoEvaluablesV2({ body }, res) {
    const children = fork('./controllers/temas_no_evaluables_v2.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * User uploads
  userUploads({ body }, res) {
    const children = fork('./controllers/user_uploads.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  supervisores_notas({ body }, res) {
    const children = fork('./controllers/supervisores_notas.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  supervisores_notas2({ body }, res) {
    const children = fork('./controllers/supervisores_notas2.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  supervisores_notas_temas({ body }, res) {
    const children = fork('./controllers/supervisores_notas_temas.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  supervisores_avance_curricula({ body }, res) {
    const children = fork('./controllers/supervisores_avance_curricula.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  checklist_general({ body }, res) {
    const children = fork('./controllers/checklist_general.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  checklist_detallado({ body }, res) {
    const children = fork('./controllers/checklist_detallado_v2.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },

  /* videoteca */
  videoteca({ body }, res) {
    const children = fork('./controllers/videoteca.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },

  /* vademecum */
  vademecum({ body }, res) {
    const children = fork('./controllers/vademecum.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },

  /* diplomas */
  diplomas({ body }, res) {
    const children = fork('./controllers/diplomas.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })

  },

  /* diplomas */
  diplomas2({ body }, res) {
    const children = fork('./controllers/diplomas2.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })

  },
  /*Encuestas*/
  poolQuestions({body},res){
    const children = fork('./controllers/poll-questions.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  /*Evaluaciones data*/
  evaluationsData({body}, res){
    const children = fork('./controllers/evaluations_data.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  /*Benefit*/
  benefit_report({body},res){
    const children = fork('./controllers/benefit_report.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  /*Evaluaciones data Detalle*/
  evaluationsDetailData({body}, res){
    const children = fork('./controllers/evaluations_detail_data.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  user_benefit_report({body},res){
    const children = fork('./controllers/user_benefit_report.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  dc3Report({body},res){
    const children = fork('./controllers/dc3-report.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  assistsSessionReport({body},res){
    const children = fork('./controllers/assists-session-report.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
}
