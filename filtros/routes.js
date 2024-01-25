const router = require('express').Router()
const tablas = require('./tablas')
const { pluck } = require('../helper/Helper')
const { isSuper } = require('../helper/Usuarios')
const { loadWorkspaceSegmentationCriteria } = require('../helper/Criterios')
router.get('/', async (req, res) => {
  res.send('Bienvenido a la api de filtros')
})

router.get('/datosiniciales/:workspaceId/:adminId', async (req, res) => {
  const isSuperUser = await isSuper(req.params.adminId)
  const datos = await tablas.datosIniciales(
    req.params.workspaceId, req.params.adminId, isSuperUser
  )
  res.json(datos)
})

router.get('/courses/:schoolIds', async (req, res) => {

  const datos = await tablas.loadSchoolCourses(
    req.params.schoolIds, false
  )
  res.json(datos)
})

router.get('/courses/:schoolIds/all', async (req, res) => {

  const datos = await tablas.loadSchoolCourses(
    req.params.schoolIds, true
  )
  res.json(datos)
})

router.get('/courses/checklist/:workspaceId', async (req, res) => {

  const datos = await tablas.loadChecklists(req.params.workspaceId)
  res.json(datos)
})

router.post('/schools/courses', async (req, res) => {
  const datos = await tablas.loadCoursesFromSchools(req.body.schoolsIds)
  res.json(datos)
})

router.get('/topics/:coursesIds', async (req, res) => {

  const datos = await tablas.loadCourseTopics(req.params.coursesIds)
  res.json(datos)
})

router.get('/schools/:workspaceId/:adminId?', async (req, res) => {
  let grouped
  // default value for grouped is true
  if (typeof req.query.grouped === 'undefined') {
    grouped = true
  } else {
    grouped = req.query.grouped === '1'
  }
  const hasDc3 = Boolean(req.query.hasDc3);
  const datos = await tablas.loadsubworkspaceSchools(req.params.workspaceId, grouped, req.params.adminId,hasDc3)
  res.json(datos)
})

router.get('/job-positions/:workspaceId', async (req, res) => {

  const datos = await tablas.loadWorkspaceJobPositions(req.params.workspaceId)
  res.json(datos)
})



router.get('/cargar_grupos', async (req, res) => {
  const { mod, esc } = req.query
  const datos = await tablas.cargarGrupos(mod, esc)
  res.json(datos)
})

router.get('/cargar_carreras', async (req, res) => {
  const { mod, esc } = req.query
  const datos = await tablas.cargarCarreras(mod, esc)
  res.json(datos)
})

router.get('/cargar_ciclos', async (req, res) => {
  const { mod, esc } = req.query
  const datos = await tablas.cargarCiclos(mod, esc)
  res.json(datos)
})



router.post('/schools/states/:adminId', async (req, res) => {
  const { body } = req
  const datos = await tablas.loadSchoolsStatesBySubworkspaceId(body, req.params.adminId)
  return res.json(datos)
})

router.post('/school/courses/states', async (req, res) => {
  const { body } = req;
  const datos = await tablas.loadSchoolCoursesStatesById(body);
  return res.json(datos);
})

//  Principales

// * Modulos * //
router.post('/cambia_modulo_carga_escuela', async (req, res) => {
  const { mod } = req.body
  const datos = await tablas.cambiaModuloCargaEscuela(mod)
  res.json(datos)
})

router.post('/cambiaModulosCargaEscuela', async (req, res) => {
  const datos = await tablas.cambiaModulosCargaEscuela(req.body.modulo)
  res.json(datos)
})

router.post('/cambia_modulo_carga_carrera', async (req, res) => {
  const { mod } = req.body
  const datos = await tablas.cambiaModuloCargaCarrera(mod)
  res.json(datos)
})

router.post('/cambia_escuela_carga_curso', async (req, res) => {
  const { mod, esc } = req.body
  const datos = await tablas.cambiaEscuelaCargaCurso(mod, esc)
  res.json(datos)
})
router.post('/cambia_escuela_carga_curso_evaabierta', async (req, res) => {
  const datos = await tablas.cambiaEscuelaCargaCursoAbierta(req.body)
  res.json(datos)
})

router.post('/cambia_curso_carga_tema', async (req, res) => {
  const datos = await tablas.cambiaCursoCargaTema(req.body)
  res.json(datos)
})
router.post('/cambia_curso_carga_tema_evaabierta', async (req, res) => {
  const datos = await tablas.cambiaCursoCargaTemaAbierta(req.body)
  res.json(datos)
})

router.post('/cambia_curso_carga_tema_todos', async (req, res) => {
  const datos = await tablas.cambiaCursoCargaTemaTodos(req.body)
  res.json(datos)
})
// Agregados

router.post('/CambiaEscuelasCargaCursos', async (req, res) => {
  const datos = await tablas.cambiaEscuelasCargaCursos(req.body)
  res.json(datos)
})
router.post('/CambiaCursoCargaTemas', async (req, res) => {
  const datos = await tablas.cambiaCursoCargaTemas(req.body)
  res.json(datos)
})

router.post('/historial_usuario', async (req, res) => {
  const data = await tablas.userHistoryFilter(req.body)
  res.json(data)
})

router.get('/sub-workspace/:subworkspacesIds/criterion-values/:criterionCode', async (req, res) => {
  const { subworkspacesIds, criterionCode } = req.params
  const subworkspaces = await tablas.loadSubworkspaceById(subworkspacesIds)
  const criterionValuesIds = pluck(subworkspaces, 'criterion_value_id')
  const datos = await tablas.loadCriterionValuesByParentId(criterionValuesIds, criterionCode)
  res.json(datos)
})

router.get('/segmented-criteria/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params
  res.json(await loadWorkspaceSegmentationCriteria(workspaceId))
})

router.post(`/criterion-values/:criterionCode`, async (req, res) => {
  const { criterionCode } = req.params;
  const { parentsIds } = req.body;
  const datos = await tablas.loadCriterionValuesByParentId(parentsIds, criterionCode)
  res.json(datos)
});

router.get(`/sub-workspace/:subworkspacesIds/campaigns`, async (req, res) => {
  const { subworkspacesIds } = req.params;
  const datos = await tablas.loadCampaignsSubworkspaceById(subworkspacesIds)
  res.json(datos)
});

module.exports = router
