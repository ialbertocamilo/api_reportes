process.on('message', requestData => {
    AvanceCurricula(requestData)
})
  require('../error')
  const { con } = require('../db')
  const { response } = require('../response')
  const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
  const Supervisor = require('../models/Supervisor')
  async function AvanceCurricula ({ usuario_supervisor_id  }) {
    let headers = [
        'Módulo',
        'DNI',
        'EMAIL',
        'Apellidos y Nombres',
        'Estado(Usuario)',
    ]
    const Modulos = await con('ab_config')
    
    const usuariosXSupervisor = await Supervisor.usuariosXSupervisor(usuario_supervisor_id)
    const ResumenGeneral = await con('resumen_general')
    const TipoCriterios = await con('tipo_criterios')
    const CriteriosUsuarios = await con.raw(`SELECT uc.usuario_id, c.nombre, tc.id as tipo_criterio_id
      from criterios as c
      INNER JOIN usuario_criterios as uc on c.id=uc.criterio_id
      INNER JOIN tipo_criterios as tc on c.tipo_criterio_id=tc.id Order by tc.id ASC`).then(([rows]) => rows)
    TipoCriterios.forEach(el => headers.push(el.nombre))
    headers.push('Cursos asignados')
    headers.push('Cursos completados')
    headers.push('Avance')
    let Rows = 0
    createHeaders(headers)
    for (const usuario of usuariosXSupervisor) {
      Rows++
      const CellRow = []
      const modulo = Modulos.find((obj) => obj.id === usuario.config_id) || ''
      const resumen = ResumenGeneral.find(obj => obj.usuario_id === usuario.id) || ''
      const criteriosUsuario = CriteriosUsuarios.filter(obj => obj.usuario_id === usuario.id)
      CellRow.push(modulo.etapa)
      CellRow.push(usuario.dni)
      CellRow.push((usuario.email) ? usuario.email : 'Email no registrado')
      CellRow.push(usuario.nombre)
      CellRow.push(usuario.estado == 0 ? 'Inactivo' : 'Activo')
      for (const tipoCriterio of TipoCriterios) {
        const UsuarioTipoCriterio = criteriosUsuario.find(obj => obj.tipo_criterio_id == tipoCriterio.id)
        CellRow.push(UsuarioTipoCriterio ? UsuarioTipoCriterio.nombre : '-')
      }
      CellRow.push((resumen) ? resumen.cur_asignados : '-')
      CellRow.push((resumen) ? resumen.tot_completados : '-')
      CellRow.push((resumen) ? resumen.porcentaje+'%' : 0+'%') //Columna modificada para porcentaje
      if (Rows === 1e6) {
        worksheet = workbook.addWorksheet('Hoja 2', { properties: { defaultColWidth: 18 } })
        createHeaders(worksheet, headers)
      }
      worksheet.addRow(CellRow).commit()
    }
    if (worksheet._rowZero > 1){
        workbook.commit().then(() => {
         process.send(response({ createAt, modulo: 'avance_curricula' }))
        })
    }
    else {
        process.send({ alert: 'No se encontraron resultados' })
    }
  }