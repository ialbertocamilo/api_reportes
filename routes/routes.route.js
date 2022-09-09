const { Router } = require('express')
const router = Router()
const db = require('../db')
const handler = require('./index')

router.get('/', async (req, res) => {
  console.log(db.con)
  res.send({ response: 'Bienvenido a la api Node 3.0.0' })
})

router.post('/notas_usuario', handler.notasUsuario)
router.post('/usuarios', handler.usuarios)
router.post('/consolidado_cursos', handler.consolidadoCursos)
router.post('/consolidado_temas', handler.consolidadoTemas)
router.post('/avance_curricula', handler.avanceCurricula)

/*
router.post('/visitas', handler.visitas)
router.post('/evaluaciones_abiertas', handler.evaluacionesAbiertas)
router.post('/reinicios', handler.reinicios)


router.post('/diplomas', handler.diplomas)
router.post('/supervisores_avance_curricula', handler.supervisores_avance_curricula)
router.post('/supervisores_notas', handler.supervisores_notas)
*/
module.exports = router
