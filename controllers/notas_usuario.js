process.on('message', requestData => {
  notasUsuario(requestData)
})

require('../error')
const moment = require('moment')
moment.locale('es')
const { con } = require('../db')

async function notasUsuario({ dni }) {
  let Usuario = {}
  const usuario = await con('usuarios').select('id', 'dni', 'nombre', 'apellido_paterno', 'apellido_materno', 'email', 'config_id').where('dni', `${dni}`).then(([row]) => row)
  if (!usuario || !dni) {
    process.send({ alert: 'Usuario no encontrado, verifica el DNI' })
    process.exit()
  }
  Usuario = usuario

  const Modulos = await con('ab_config').where('id', usuario.config_id)
  const Escuelas = await con('categorias')
  const Cursos = await con('cursos')
  const Reinicios = await con('reinicios')
  const Temas = await con('posteos')
  const Visitas = await con('visitas')
  const UsuarioCriterios = await con('usuario_criterios')
  const Curriculas = await con('curriculas')
  const CurriculaDetalles = await con('curricula_detalles')
  const Pruebas = await con('pruebas').where('usuario_id', usuario.id)
  const VisitasByCurso = await con.raw(
    'SELECT SUM(sumatoria) as sumatoria, curso_id, usuario_id FROM visitas GROUP BY curso_id,usuario_id'
  ).then(([rows]) => rows)
  const Preguntas = await con('preguntas')
  const ResultadoCurso = []

  const ResumenCurso = await con('resumen_x_curso').where('usuario_id', usuario.id)
  if (!ResumenCurso.length) {
    process.send({ alert: `El Usuario con el DNI : ${dni} no tiene evaluaciones desarrolladas` })
    process.exit()
  }
  // Datos usuario
  const modulo = Modulos.find(obj => obj.id == usuario.config_id)
  Usuario.modulo = modulo.etapa


  for (const curso of ResumenCurso) {
    const { curso_id, usuario_id } = curso
    const CursosObj = {}
    const _curso = Cursos.find(obj => obj.id === curso_id)
    const reinicioCurso = Reinicios.find(obj => obj.curso_id == curso_id && obj.usuario_id == usuario_id)

    const temas = Temas.filter(obj => obj.curso_id == curso_id)
    const TemasArr = []
    let visitasCurso = 0

    for (const tema of temas) {
      const TemasObj = {}
      const temaVisita = Visitas.find(obj => obj.curso_id == curso_id && obj.usuario_id == usuario_id && obj.post_id == tema.id)
      const prueba = Pruebas.find(obj => obj.posteo_id == tema.id && obj.usuario_id == usuario.id)
      const reinicioTema = Reinicios.find(obj => obj.posteo_id == tema.id && obj.usuario_id == usuario_id)
      visitasCurso += temaVisita ? temaVisita.sumatoria : 0
      TemasObj.tema = tema.nombre
      TemasObj.sistema_calificacion = tema.tipo_cal || '-'
      TemasObj.puntaje = prueba ? parseInt(prueba.puntaje) : '-'
      TemasObj.nota = (prueba && prueba.nota) ? parseFloat(prueba.nota).toFixed(2) : '-'
      TemasObj.correctas = prueba ? prueba.rptas_ok : '-'
      TemasObj.incorrectas = prueba ? prueba.rptas_fail : '-'
      TemasObj.visitas = temaVisita ? temaVisita.sumatoria : '-'
      TemasObj.reinicios = reinicioTema ? reinicioTema.acumulado : 0
      TemasObj.ultima_evaluacion = prueba ? moment(prueba.last_ev).format('L') + ' ' + moment(prueba.last_ev).format('LT') : '-'

      if (prueba) {
        const rptas = (prueba.usu_rptas) ? JSON.parse(prueba.usu_rptas) : ""
        if (rptas) {
          let Evaluacion = []
          rptas.forEach((rpta, index) => {
            let pregunta = Preguntas.find(obj => obj.id == rpta.preg_id) || ''
            if(pregunta){
              let respuesta_ok = JSON.parse(pregunta.rptas_json).find(obj => obj.id === pregunta.rpta_ok) || ''
              let respuesta_usuario = JSON.parse(pregunta.rptas_json).find(obj => obj.id == rpta.opc) || ''
              let evaluacion = {};
              evaluacion.pregunta = pregunta ? pregunta.pregunta : '-' || '-'
              evaluacion.respuesta_ok = respuesta_ok ? respuesta_ok.opc : '-' || '-'
              evaluacion.respuesta_usuario = respuesta_usuario ? respuesta_usuario.opc : '' || ''
              evaluacion.correcta = (respuesta_ok.id === respuesta_usuario.id) ? true : false ;
              Evaluacion.push(evaluacion)
            }
          })
          TemasObj.prueba = Evaluacion
        }
      }
      TemasArr.push(TemasObj)
    }

    CursosObj.curso = _curso ? _curso.nombre : '-'
    CursosObj.nota_prom = curso ? curso.nota_prom : '-'
    CursosObj.visitas = visitasCurso
    CursosObj.reinicios = reinicioCurso ? reinicioCurso.acumulado : '-'

    CursosObj.temas = TemasArr
    ResultadoCurso.push(CursosObj)
  }
  process.send({
    Cursos: ResultadoCurso,
    Usuario
  })
}
