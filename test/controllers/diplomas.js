process.on('message', (requestData) => {
    Diplomas(requestData)
  })
  const moment = require('moment')
  require('../error')
  const config = require('../config.js')

  const { response } = require('../response')
  const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
  const _ = require('lodash')
  const Diploma = require("../../models/Diploma");
  const Curso = require("../../models/Curso");
  const Categoria = require("../../models/Categoria");
  const Modulo = require("../../models/Modulo");
  const Usuario = require('../../models/Usuario')
  const UsuarioCurso = require('../../models/UsuarioCurso')

  const Headers = [
    'EMPRESA',
    'NOMBRE',
    'APELLIDO PATERNO',
    'APELLIDO MATERNO',
    'DNI',
    'ESTADO (usuario)',
    'TIPO DIPLOMA',
    'ESCUELA',
    'ESTADO (escuela)',
    'DENTRO DE CURRÍCULA',
    'CURSO',
    'ESTADO (curso)',
    'FECHA EN LA QUE OBTUVO EL DIPLOMA',
    'ACEPTACIÓN DEL USUARIO',
    'LINK VER DIPLOMA',
    'LINK DESCARGA DIPLOMA',
  ]
  createHeaders(Headers)
  async function Diplomas({ modulos_id , categorias_id, cursos_id, tipo_check_diploma,UsuariosActivos, UsuariosInactivos,tipo_diploma }) {
      // Datos necesarios
    let Rows = 0
    // const usuario_cursos = await UsuarioCurso.findAll({
    //     attributes: ['id','curso_id','usuario_id'],
    //     where: {
    //         estado:1
    //     },
    //     include: [{ 
    //         model:Curso,
    //         required: false,
    //         attributes: ['id','categoria_id'],
    //     }]
    // });
    //INCLUDES PARA DIPLOMAS X CURSO Y X CATEGORIA
    let estado_usuarios = [];
    (UsuariosActivos) && estado_usuarios.push(1); 
    (UsuariosInactivos) && estado_usuarios.push(0); 
    const include_usuario = {
        model:Usuario,
        required: true,
        attributes: ['id','nombre','apellido_paterno','apellido_materno','config_id','dni','estado'],
        where:{
            rol:'default',
            estado: (estado_usuarios.length > 0 ) ? estado_usuarios : [1,0],
        },
        include:[{
            model:Modulo,
            required:true,
            attributes: ['id','etapa'],
        }]
    };
    //DIPLOMAS X CURSO 
    if(tipo_diploma.length==0 || tipo_diploma.find((e)=>e =='curso')){
        let where_cursos = {};
        if(cursos_id.length>0){
            where_cursos.id = cursos_id ;
        }else if(categorias_id.length>0){
            where_cursos.categoria_id = categorias_id ;
        }else{
            where_cursos.config_id = modulos_id ;
        }
        where_cursos.estado=1;
        let cursos = await Curso.findAll({
            where: where_cursos,
            attributes:['id']
        })
        let p_cursos_id = pluck(cursos,'id');
        // console.time('Primera consulta');
        let diplomas_x_curso = await Diploma.findAll({
                        include: [{ 
                            model:Curso,
                            required: true,
                            attributes: ['id','nombre','config_id','estado'],
                            include: [{
                                    model:Categoria,
                                    required:true,
                                    attributes: ['id','nombre','estado'],
                                }
                            ],
                            // where:where_cursos
                         },
                         include_usuario,
                        ],
                        attributes: ['id', 'usuario_id','curso_id','fecha_emision','check_apb'],
                        where:{
                            curso_id : p_cursos_id,
                            check_apb : (tipo_check_diploma.length>0) ? tipo_check_diploma : [0,1]
                        }
                    })
        // console.timeEnd('Primera consulta');
        // diplomas_x_curso.forEach(async (diploma)=>{
        for (const diploma of diplomas_x_curso) {
            Rows++
            const CellRow = [];
            const fecha_generado = moment(diploma.fecha_emision).format('DD/MM/YYYY'); 
            // console.time('entra');
            const dentro_curricula = await getUsuarioCurso('curso',diploma.usuario_id,diploma.curso_id)  || null; 
            // const dentro_curricula = (uc);
            // // const dentro_curricula = usuario_cursos.findIndex((c)=> (c.usuario_id ==diploma.usuario_id  &&  c.curso_id == diploma.curso_id)) || null;
            // console.timeEnd('entra');
            CellRow.push(diploma.usuario.modulo.etapa)
            CellRow.push(diploma.usuario.nombre)
            CellRow.push(diploma.usuario.apellido_paterno)
            CellRow.push(diploma.usuario.apellido_materno)
            CellRow.push(diploma.usuario.dni)
            CellRow.push(diploma.usuario.estado ? 'ACTIVO' : 'INACTIVO')
            CellRow.push('Por curso')
            CellRow.push(diploma.curso.categoria.nombre)
            CellRow.push(diploma.curso.categoria.estado ? 'ACTIVO' : 'INACTIVO')
            CellRow.push(dentro_curricula.length>0 ? 'SÍ' : 'NO')
            CellRow.push(diploma.curso.nombre)
            CellRow.push(diploma.curso.estado ? 'ACTIVO' : 'INACTIVO')
            CellRow.push( (fecha_generado!='Invalid date') ? fecha_generado : '-')
            CellRow.push(diploma.check_apb ? 'ACEPTADO' : 'PENDIENTE')
            CellRow.push(`${config.URL_TEST}/tools/ver_diploma/${diploma.usuario_id}/${diploma.curso_id}`)
            CellRow.push(`${config.URL_TEST}/tools/dnc/${diploma.usuario_id}/${diploma.curso_id}`)
            // CellRow.push( {
            //     text: 'Ver',
            //     hyperlink: `${config.URL_TEST}/tools/ver_diploma/${diploma.usuario_id}/${diploma.curso_id}`,
            //     tooltip:`${config.URL_TEST}/tools/ver_diploma/${diploma.usuario_id}/${diploma.curso_id}`,
            // })
            // CellRow.push( {
            //     text: 'Descargar',
            //     hyperlink: `${config.URL_TEST}/tools/dnc/${diploma.usuario_id}/${diploma.curso_id}`,
            //     tooltip: `${config.URL_TEST}/tools/dnc/${diploma.usuario_id}/${diploma.curso_id}`
            // })
            if (Rows === 1e6) {
                worksheet = workbook.addWorksheet('Hoja 2', { properties: { defaultColWidth: 18 } })
                createHeaders(worksheet, headers)
            }
            worksheet.addRow(CellRow).commit()
        }
        // })
    }
    if(tipo_diploma.length==0 || tipo_diploma.find((e)=>e =='escuela')){
        //DIPLOMAS X CATEGORIA
        let where_categoria={};
        where_categoria.estado=1;
        (categorias_id.length>0) ? where_categoria.id=categorias_id :  where_categoria.config_id=modulos_id ;
        // console.time('Seunfa consulta');
        const diplomas_x_categoria = await Diploma.findAll({
                        attributes: ['id', 'usuario_id','categoria_id','fecha_emision','check_apb'],
                        include: [{ 
                            model:Categoria,
                            required: true,
                            attributes: ['id','nombre','config_id','estado','estado_diploma'],
                            where:where_categoria
                         },
                         include_usuario
                        ],
                        where:{
                            check_apb : (tipo_check_diploma.length>0) ? tipo_check_diploma : [0,1],
                        }
                    })
        // diplomas_x_categoria.forEach(async(diploma)=>{
        for (const diploma of diplomas_x_categoria) {    
            Rows++
            const CellRow = [];
            // const dentro_curricula = usuario_cursos.findIndex(c=> c.usuario_id ==diploma.usuario_id  && c.curso.categoria_id == diploma.categoria_id) || null;
            const estado_diploma = (diploma.categoria.estado_diploma) ? '(DIPLOMA ACTIVA)' : '(DIPLOMA INACTIVA)' ;
            const dentro_curricula = await getUsuarioCurso('categoria',diploma.usuario_id,diploma.categoria_id) || null; 
            // const dentro_curricula = (uc.length>0) || null ;
            const fecha_generado = moment(diploma.fecha_emision).format('DD/MM/YYYY'); 
            CellRow.push(diploma.usuario.modulo.etapa)
            CellRow.push(diploma.usuario.nombre)
            CellRow.push(diploma.usuario.apellido_paterno)
            CellRow.push(diploma.usuario.apellido_materno)
            CellRow.push(diploma.usuario.dni)
            CellRow.push(diploma.usuario.estado ? 'ACTIVO' : 'INACTIVO')
            CellRow.push('Por escuela')
            CellRow.push(diploma.categoria.nombre)
            CellRow.push(diploma.categoria.estado ? 'ACTIVO' : 'INACTIVO')
            CellRow.push(dentro_curricula.length>0 ? `SÍ ${estado_diploma}` : `NO ${estado_diploma}`)
            CellRow.push('-')
            CellRow.push('-')
            CellRow.push( (fecha_generado!='Invalid date') ? fecha_generado : '-')
            CellRow.push(diploma.check_apb ? 'ACEPTADO' : 'PENDIENTE')
            CellRow.push(`${config.URL}/tools/ver_diploma/escuela/${diploma.usuario_id}/${diploma.categoria_id}`)
            CellRow.push(`${config.URL}/tools/dnc/escuela/${diploma.usuario_id}/${diploma.categoria_id}`)
            if (Rows === 1e6) {
                worksheet = workbook.addWorksheet('Hoja 2', { properties: { defaultColWidth: 18 } })
                createHeaders(worksheet, headers)
            }
            worksheet.addRow(CellRow).commit()
        // })
        }
    }
    // console.timeEnd('Segundo recorrido');
    if (worksheet._rowZero > 1)
      workbook.commit().then(() => {
        process.send(response({ createAt, modulo: 'Diplomas' }))
      })
    else {
      process.send({ alert: 'No se encontraron resultados' })
    }
    function pluck(array, key) {
        return array.map(function(obj) {
            return obj[key];
        });
    }
    async function getUsuarioCurso(tipo,usuario_id,recurso_id){
        if(tipo == 'curso'){
            return await UsuarioCurso.findAll({
                attributes: ['id'],
                where: {
                    estado:1,
                    usuario_id:usuario_id,
                    curso_id:recurso_id
                },
            });
        }else{
            return await UsuarioCurso.findAll({
                attributes: ['id'],
                where: {
                    estado:1,
                    usuario_id:usuario_id
                },
                include: [{ 
                    model:Curso,
                    required: true,
                    attributes: ['id','categoria_id'],
                    where:{
                        categoria_id : recurso_id
                    }
                }]
            });
        }
    }
  }
  