'use strict'
process.on('message', (requestData) => {
  exportarUsuariosDW(requestData)
})

require('../error')
const _ = require('lodash')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const { getCriteriosPorUsuario, getHeadersEstaticos } = require('../helper/Criterios')
const moment = require('moment')
// const { getUsuarios } = require('../helper/Usuarios')
const Usuario = require('../models/Usuario')
const UsuarioCurso = require('../models/UsuarioCurso')
const Modulo = require('../models/Modulo')
const Curso = require('../models/Curso')
const Tema = require('../models/Tema')
const Categoria = require('../models/Categoria')
const Prueba = require('../models/Prueba')
const Visita = require('../models/Visita')
const Reinicio = require('../models/Reinicio')
const ResumenCurso = require('../models/ResumenCurso')

moment.locale('es')

let Headers = [
  'ULTIMA SESION',
  'ESCUELA',
  'CURSO',
  'RESULTADO CURSO',
  'REINICIOS CURSO',
  'TEMA',
  'RESULTADO TEMA',
  'ESTADO TEMA',
  'NOTA TEMA',
  'PUNTAJE TEMA',
  'REINICOS TEMA',
  'INTENTOS PRUEBA',
  'EVALUABLE TEMA',
  'TIPO TEMA',
  'VISITAS TEMA',
  'PJE. MINIMO APROBATORIO',
  'SISTEMA DE CALIFICACION',
  'ULTIMA EVALUACION',
]
createHeaders(Headers, getHeadersEstaticos)

async function exportarUsuariosDW({ modulos, UsuariosActivos, UsuariosInactivos, escuelas, cursos, temas, completados, desaprobados, pendientes, temasActivos, temasInactivos, end, start, validador }) {

  if (validador) {
    Headers = Headers.concat([
      'VALIDADOR DE INTENTOS REINICIOS',
      'VALIDADOR PUNTAJE'
    ])
  }

  // let WhereResumen = '1'
  // start && end ? WhereResumen += ` AND (last_ev BETWEEN "${start}" AND "${end}")` : ''
  // start && !end ? WhereResumen += ` AND last_ev >= '${start}'` : ''
  // !start && end ? WhereResumen += ` AND last_ev <= '${end}'` : ''

  // const ResumenCurso = await con('resumen_x_curso').whereRaw(WhereResumen)
  // if (!ResumenCurso[0]) process.send({ alert: 'No se encontraron resultados' })
  let estado_usuarios = [];
  (UsuariosActivos) && estado_usuarios.push(1);
  (UsuariosInactivos) && estado_usuarios.push(0);

  let cursos_required_id = cursos;
  let where_usuario_cursos = {}
  where_usuario_cursos.estado = 1;
  (cursos.length > 0) && (where_usuario_cursos.curso_id = cursos); 
  if(escuelas.length == 0 || cursos.length == 0){
    const where_cr = {};
    (escuelas.length == 0) ? where_cr.config_id = modulos : where_cr.categoria_id = escuelas ;
    const cursos_r = await Curso.findAll({
      attributes:['id'],
      where: where_cr
    });

    (cursos.length > 0 && cursos.length == 0) && where_usuario_cursos.curso_id ==  pluck(cursos_r,'id');
    cursos_required_id = pluck(cursos_r,'id');
  }
  const where_tema = (temas.length >0 ) ? {id:temas} : {};

  const Usuarios = await Usuario.findAll({ 
      attributes: ['id','nombre','apellido_paterno','apellido_materno','dni','email','estado','ultima_sesion'],
      where:{
          rol:'default',
          estado: (estado_usuarios.length > 0 ) ? estado_usuarios : [1,0],
          config_id : modulos
      },
      include:[
        {
          model:Modulo,
          required:true,
          attributes: ['id','etapa','mod_evaluaciones'],
        },
        {
          model:UsuarioCurso,
          required:true,
          attributes:['id','usuario_id','curso_id'],
          where:where_usuario_cursos,
        },
      ]
  });
  const usuarios_required_id = pluck(Usuarios,'id');
  let pruebas = await Prueba.findAll({
    attributes: ['posteo_id','usuario_id','nota','puntaje','last_ev','intentos'],
      where:{
        calificada:1,
        usuario_id :usuarios_required_id
      }
  })
  pruebas = groupArrayOfObjects(pruebas,'usuario_id');

  let visitas =  await Visita.findAll({
                    attributes: ['usuario_id','post_id','estado_tema','sumatoria'],
                    where:{
                      usuario_id :usuarios_required_id
                    }
                  })
  visitas = groupArrayOfObjects(visitas,'usuario_id');
  
  const reinicios = await Reinicio.findAll({
                      required:false,
                      attributes: ['usuario_id','curso_id','posteo_id','acumulado','tipo'],
                      where:{
                        usuario_id :usuarios_required_id
                      }
                    })
  let resumenes_curso = await ResumenCurso.findAll({
                      attributes:['usuario_id','estado','curso_id'],
                      where:{
                        usuario_id: usuarios_required_id,    
                        curso_id:cursos_required_id
                      }
                    });
  resumenes_curso = groupArrayOfObjects(resumenes_curso,'usuario_id');
  const cursos_required = await Curso.findAll({
                              attributes:['id','nombre','estado','mod_evaluaciones'],
                              where:{
                                id:cursos_required_id
                              },
                              include:[
                                {
                                  required:false,
                                  model:Tema,
                                  attributes:['id','nombre','evaluable','estado','tipo_ev','tipo_cal'],
                                  where:where_tema
                                },
                                {
                                  required:false,
                                  model:Categoria,
                                  attributes: ['id','nombre','estado'],
                                }
                              ]
                            });

  for (const usuario of Usuarios) {
    const CriteriosUsuario = await getCriteriosPorUsuario(usuario.id)
    const m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY H:mm:ss');
    // const usuario_pruebas = pruebas.filter(obj => obj.usuario_id == usuario.id)
    const usuario_pruebas = pruebas[usuario.id] || [];
    // const usuario_visitas = visitas.filter(obj => obj.usuario_id == usuario.id)
    const usuario_visitas = visitas[usuario.id] || [];
    const usuario_reinicios = reinicios.filter(obj => obj.usuario_id == usuario.id)
    // const resumenes_x_usuario = resumenes_curso.filter(obj => obj.usuario_id == usuario.id);
    const resumenes_x_usuario = resumenes_curso[usuario.id]  || [];
    for (const usuario_curso of usuario.usuario_cursos){
    // usuario.usuario_cursos.map((uc) =>{
      const resumen_curso = resumenes_x_usuario.find(obj => obj.curso_id == usuario_curso.curso_id) || '';
      const curso = cursos_required.find(c => c.id === usuario_curso.curso_id)
      if(curso){
        const resultadoCurso = verificarEstadoCurso(resumen_curso.estado);
        const reinicioCurso = usuario_reinicios.filter(obj => obj.curso_id == usuario_curso.curso_id) || '-'
        const q_reinicios_curso = reinicioCurso.find(obj =>obj.tipo == 'por_curso') || '-';
        let NotasAprobatorias = curso.mod_evaluaciones || usuario.modulo.mod_evaluaciones;
        NotasAprobatorias = JSON.parse(NotasAprobatorias);
        for (const tema of curso.temas){
        // curso.temas.map((tema)=>{
          const prueba = usuario_pruebas.find(obj => obj.posteo_id == tema.id) || ''
          const NotaMinima = NotasAprobatorias && tema.tipo_cal ? NotasAprobatorias.nota_aprobatoria.find(obj => obj.nombre == tema.tipo_cal) : ''
          const temaVisita = usuario_visitas.find(obj => obj.post_id == tema.id) || '-'
          const resultadoTema = verificarResultadoTema(temaVisita.estado_tema)
          const q_reinicios_tema = reinicioCurso.find(obj => obj.posteo_id == tema.id) || '-'
          const CellRow = []
          CellRow.push(usuario.modulo.etapa)
          CellRow.push(usuario.nombre)
          CellRow.push(usuario.apellido_paterno)
          CellRow.push(usuario.apellido_materno)
          CellRow.push(usuario.dni)
          CellRow.push((usuario.email) ? usuario.email : 'Email no registrado')
          CellRow.push(usuario.estado == 1 ? 'Activo' : 'Inactivo')
          CriteriosUsuario.forEach(obj => CellRow.push(obj.nombre || '-'))
          CellRow.push((m_ultima_sesion!='Invalid date') ? m_ultima_sesion : '-')
          CellRow.push(curso.categoria.nombre)
          CellRow.push(curso.nombre)
          CellRow.push(resultadoCurso)
          CellRow.push(q_reinicios_curso.acumulado || '-')
          CellRow.push(tema.nombre)
          CellRow.push(resultadoTema)
          CellRow.push(tema.estado == 1 ? 'ACTIVO' : 'INACTIVO')
          CellRow.push(prueba.nota || '-')
          CellRow.push(prueba.puntaje || '-')
          CellRow.push(q_reinicios_tema.acumulado || '-')
          CellRow.push(prueba.intentos || '-')
          CellRow.push(tema.evaluable)
          CellRow.push(tema.tipo_ev || '-')
          CellRow.push(temaVisita ? temaVisita.sumatoria : '-')
          CellRow.push(NotaMinima.value || '-')
          CellRow.push(tema.tipo_cal || '-')
          CellRow.push((prueba.last_ev) ? moment(prueba.last_ev).format('L') : '-')
          worksheet.addRow(CellRow).commit();
        }
      }
    }
  }
  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoTemas' }))
    })
  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}
