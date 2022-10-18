const { fork } = require('child_process')

module.exports = {
  // * Usuarios
  usuarios (req, res) {
    const children = fork('./controllers/usuarios.js')
    children.send(req.body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Notas usuario
  notasUsuario ({ body }, res) {
    const children = fork('./controllers/notas_usuario.js')
    children.send(body)

    children.on('message', datos => {
      res.send(datos)
      children.kill()
    })
  },
  // * Consolidado por curso
  consolidadoCursos ({ body }, res) {
    const children = fork('./controllers/consolidado_cursos.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Consolidado por temas
  consolidadoTemas ({ body }, res) {
    const children = fork('./controllers/consolidado_temas_v2.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  avanceCurricula ({ body }, res) {
    const children = fork('./controllers/avance_curricula.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Visitas
  visitas ({ body }, res) {
    const children = fork('./controllers/visitas.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Reinicios
  reinicios ({ body }, res) {
    const children = fork('./controllers/reinicios.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Evaluaciones abiertas
  evaluacionesAbiertas ({ body }, res) {
    const children = fork('./controllers/eva_abiertas.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Temas no evaluable
  temasNoEvaluables ({ body }, res) {
    const children = fork('./controllers/temas_no_evaluables.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * Ranking
  ranking ({ body }, res) {
    const children = fork('./controllers/ranking.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  // * User uploads
  userUploads ({ body }, res) {
    const children = fork('./controllers/user_uploads.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  supervisores_notas ({ body }, res) {
    const children = fork('./controllers/supervisores_notas.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  supervisores_avance_curricula ({ body }, res) {
    const children = fork('./controllers/supervisores_avance_curricula.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  checklist_general ({ body }, res) {
    const children = fork('./controllers/checklist_general.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  checklist_detallado ({ body }, res) {
    const children = fork('./controllers/checklist_detallado.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  }
}
