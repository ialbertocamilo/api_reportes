const router = require('express').Router()
const tablas = require('./tablas')
router.get('/', async (req, res) => {
  res.send('Bienvenido a la api de filtros')
})

router.get('/datosiniciales/:workspaceId', async (req, res) => {
  const datos = await tablas.datosIniciales(req.params.workspaceId)
  res.json(datos)
})

router.get('/courses/:schoolId', async (req, res) => {

  const datos = await tablas.loadSchoolCourses(req.params.schoolId)
  res.json(datos)
})

router.get('/courses/checklist/:courseId', async (req, res) => {

  const datos = await tablas.loadCourseChecklists(req.params.courseId)
  res.json(datos)
})

router.post('/schools/courses', async (req, res) => {
  const datos = await tablas.loadCoursesFromSchools(req.body.schoolsIds)
  res.json(datos)
})

router.get('/topics/:courseId', async (req, res) => {

  const datos = await tablas.loadCourseTopics(req.params.courseId)
  res.json(datos)
})

router.get('/schools/:workspaceId', async (req, res) => {

  const datos = await tablas.loadWorkspaceSchools(req.params.workspaceId)
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



router.post('/schools/states', async (req, res) => {
  const { body } = req;
  const datos = await tablas.loadSchoolsStatesByWorkspaceId(body);
  return res.json(datos);
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

module.exports = router
