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
    'Beneficio',
    'Tipo de Beneficio',
    'Estado',
    'Estado actual',
    'Inicio de Inscripción',
    'Cierre de Inscripción',
    'Tipo de Inscripción',
    'Valoración',
]

async function generateReport({
    workspaceId, benefit
}) {
    const headersEstaticos = await getGenericHeaders(workspaceId)
    await createHeaders(headersEstaticos.concat(headers))
    
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

    // const users_benefits = await UserBenefit.findAll({
    //     where: {
    //         benefit_id: {
    //             [Op.in]: benefit
    //         },
    //         deleted_at:null,
    //         include: [
    //             { model: Taxonomie, as: 'status' },
    //         ]
    //     }
    // })
    const select_users = 'users.id,users.subworkspace_id,users.document,users.name,users.lastname,users.surname';
    const modulos_id = await getSuboworkspacesIds(workspaceId);
    // Load workspace criteria
    // const modulos_id = pluck(modulos,'id');
    const workspaceCriteria = await getWorkspaceCriteria(workspaceId)
    const workspaceCriteriaNames = pluck(workspaceCriteria, 'name')
    for (const benefit of benefits_list) {
        const users = await Benefit.getUsersSegmentedInBenefit(modulos_id,benefit.id,select_users,'all_users');
        for (const user of users) {
            const cellRow = []
            const userValues = await getUserCriterionValues2(user.id, workspaceCriteriaNames)

            cellRow.push(user.name)
            cellRow.push(user.lastname)
            cellRow.push(user.surname)
            cellRow.push(user.document)
            cellRow.push(user.active === 1 ? 'Activo' : 'Inactivo')

            userValues.forEach((item) => cellRow.push(item.criterion_value || "-"))
            cellRow.push(benefit.title)
            cellRow.push(benefit.type.name)
            cellRow.push(benefit.active ? 'Activo' : 'Inactivo')
            cellRow.push(benefit.status.name)
            cellRow.push(parseDateFromString(benefit.inicio_inscripcion))
            cellRow.push(parseDateFromString(benefit.fin_inscripcion))
            cellRow.push(parseDateFromString(benefit.fecha_liberacion))
            cellRow.push( '-' )
            cellRow.push( '-' )
            cellRow.push( '-' )
            cellRow.push( '-' )
            cellRow.push( '-' )
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
