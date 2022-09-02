const { fork } = require('child_process')
const { response } = require('../response')
const { extension } = require('../config')

module.exports = {
  // * Notas usuario
  notasUsuario({ body }, res) {
    const children = fork('./controllers/notas_usuario.js')
    children.send(body)

    children.on('message', datos => {
      res.send(datos)
      children.kill()
    })
  },
  // * Usuarios
  usuarios({ body }, res) {
    const children = fork('./controllers/usuarios.js')
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
  // * Consolidado por temas
  consolidadoTemas({ body }, res) {
    const children = fork('./controllers/consolidado_temas_v2.js')
    children.send(body)

    children.on('message', (data) => {
      res.send(data)
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
  avanceCurricula({ body }, res) {
    const children = fork(__dirname + '/../controllers/avance_curricula.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  diplomas({ body }, res){
    const children = fork(__dirname + '/../controllers/diplomas.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  supervisores_avance_curricula({ body }, res){
    const children = fork(__dirname + '/../controllers/supervisores_avance_curricula.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  },
  supervisores_notas({ body }, res){
    const children = fork(__dirname + '/../controllers/supervisores_notas.js')
    children.send(body)
    children.on('message', (data) => {
      res.send(data)
      children.kill()
    })
  }
}
