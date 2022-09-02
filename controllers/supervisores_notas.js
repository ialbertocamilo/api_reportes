'use strict'
process.on('message', (requestData) => {
  ConsolidadoCursos(requestData)
})
const _ = require('lodash')
require('../error')
const sequelize = require('../sequelize.js')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')
const {  getHeadersEstaticos } = require('../helper/Criterios')
const moment = require('moment')
const UsuarioCurso = require('../models/UsuarioCurso')
const Curso = require('../models/Curso')
const Categoria = require('../models/Categoria')
const Tema = require('../models/Tema')
const Visita = require('../models/Visita')
const Reinicio = require('../models/Reinicio')
const TipoCriterios = require('../models/TipoCriterios')
const ResumenCurso = require('../models/ResumenCurso')
const UsuarioCriterios = require('../models/UsuarioCriterios')
const Criterios = require('../models/Criterios')
const Supervisor = require('../models/Supervisor')

async function ConsolidadoCursos({ usuario_supervisor_id,escuelas, cursos, estados }) {

  let Headers = [
    'ULTIMA SESION',
    'ESCUELA',
    'CURSO',
    'VISITAS',
    'NOTA PROMEDIO CAL20', // 4
    'NOTA PROMEDIO CAL100', // 4
    'RESULTADO CURSO',
    'ESTADO CURSO',
    'REINICIOS CURSOS',
    'TEMAS ASIGNADOS',
    'TEMAS COMPLETADOS',
    'AVANCE (%)'
  ]
  const ConfigGeneral = await con('config_general')
  ConfigGeneral[0].reporte_promedio_base_100 ? Headers.splice(5, 0, 'NOTA PROMEDIO (B100)') : ''
  createHeaders(Headers, getHeadersEstaticos)

  let cursos_required_id = cursos;
  if(escuelas.length == 0 && cursos.length == 0){
    const cursos_r = await Curso.findAll({
      attributes:['id'],
      where:{
        estado:1
      }
    });
    cursos_required_id = pluck(cursos_r,'id');
  }
  if(escuelas.length>0 && cursos.length == 0){
    const cursos_r = await Curso.findAll({
      attributes:['id'],
      where: {
        categoria_id:escuelas,
        estado:1
      }
    });
    cursos_required_id = pluck(cursos_r,'id');
  }

  const Usuarios = await Supervisor.usuariosXSupervisor(usuario_supervisor_id);
  const usuarios_required_id = pluck(Usuarios,'id');
  let visitas =  await Visita.findAll({
                    attributes: ['usuario_id','curso_id',[sequelize.literal('SUM(sumatoria)'), 'sumatoria']],
                    where:{
                      usuario_id :usuarios_required_id
                    },
                    group: ['curso_id', 'usuario_id'],
                  })
  visitas = groupArrayOfObjects(visitas,'usuario_id');
  const reinicios = await Reinicio.findAll({
                      attributes: ['usuario_id','curso_id','acumulado'],
                      where:{
                        usuario_id :usuarios_required_id,
                        tipo: 'por_curso'
                      }
                    })
  let where_resumen_x_curso = {};
  where_resumen_x_curso.usuario_id = usuarios_required_id;
  where_resumen_x_curso.curso_id = cursos_required_id;
  // if(estados.length>0){
  //   where_resumen_x_curso.estado = estados;
  // }
  let  resumenes_curso = await ResumenCurso.findAll({
                      attributes:['usuario_id','estado','curso_id','asignados','porcentaje','aprobados','nota_prom',[sequelize.literal('aprobados+realizados+revisados'), 'sum_completados']],
                      where:where_resumen_x_curso
                    });
  resumenes_curso = groupArrayOfObjects(resumenes_curso,'usuario_id');
 
  const cursos_required = await Curso.findAll({
                              attributes:['id','nombre','estado'],
                              where:{
                                id:cursos_required_id
                              },
                              include:[
                                {
                                  required:false,
                                  model:Tema,
                                  attributes:['id'],
                                    where:{
                                      estado:1
                                  }
                                },
                                {
                                  required:false,
                                  model:Categoria,
                                  attributes: ['id','nombre'],
                                }
                              ]
                            });
  const tipo_criterios = await TipoCriterios.findAll({
                          attributes:['id'],
                          where:{
                            en_reportes:1
                          }
                        })
  const usuarios_criterios = await UsuarioCriterios.findAll({
                              attributes:['usuario_id'],
                              where:{
                                usuario_id:usuarios_required_id
                              },
                              include: {
                                required:true,
                                model:Criterios,
                                attributes: ['nombre','tipo_criterio_id'],
                                where:{
                                  tipo_criterio_id:pluck(tipo_criterios,'id')
                                }
                              }
                            })
    let UsuarioCursos = await UsuarioCurso.findAll({
                          attributes:['usuario_id','curso_id'],
                          where:{
                            usuario_id:usuarios_required_id,
                            curso_id: cursos_required_id,
                            estado:1
                          },
                        })
    UsuarioCursos = groupArrayOfObjects(UsuarioCursos,'usuario_id');
    const Modulos = await con('ab_config')
   
    for (const usuario of _.uniq(Usuarios, 'id')) {
       const modulo = Modulos.find((obj) => obj.id === usuario.config_id)
        const CriteriosUsuario = usuarios_criterios.filter(obj => obj.usuario_id == usuario.id);
        const m_ultima_sesion = moment(usuario.ultima_sesion).format('DD/MM/YYYY H:mm:ss');
        const usuario_visitas = visitas[usuario.id] || [];
        const usuario_reinicios = reinicios.filter(obj => obj.usuario_id == usuario.id)
        const resumenes_x_usuario = resumenes_curso[usuario.id]  || [];
        const usuario_cursos_x_usuario = UsuarioCursos[usuario.id] || [];
        for (const usuario_curso of usuario_cursos_x_usuario) {
            const resumen_curso = resumenes_x_usuario.find(obj => obj.curso_id == usuario_curso.curso_id) || {estado:'pendiente'};
            const resultadoCurso = verificarEstadoCurso(resumen_curso.estado)
            const curso = cursos_required.find(c => c.id === usuario_curso.curso_id)
            const visitasCurso = usuario_visitas.find(obj => obj.curso_id == usuario_curso.curso_id && obj.usuario_id == usuario.id) || ''
            const reinicio = usuario_reinicios.find(obj => obj.curso_id === curso.id) || '-'
            const CellRow = []
            if(estados.length==0 || estados.find(e=>e==resumen_curso.estado)){
              CellRow.push(modulo.etapa)
              CellRow.push(usuario.nombre)
              CellRow.push(usuario.apellido_paterno)
              CellRow.push(usuario.apellido_materno)
              CellRow.push(usuario.dni)
              CellRow.push((usuario.email) ? usuario.email : 'Email no registrado')
              CellRow.push(usuario.estado == 1 ? 'Activo' : 'Inactivo')
              for (const tipoCriterio of tipo_criterios) {
                let UsuarioTipoCriterio = CriteriosUsuario.find(obj => obj.criterio.tipo_criterio_id == tipoCriterio.id)
                CellRow.push(UsuarioTipoCriterio ? UsuarioTipoCriterio.criterio.nombre : '-')
              }
              // CriteriosUsuario.forEach(obj => CellRow.push(obj.criterio.nombre || '-'))
              CellRow.push( (m_ultima_sesion!='Invalid date') ? m_ultima_sesion : '-')
              CellRow.push(curso.categoria ? curso.categoria.nombre : 'No se encontro la Escuela')
              CellRow.push(curso ? curso.nombre : 'No se encontro el Curso')
              CellRow.push(visitasCurso.sumatoria || '-')
              CellRow.push(resumen_curso.aprobados > 0 ? resumen_curso.nota_prom : '-')
              CellRow.push(resumen_curso.aprobados > 0 && resumen_curso.nota_prom ? resumen_curso.nota_prom*5 : '-')
              if (ConfigGeneral[0].reporte_promedio_base_100) {
                let NotaB100 = ConfigGeneral[0].reporte_promedio_base_100 && resumen_curso.aprobados > 0 ? resumen_curso.nota_prom * 5 : '-' //B100
                CellRow.push(NotaB100)
              }
              CellRow.push(resultadoCurso)
              CellRow.push(curso.estado == 1 ? 'Activo' : 'Inactivo')
              CellRow.push(reinicio.acumulado || '-')
              CellRow.push((resumen_curso) ? resumen_curso.asignados : curso.temas.length )
              CellRow.push((resumen_curso) ? resumen_curso.sum_completados : 0)
              CellRow.push((resumen_curso && resumen_curso.porcentaje) ? resumen_curso.porcentaje+'%' : '0%')
              worksheet.addRow(CellRow).commit()
            }
        }
    }
  if (worksheet._rowZero > 1)
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'ConsolidadoCursos' }))
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

function verificarEstadoCurso(cursoEstado) {
  switch (cursoEstado) {
    case 'aprobado':
      // if (completados)
      return 'COMPLETADO'
      break
    case 'desaprobado':
      // if (desarollo)
      return 'DESAPROBADO'
      break
    case 'desarrollo':
      // if (desarollo)
      return 'DESARROLLO'
      break
    case 'enc_pend':
      // if (encuesta_pendiente)
      return 'ENCUESTA PENDIENTE'
      break
    default:
      // if (pendientes)
      return 'PENDIENTE'
      break
    // Pendientes
  }
}

function ValidarNotasVisitas(visitas, nota) {
  if (parseInt(nota)) {
    if (parseInt(visitas)) {
      return true
    } else {
      return false
    }
  } else {
    return true
  }
}