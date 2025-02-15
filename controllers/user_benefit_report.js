process.on('message', requestData => {
    generateReport(requestData)
})

const { con } = require('../db')
const { parseDateFromString, pluck } = require("../helper/Helper");
const { getGenericHeaders, getWorkspaceCriteria } = require('../helper/Criterios')

const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
const { response } = require('../response')
const { Op } = require('sequelize');

const Benefit = require('../models/Benefit')
const Taxonomie = require('../models/Taxonomie');
const UserBenefit = require('../models/UserBenefit');
const { getSuboworkspacesIds } = require('../helper/Workspace')
const {
    loadUsersCriteriaValues,getUserCriterionValues2
  } = require('../helper/Usuarios')

// Headers for Excel file

const headers = [
    'Módulo',
    'Nombre', 'Apellido Paterno', 'Apellido Materno',
    'Documento', 'Estado (Usuario)',
    'Beneficio',
    'Tipo de Beneficio',
    'Estado',
    'Estado actual',
    'Estado/etapa actual del Beneficio en la plataforma',
    'Descripción del estado',
    'Fecha de inscripción al beneficio',
    'Fecha de confirmación al beneficio',
    'Cierre de Inscripción',
    'Tipo de Inscripción',
]

async function generateReport({
    workspaceId, benefit
}) {
    // const headersEstaticos = await getGenericHeaders(workspaceId)
    // await createHeaders(headersEstaticos.concat(headers))
    await createHeaders(headers)
    const taxonomy_register = await Taxonomie.findOne({
        where:{
            group:'benefit',
            type:'type_register',
            code : 'extraordinario'
        }
    });
    const benefits_list = await Benefit.findAll({
        where: {
            workspace_id: workspaceId,
            id: {
                [Op.in]: benefit
            }
        },
        include: [
            { model: Taxonomie, as: 'status' },
            { model: Taxonomie, as: 'type' },
        ]
    });

    const users_benefits = await UserBenefit.findAll({
        where: {
            benefit_id: {
                [Op.in]: benefit
            },
            deleted_at:null,
        },
        include: [
            { model: Taxonomie, as: 'status' },
        ]
    })
    const select_users = 'users.id,users.active,users.subworkspace_id,users.document,users.name,users.lastname,users.surname';
    const modulos = await getSuboworkspacesIds(workspaceId,type = 'full');
    const modulos_id = pluck(modulos,'id');
    const default_status = {code:null,name:'Pendiente',fecha_confirmado:null,fecha_registro:null,description:'El usuario aún no esta inscrito al beneficio'}  
    // Load workspace criteria
    // const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
    // const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')
    for (const benefit of benefits_list) {
        const users = await Benefit.getUsersSegmentedInBenefit(modulos_id,benefit.id,select_users,'all_users');
        for (const user of users) {
            const subworkspace = modulos.find(m =>m.id == user.subworkspace_id);
            const users_benefit = users_benefits.find(ub => ub.user_id == user.id && ub.benefit_id == benefit.id);
            const status_users_benefit = users_benefit ? users_benefit.status : default_status;

            let type_register = '-' 
            let date_approved = '-';
            let date_subscribed = '-';
            if(status_users_benefit.code == 'subscribed' || status_users_benefit.code == 'approved'){
                type_register = users_benefit.type_id == taxonomy_register.id ? 'Extraordinario' : 'Regular';
                date_approved = users_benefit.fecha_confirmado ? parseDateFromString(users_benefit.fecha_confirmado) : '-'
                date_subscribed = users_benefit.fecha_registro ? parseDateFromString(users_benefit.fecha_registro) : '-'
            }

            const cellRow = []
            // const userValues = await getUserCriterionValues2(user.id, workspaceCriteriaNames)
            cellRow.push(subworkspace.name)
            cellRow.push(user.name)
            cellRow.push(user.lastname)
            cellRow.push(user.surname)
            cellRow.push(user.document)
            cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')

            // userValues.forEach((item) => cellRow.push(item.criterion_value || "-"))
            cellRow.push(benefit.title)
            cellRow.push(benefit.type.name)
            cellRow.push(benefit.active ? 'Activo' : 'Inactivo')
            cellRow.push(benefit.status.name)
            cellRow.push(status_users_benefit.name)
            cellRow.push(status_users_benefit.description)
            cellRow.push(date_subscribed)
            cellRow.push(date_approved)
            cellRow.push(parseDateFromString(benefit.fin_inscripcion))
            cellRow.push( type_register )
            worksheet.addRow(cellRow).commit()
        }
    }

    if (worksheet._rowZero > 1) {
        workbook.commit().then(() => {
            process.send(response({ createAt, modulo: 'Benefit_report' }))
        })
    } else {
        process.send({ alert: 'No se encontraron resultados' })
    }
}
