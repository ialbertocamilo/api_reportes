const { Router } = require('express')
const router = Router()

const handler = require('./index')

router.get('/', async (req, res) => {
  res.send('Bienvenido a la api Node 0.5')
})

router.post('/notas_usuario', handler.notasUsuario)
router.post('/usuarios', handler.usuarios)
router.post('/visitas', handler.visitas)
router.post('/evaluaciones_abiertas', handler.evaluacionesAbiertas)
router.post('/reinicios', handler.reinicios)
router.post('/consolidado_cursos', handler.consolidadoCursos)
router.post('/consolidado_temas', handler.consolidadoTemas)
router.post('/avance_curricula', handler.avanceCurricula)
router.post('/diplomas', handler.diplomas)
router.post('/supervisores_avance_curricula', handler.supervisores_avance_curricula)
router.post('/supervisores_notas', handler.supervisores_notas)

module.exports = router
