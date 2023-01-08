const { Router } = require('express')
const router = Router()
const db = require('../db')
const handler = require('./index')
router.get('/', async (req, res) => {
  console.log(db.con)
  res.send({ response: 'Bienvenido a la api Node 3.0.0' })
})

router.post('/notas_usuario', handler.notasUsuario)
router.post('/historial_usuario', handler.historialUsuario)
router.post('/usuarios', handler.usuarios)
router.post('/consolidado_cursos', handler.consolidadoCursos)
router.post('/consolidado_cursos_v2', handler.consolidadoCursosv2)

router.post('/segmentation', handler.segmentation)

router.post('/consolidado_temas', handler.consolidadoTemas)
router.post('/consolidado_temas_v3', handler.consolidadoTemasV3)
router.post('/avance_curricula', handler.avanceCurricula)
router.post('/visitas', handler.visitas)
router.post('/reinicios', handler.reinicios)
router.post('/evaluaciones_abiertas', handler.evaluacionesAbiertas)
router.post('/evaluaciones_abiertas_v2', handler.evaluacionesAbiertasV2)
router.post('/temas_no_evaluables', handler.temasNoEvaluables)
router.post('/temas_no_evaluables_v2', handler.temasNoEvaluablesV2)
router.post('/ranking', handler.ranking)
router.post('/user_uploads', handler.userUploads)

router.post('/supervisores_notas', handler.supervisores_notas)
router.post('/supervisores_avance_curricula', handler.supervisores_avance_curricula)

router.post('/checklist_general', handler.checklist_general)
router.post('/checklist_detallado', handler.checklist_detallado)

router.post('/videoteca', handler.videoteca)
router.post('/vademecum', handler.vademecum)
router.post('/diplomas', handler.diplomas)

module.exports = router