function pluck(array, key) {
  return array.map(function(obj) {
      return obj[key];
  });
}
function groupArrayOfObjects(list, key) {
  return list.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};
function validarNotasTemas(intentos, nota, reinicios) {
  if (parseInt(nota)) {
    if (parseInt(intentos)) {
      return true
    } else {
      return !!parseInt(reinicios)
    }
  } else {
    return true
  }
}
function validadorNotaMinimaAprobatoria(puntaje, puntaje_minimo, prueba_resultado, nota){
  if (!parseInt(puntaje) > 0) {
    return true
  }else{
    if (parseInt(puntaje) >= parseInt(puntaje_minimo)) {
      return !!prueba_resultado
    }else{
      return !prueba_resultado
    }
  }
}
function verificarEstadoCurso(cursoEstado) {
  switch (cursoEstado) {
    case 'aprobado':
      return 'COMPLETADO'
    case 'desaprobado':
      return 'DESAPROBADO'
    case 'desarrollo':
      return 'DESARROLLO'
    case 'enc_pend':
      return 'ENCUESTA PENDIENTE'
    case 'pendiente':
      return 'PENDIENTE'
    default:
      return 'PENDIENTE'
  }
}
function verificarResultadoTema(estado) {
  const EstadoTema = (!estado || estado == '' || estado == null) ? 'pendiente' : estado
  switch (EstadoTema) {
    case 'aprobado':
    case 'revisado':
    case 'realizado':
      return 'COMPLETADO'
      break
    case 'desaprobado':
      return 'DESAPROBADO'
      break
    case 'pendiente':
      return 'PENDIENTE'
      break
  }
}
